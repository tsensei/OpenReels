import { execSync, execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { LLMProvider, TTSProvider, ImageProvider, StockProvider, WordTimestamp, LLMUsage } from "../schema/providers.js";
import type { ArchetypeConfig } from "../schema/archetype.js";
import type { DirectorScore } from "../schema/director-score.js";
import { research } from "../agents/research.js";
import { generateDirectorScore } from "../agents/creative-director.js";
import { evaluate } from "../agents/critic.js";
import { optimizeImagePrompt } from "../agents/image-prompter.js";
import { getArchetype } from "../config/archetype-registry.js";
import { mapScoreToProps, getTotalDurationInFrames } from "../remotion/lib/score-to-props.js";
import { estimateCost, formatCostEstimate, computeActualLLMCost, formatActualCost } from "../cli/cost-estimator.js";
import { getPlatformConfig } from "../config/platforms.js";
import { ProgressDisplay } from "../cli/progress.js";

export interface PipelineOptions {
  topic: string;
  llm: LLMProvider;
  tts: TTSProvider;
  imageGen: ImageProvider;
  stock: StockProvider;
  archetype?: string;
  platform: string;
  dryRun: boolean;
  preview: boolean;
  verbose: boolean;
  outputDir: string;
}

export interface PipelineResult {
  outputDir: string;
  videoPath: string | null;
  thumbnailPath: string | null;
  scorePath: string;
  logPath: string;
}

interface RunLog {
  topic: string;
  startedAt: string;
  stages: { name: string; duration: number; status: string; error?: string }[];
  totalCost?: { estimated: number; actual?: number };
}

export async function runPipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const log: RunLog = {
    topic: opts.topic,
    startedAt: new Date().toISOString(),
    stages: [],
  };

  // Create output directory with timestamp to avoid overwrites
  const slug = opts.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const runDir = path.join(opts.outputDir, `${dateStr}-${timeStr}-${slug}`);
  fs.mkdirSync(runDir, { recursive: true });
  const assetsDir = path.join(runDir, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const progress = new ProgressDisplay();
  const researchIdx = progress.addStage("Research");
  const directorIdx = progress.addStage("Director");
  const ttsIdx = progress.addStage("TTS");
  const visualsIdx = progress.addStage("Visuals");
  const assemblyIdx = progress.addStage("Assembly");
  const criticIdx = progress.addStage("Critic");

  // Track all LLM token usage for actual cost reporting
  const llmUsages: LLMUsage[] = [];

  // Stage 1: Research
  progress.start(researchIdx);
  let researchResult;
  const researchStart = Date.now();
  try {
    const researchOutput = await research(opts.llm, opts.topic);
    researchResult = researchOutput.data;
    llmUsages.push(researchOutput.usage);
    const dur = (Date.now() - researchStart) / 1000;
    progress.complete(researchIdx, `${researchResult.key_facts.length} facts`);
    log.stages.push({ name: "research", duration: dur, status: "done" });
  } catch (err) {
    const dur = (Date.now() - researchStart) / 1000;
    progress.complete(researchIdx, "skipped (web search failed)");
    log.stages.push({ name: "research", duration: dur, status: "skipped", error: String(err) });
    researchResult = {
      summary: `Topic: ${opts.topic}`,
      key_facts: [],
      mood: "informative",
      sources: [],
    };
  }

  // Stage 2: Creative Director
  progress.start(directorIdx);
  const cdStart = Date.now();
  const cdOutput = await generateDirectorScore(
    opts.llm,
    opts.topic,
    researchResult,
    { archetype: opts.archetype },
  );
  const directorScore = cdOutput.data;
  llmUsages.push(cdOutput.usage);
  const cdDur = (Date.now() - cdStart) / 1000;
  progress.complete(directorIdx, `${directorScore.scenes.length} scenes, ${directorScore.archetype}`);
  log.stages.push({ name: "creative-director", duration: cdDur, status: "done" });

  // Resolve archetype config for image prompt optimization
  const archetypeConfig = getArchetype(directorScore.archetype);

  // Save DirectorScore
  const scorePath = path.join(runDir, "score.json");
  fs.writeFileSync(scorePath, JSON.stringify(directorScore, null, 2));

  // Dry run exit
  if (opts.dryRun) {
    progress.skip(ttsIdx, "dry run");
    progress.skip(visualsIdx, "dry run");
    progress.skip(assemblyIdx, "dry run");
    progress.skip(criticIdx, "dry run");
    progress.summary();

    console.log("\n--- DirectorScore ---");
    console.log(JSON.stringify(directorScore, null, 2));

    const logPath = path.join(runDir, "log.json");
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

    return { outputDir: runDir, videoPath: null, thumbnailPath: null, scorePath, logPath };
  }

  // Cost estimation
  const costBreakdown = estimateCost(directorScore);
  console.log(`\n${formatCostEstimate(costBreakdown)}`);
  log.totalCost = { estimated: costBreakdown.totalCost };

  const proceed = await confirm("Proceed with generation?");
  if (!proceed) {
    console.log("Aborted.");
    process.exit(0);
  }

  // Stage 3: TTS
  progress.start(ttsIdx);
  const ttsStart = Date.now();
  const fullScript = directorScore.scenes.map((s) => s.script_line).join(" ");
  const ttsResult = await opts.tts.generate(fullScript);
  const ttsDur = (Date.now() - ttsStart) / 1000;

  // Save audio
  const voiceoverPath = path.join(assetsDir, "voiceover.mp3");
  fs.writeFileSync(voiceoverPath, ttsResult.audio);

  // Split word timestamps into per-scene groups
  const sceneWords = splitWordsIntoScenes(directorScore, ttsResult.words);
  progress.complete(ttsIdx, `${ttsResult.words.length} words`);
  log.stages.push({ name: "tts", duration: ttsDur, status: "done" });

  // Stage 4: Visual Assets (parallel)
  progress.start(visualsIdx);
  const visualStart = Date.now();
  const totalScenes = directorScore.scenes.length;
  const sceneResults = await Promise.all(
    directorScore.scenes.map(async (scene, i) => {
      try {
        return await resolveVisualAsset(scene, i, totalScenes, assetsDir, opts, archetypeConfig);
      } catch (err) {
        console.warn(`[visuals] Scene ${i} asset failed: ${err}. Using fallback.`);
        return { path: null as string | null, usage: null as LLMUsage | null, durationSeconds: null };
      }
    }),
  );
  const sceneAssets = sceneResults.map((r) => r.path);
  const sceneSourceDurations = sceneResults.map((r) => r.durationSeconds);
  for (const r of sceneResults) {
    if (r.usage) llmUsages.push(r.usage);
  }
  const visualDur = (Date.now() - visualStart) / 1000;
  const assetCount = sceneAssets.filter(Boolean).length;
  progress.complete(visualsIdx, `${assetCount}/${directorScore.scenes.length} assets`);
  log.stages.push({ name: "visuals", duration: visualDur, status: "done" });

  // Stage 5: Remotion Assembly
  progress.start(assemblyIdx);
  const assemblyStart = Date.now();
  const platformConfig = getPlatformConfig(opts.platform);

  // Symlink assets into a temp public dir for Remotion to serve via staticFile()
  // (same approach as ReelMistri's remotion_bridge.py)
  const publicDir = path.join(runDir, "_remotion_public");
  fs.mkdirSync(publicDir, { recursive: true });
  const assetsLink = path.join(publicDir, "assets");
  if (fs.existsSync(assetsLink)) fs.rmSync(assetsLink, { recursive: true });
  fs.symlinkSync(path.resolve(assetsDir), assetsLink);

  // Voiceover also needs to be accessible — symlink it into public
  fs.copyFileSync(voiceoverPath, path.join(publicDir, "voiceover.mp3"));

  const compositionProps = mapScoreToProps(
    directorScore,
    {
      // staticFile() paths — served by Remotion's bundler from publicDir
      sceneAssets: sceneAssets.map((a) => {
        if (!a) return null;
        const filename = path.basename(a);
        return `assets/${filename}`;
      }),
      voiceoverPath: "voiceover.mp3",
      musicPath: null,
      sceneWords,
      allWords: ttsResult.words, // absolute timestamps for timeline-centric captions
      sceneSourceDurations,
    },
    platformConfig.fps,
  );

  const totalFrames = getTotalDurationInFrames(compositionProps);

  // Bundle Remotion compositions with our assets as the public directory
  const remotionEntry = path.join(process.cwd(), "src", "remotion", "index.ts");
  const bundled = await bundle({
    entryPoint: remotionEntry,
    webpackOverride: (config: object) => config,
    publicDir,
  });

  const composition = await selectComposition({
    serveUrl: bundled,
    id: "OpenReelsVideo",
    inputProps: compositionProps as unknown as Record<string, unknown>,
  });

  const videoPath = path.join(runDir, "final.mp4");
  await renderMedia({
    composition: {
      ...composition,
      width: platformConfig.width,
      height: platformConfig.height,
      fps: platformConfig.fps,
      durationInFrames: totalFrames,
    },
    serveUrl: bundled,
    codec: "h264",
    outputLocation: videoPath,
    inputProps: compositionProps as unknown as Record<string, unknown>,
  });

  const assemblyDur = (Date.now() - assemblyStart) / 1000;
  progress.complete(assemblyIdx, `${(totalFrames / platformConfig.fps).toFixed(1)}s video`);
  log.stages.push({ name: "assembly", duration: assemblyDur, status: "done" });

  // Stage 6: Critic
  progress.start(criticIdx);
  const criticStart = Date.now();
  try {
    const critiqueOutput = await evaluate(opts.llm, directorScore, opts.topic);
    const critique = critiqueOutput.data;
    llmUsages.push(critiqueOutput.usage);
    const criticDur = (Date.now() - criticStart) / 1000;

    if (critique.revision_needed && critique.score < 7) {
      progress.complete(criticIdx, `score ${critique.score}/10, revision needed`);
      console.log(`\nCritic score: ${critique.score}/10 — ${critique.weaknesses.join(", ")}`);
      console.log("Revision support coming in Phase 4. Using current version.");
    } else {
      progress.complete(criticIdx, `score ${critique.score}/10`);
    }
    log.stages.push({ name: "critic", duration: criticDur, status: "done" });
  } catch (err) {
    const criticDur = (Date.now() - criticStart) / 1000;
    progress.complete(criticIdx, "skipped");
    log.stages.push({ name: "critic", duration: criticDur, status: "skipped", error: String(err) });
  }

  progress.summary();

  // Compute and report actual cost
  const aiImages = directorScore.scenes.filter((s) => s.visual_type === "ai_image").length;
  const ttsCharacters = directorScore.scenes.reduce((sum, s) => sum + s.script_line.length, 0);
  const actualCost = computeActualLLMCost(llmUsages, { aiImages, ttsCharacters }, opts.llm.constructor.name === "OpenAILLM" ? "openai" : "anthropic");
  log.totalCost = { estimated: costBreakdown.totalCost, actual: actualCost.totalCost };
  console.log(`\n${formatActualCost(actualCost)}`);

  // Save log
  const logPath = path.join(runDir, "log.json");
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

  // Preview
  if (opts.preview) {
    console.log("\nOpening Remotion Studio preview...");
    const { execSync } = await import("node:child_process");
    try {
      execSync("npx remotion studio", { stdio: "inherit" });
    } catch {
      console.warn("Preview closed or failed to open.");
    }
  }

  console.log(`\nOutput: ${runDir}`);
  console.log(`  Video:     ${videoPath}`);
  console.log(`  Score:     ${scorePath}`);
  console.log(`  Log:       ${logPath}`);

  return { outputDir: runDir, videoPath, thumbnailPath: null, scorePath, logPath };
}

interface VisualAssetResult {
  path: string | null;
  usage: LLMUsage | null;
  durationSeconds: number | null;
}

async function resolveVisualAsset(
  scene: DirectorScore["scenes"][number],
  index: number,
  totalScenes: number,
  assetsDir: string,
  opts: PipelineOptions,
  archetype: ArchetypeConfig,
): Promise<VisualAssetResult> {
  switch (scene.visual_type) {
    case "ai_image": {
      // Optimize prompt via LLM before generating the image
      let prompt = scene.visual_prompt;
      let usage: LLMUsage | null = null;
      try {
        const optimized = await optimizeImagePrompt(
          opts.llm, scene.visual_prompt, scene.script_line,
          index, totalScenes, archetype,
        );
        prompt = optimized.prompt;
        usage = optimized.usage;
      } catch (err) {
        console.warn(`[visuals] Scene ${index} prompt optimization failed, using original: ${err}`);
      }
      const imageBuffer = await opts.imageGen.generate(prompt);
      const filePath = path.join(assetsDir, `scene-${index}-ai.png`);
      fs.writeFileSync(filePath, imageBuffer);
      return { path: filePath, usage, durationSeconds: null };
    }
    case "stock_image": {
      const asset = await opts.stock.searchImage(scene.visual_prompt);
      if (!asset) return { path: null, usage: null, durationSeconds: null };
      const dest = path.join(assetsDir, `scene-${index}-stock.jpg`);
      fs.copyFileSync(asset.filePath, dest);
      return { path: dest, usage: null, durationSeconds: null };
    }
    case "stock_video": {
      const asset = await opts.stock.searchVideo(scene.visual_prompt);
      if (!asset) return { path: null, usage: null, durationSeconds: null };
      const dest = path.join(assetsDir, `scene-${index}-stock.mp4`);
      fs.copyFileSync(asset.filePath, dest);
      const durationSeconds = getVideoDuration(dest);
      return { path: dest, usage: null, durationSeconds };
    }
    case "text_card": {
      return { path: null, usage: null, durationSeconds: null };
    }
    default:
      return { path: null, usage: null, durationSeconds: null };
  }
}

function splitWordsIntoScenes(
  score: DirectorScore,
  allWords: WordTimestamp[],
): WordTimestamp[][] {
  // Split word timestamps into per-scene groups for duration calculation.
  // Uses ReelMistri's proportional scaling approach to handle ElevenLabs
  // text normalization (numbers/abbreviations expand into different word counts).
  //
  // Note: This is only used for scene DURATION calculation. Captions use
  // allWords directly with absolute timestamps (timeline-centric approach).

  if (allWords.length === 0) {
    return score.scenes.map(() => []);
  }

  // Count expected words per scene from script text
  const wordsPerScene = score.scenes.map(
    (s) => s.script_line.split(/\s+/).filter(Boolean).length,
  );
  const totalExpected = wordsPerScene.reduce((sum, n) => sum + n, 0);
  const totalActual = allWords.length;

  const sceneWords: WordTimestamp[][] = [];
  let wordIndex = 0;

  for (let i = 0; i < score.scenes.length; i++) {
    const expectedCount = wordsPerScene[i] ?? 0;

    // Proportionally scale word consumption if TTS word count differs
    // (ReelMistri: tts.py lines 179-182)
    let wordsToConsume = expectedCount;
    if (totalExpected !== totalActual && totalExpected > 0) {
      wordsToConsume = Math.round(expectedCount * totalActual / totalExpected);
      wordsToConsume = Math.max(1, wordsToConsume);
    }

    const words: WordTimestamp[] = [];
    for (let j = 0; j < wordsToConsume && wordIndex < allWords.length; j++) {
      const w = allWords[wordIndex];
      if (w) words.push(w);
      wordIndex++;
    }

    sceneWords.push(words);
  }

  // Any remaining words go to the last scene
  const lastScene = sceneWords[sceneWords.length - 1];
  if (lastScene) {
    while (wordIndex < allWords.length) {
      const w = allWords[wordIndex];
      if (w) lastScene.push(w);
      wordIndex++;
    }
  }

  return sceneWords;
}

function getVideoDuration(filePath: string): number | null {
  try {
    const result = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
      { encoding: "utf-8" },
    );
    const duration = parseFloat(result.trim());
    return Number.isFinite(duration) ? duration : null;
  } catch {
    return null;
  }
}

function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} [Y/n] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() !== "n");
    });
  });
}
