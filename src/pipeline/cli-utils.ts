import { formatActualCost, formatCostEstimate } from "../cli/cost-estimator.js";
import { ProgressDisplay } from "../cli/progress.js";
import type { PipelineCallbacks } from "./orchestrator.js";
import * as readline from "node:readline";

export function shouldAutoConfirm(yes: boolean): boolean {
  return yes || !process.stdin.isTTY;
}

export function shouldSkipPreview(): boolean {
  return !process.stdin.isTTY;
}

/** Create CLI callbacks that wrap ProgressDisplay for terminal output */
export function createCliCallbacks(
  yes: boolean,
  stageNames: readonly string[],
): {
  callbacks: PipelineCallbacks;
  progress: ProgressDisplay;
} {
  const progress = new ProgressDisplay();
  const stageIndices = new Map<string, number>();
  for (const name of stageNames) {
    stageIndices.set(name, progress.addStage(name.charAt(0).toUpperCase() + name.slice(1)));
  }

  const idx = (stage: string) => stageIndices.get(stage) ?? 0;

  const callbacks: PipelineCallbacks = {
    onStageStart(stage) {
      progress.start(idx(stage));
    },
    onStageComplete(stage, detail) {
      progress.complete(idx(stage), detail);
    },
    onStageSkip(stage, reason) {
      progress.skip(idx(stage), reason);
    },
    onStageError(stage, error) {
      progress.fail(idx(stage), error);
    },
    async onCostEstimate(estimate, imageProvider) {
      console.log(`\n${formatCostEstimate(estimate, imageProvider)}`);
      const autoConfirm = shouldAutoConfirm(yes);
      if (autoConfirm) return true;
      return confirm("Proceed with generation?");
    },
    onActualCost(cost) {
      console.log(`\n${formatActualCost(cost)}`);
    },
    onLog(message) {
      console.log(message);
    },
  };

  return { callbacks, progress };
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
