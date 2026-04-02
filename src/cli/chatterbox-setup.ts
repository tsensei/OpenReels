/**
 * Chatterbox Turbo local TTS setup: Python venv creation and package installation.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const VENV_DIR = path.join(os.homedir(), ".openreels", "chatterbox-venv");

/**
 * Ensures chatterbox-tts is available in a managed venv at ~/.openreels/chatterbox-venv.
 *
 * Strategy (in order):
 *   1. If `uv` is available, use `uv venv --python 3.12` + `uv pip install` — handles
 *      uv-managed Pythons correctly and is 10-100x faster than pip.
 *   2. Otherwise fall back to finding a system python3.12/3.11 and using `python -m venv`.
 *
 * On subsequent runs the venv is detected in ~0ms and skips all setup.
 *
 * @returns Path to the Python binary inside the venv.
 */
export async function ensureChatterboxVenv(): Promise<string> {
  const venvPython = process.platform === "win32"
    ? path.join(VENV_DIR, "Scripts", "python.exe")
    : path.join(VENV_DIR, "bin", "python");

  // Fast path: venv already exists and all required packages are importable
  if (fs.existsSync(venvPython)) {
    const check = spawnSync(
      venvPython,
      ["-c", "import chatterbox; import torchaudio; import pkg_resources"],
      { encoding: "utf-8" },
    );
    if (check.status === 0) return venvPython;
    console.info(`\nChatterbox venv found but missing dependencies — reinstalling...\n`);
  } else {
    console.info(
      `\n─────────────────────────────────────────────────────────────\n` +
      ` Chatterbox Turbo: one-time setup\n` +
      ` Creating isolated Python environment at:\n` +
      `   ${VENV_DIR}\n` +
      ` Installing chatterbox-tts... this takes a few minutes.\n` +
      ` Model weights (~1.5 GB) are downloaded on first generation.\n` +
      `─────────────────────────────────────────────────────────────\n`,
    );
    fs.mkdirSync(path.dirname(VENV_DIR), { recursive: true });
  }

  const uvBin = findUv();

  if (uvBin) {
    // uv path: works with uv-managed Pythons, no ensurepip issues
    const venvResult = spawnSync(uvBin, ["venv", "--python", "3.12", VENV_DIR], { stdio: "inherit" });
    if (venvResult.status !== 0) {
      // 3.12 not available to uv, try 3.11
      const fallback = spawnSync(uvBin, ["venv", "--python", "3.11", VENV_DIR], { stdio: "inherit" });
      if (fallback.status !== 0) {
        console.error(
          `\n✗ uv could not create a venv with Python 3.11 or 3.12.\n\n` +
          `  Install Python 3.12 via uv:  uv python install 3.12\n` +
          `  Or via Homebrew:             brew install python@3.12\n`,
        );
        process.exit(1);
      }
    }
    const installResult = spawnSync(
      uvBin,
      ["pip", "install", "--python", venvPython, "chatterbox-tts", "setuptools<70"],
      { stdio: "inherit" },
    );
    if (installResult.status !== 0) {
      console.error(`\n✗ Failed to install chatterbox-tts via uv.\n`);
      process.exit(1);
    }
  } else {
    // Standard path: find a system python3.12 or python3.11 and use python -m venv
    const systemPython = findCompatiblePython();
    const venvResult = spawnSync(systemPython, ["-m", "venv", VENV_DIR], { stdio: "inherit" });
    if (venvResult.status !== 0) {
      console.error(`\n✗ Failed to create venv: ${systemPython} -m venv ${VENV_DIR}\n`);
      process.exit(1);
    }
    const pipBin = process.platform === "win32"
      ? path.join(VENV_DIR, "Scripts", "pip.exe")
      : path.join(VENV_DIR, "bin", "pip");
    const installResult = spawnSync(pipBin, ["install", "chatterbox-tts", "setuptools<70"], {
      stdio: "inherit",
    });
    if (installResult.status !== 0) {
      console.error(`\n✗ pip install chatterbox-tts failed.\n`);
      process.exit(1);
    }
  }

  console.info(`\n✓ Chatterbox Turbo ready.\n`);
  return venvPython;
}

/** Returns the path to `uv` if available on PATH or common install locations, otherwise null. */
function findUv(): string | null {
  for (const bin of ["uv", "/opt/homebrew/bin/uv", "/usr/local/bin/uv"]) {
    const probe = spawnSync(bin, ["--version"], { encoding: "utf-8" });
    if (probe.status === 0) return bin;
  }
  return null;
}

/**
 * Finds a system-managed python3.12 or python3.11 (non-uv).
 * Used as fallback when uv is not available.
 * Checks common absolute paths in addition to PATH so it doesn't miss Homebrew installs.
 */
function findCompatiblePython(): string {
  const home = os.homedir();
  const candidates = [
    "python3.12", "python3.11",
    "/opt/homebrew/bin/python3.12", "/opt/homebrew/bin/python3.11",
    "/usr/local/bin/python3.12", "/usr/local/bin/python3.11",
    path.join(home, ".pyenv", "shims", "python3.12"),
    path.join(home, ".pyenv", "shims", "python3.11"),
  ];

  for (const bin of candidates) {
    const probe = spawnSync(bin, ["--version"], { encoding: "utf-8" });
    if (probe.status !== 0) continue;
    const version = (probe.stdout ?? probe.stderr ?? "").trim();
    const match = version.match(/Python 3\.(\d+)/);
    if (!match) continue;
    const minor = parseInt(match[1] ?? "0", 10);
    if (minor === 11 || minor === 12) return bin;
  }

  console.error(
    `\n✗ Python 3.11 or 3.12 is required for Chatterbox Turbo.\n` +
    `  Python 3.13+ has known PyTorch/OpenMP issues on macOS.\n\n` +
    `  The fastest option is to install via uv (already installed):\n` +
    `    uv python install 3.12\n\n` +
    `  Or install Python 3.12 directly:\n` +
    `    macOS:   brew install python@3.12\n` +
    `    Linux:   sudo apt install python3.12\n` +
    `    Windows: https://python.org  (download 3.12)\n`,
  );
  process.exit(1);
}
