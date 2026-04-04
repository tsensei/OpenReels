/**
 * Kokoro TTS subprocess worker.
 *
 * Runs in an isolated child process to avoid the ONNX runtime conflict between
 * kokoro-js and @huggingface/transformers. Reads a JSON config from the path
 * passed as argv[2], generates audio, writes a WAV file, then exits.
 *
 * IPC protocol:
 *   Input:  JSON file at argv[2] → { text: string, voice: string, outputPath: string }
 *   Output: WAV file written to outputPath
 *   Exit:   0 = success, 1 = error (message on stderr)
 */
import { readFileSync, writeFileSync } from "node:fs";

interface KokoroConfig {
  text: string;
  voice: string;
  outputPath: string;
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error("Usage: kokoro-worker.ts <config.json>");
    process.exit(1);
  }

  const config: KokoroConfig = JSON.parse(readFileSync(configPath, "utf-8"));

  const { KokoroTTS, TextSplitterStream } = await import("kokoro-js");
  const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
    dtype: "q8",
  });

  // Use stream() instead of generate() to avoid 511-token truncation.
  // generate() silently truncates at ~511 tokens via tokenizer({truncation:true}).
  // stream() splits by sentence and generates each chunk within the token limit.
  const splitter = new TextSplitterStream();
  const stream = tts.stream(splitter, { voice: config.voice as "af_heart" });

  // Push text and signal no more input
  splitter.push(config.text);
  splitter.close();

  // Collect all audio chunks and concatenate raw PCM
  const wavChunks: Uint8Array[] = [];
  for await (const { audio } of stream) {
    // Each chunk is a RawAudio with toWav() — extract just the first chunk's
    // WAV as the base, then we'll concatenate all chunks differently.
    // Actually, the simplest correct approach: save each chunk as WAV,
    // we'll write the last one and concat using raw approach below.
    const wavBytes = audio.toWav();
    wavChunks.push(new Uint8Array(wavBytes));
  }

  if (wavChunks.length === 0) {
    throw new Error("Kokoro stream produced no audio chunks");
  }

  if (wavChunks.length === 1) {
    // Single chunk — write directly
    writeFileSync(config.outputPath, Buffer.from(wavChunks[0]!));
  } else {
    // Multiple chunks — extract raw PCM from each WAV and concatenate,
    // then wrap in a single WAV header.
    const pcmChunks: Buffer[] = [];
    let sampleRate = 24000;
    let bitDepth = 16;
    let channels = 1;
    let audioFormat = 1; // 1=PCM, 3=IEEE float

    for (const wavBytes of wavChunks) {
      const buf = Buffer.from(wavBytes);
      // Parse WAV header to find data chunk
      // Standard WAV: RIFF(4) + size(4) + WAVE(4) + chunks...
      // Each chunk: id(4) + size(4) + data(size)
      let offset = 12; // skip RIFF header
      while (offset < buf.length - 8) {
        const chunkId = buf.toString("ascii", offset, offset + 4);
        const chunkSize = buf.readUInt32LE(offset + 4);

        if (chunkId === "fmt ") {
          audioFormat = buf.readUInt16LE(offset + 8);
          channels = buf.readUInt16LE(offset + 10);
          sampleRate = buf.readUInt32LE(offset + 12);
          bitDepth = buf.readUInt16LE(offset + 22);
        }

        if (chunkId === "data") {
          pcmChunks.push(buf.subarray(offset + 8, offset + 8 + chunkSize));
          break;
        }

        offset += 8 + chunkSize;
      }
    }

    // Build a single WAV from concatenated samples, preserving the source format
    // (kokoro-js outputs 32-bit IEEE float / format code 3)
    const totalPcm = Buffer.concat(pcmChunks);
    const wavHeader = buildWavHeader(totalPcm.length, sampleRate, channels, bitDepth, audioFormat);
    writeFileSync(config.outputPath, Buffer.concat([wavHeader, totalPcm]));
  }
}

function buildWavHeader(
  dataSize: number,
  sampleRate: number,
  channels: number,
  bitDepth: number,
  audioFormat: number = 1,
): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(audioFormat, 20); // 1=PCM, 3=IEEE float
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return header;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
