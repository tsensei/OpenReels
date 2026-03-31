type StageStatus = "pending" | "running" | "done" | "failed" | "skipped";

interface StageInfo {
  name: string;
  status: StageStatus;
  duration?: number;
  detail?: string;
}

export class ProgressDisplay {
  private stages: StageInfo[] = [];
  private startTime: number = Date.now();
  private hasRendered: boolean = false;

  addStage(name: string): number {
    const index = this.stages.length;
    this.stages.push({ name, status: "pending" });
    return index;
  }

  start(index: number): void {
    const stage = this.stages[index];
    if (stage) {
      stage.status = "running";
      this.render();
    }
  }

  complete(index: number, detail?: string): void {
    const stage = this.stages[index];
    if (stage) {
      stage.status = "done";
      stage.duration = (Date.now() - this.startTime) / 1000;
      stage.detail = detail;
      this.render();
    }
  }

  fail(index: number, detail?: string): void {
    const stage = this.stages[index];
    if (stage) {
      stage.status = "failed";
      stage.duration = (Date.now() - this.startTime) / 1000;
      stage.detail = detail;
      this.render();
    }
  }

  skip(index: number, detail?: string): void {
    const stage = this.stages[index];
    if (stage) {
      stage.status = "skipped";
      stage.detail = detail;
      this.render();
    }
  }

  private render(): void {
    // Move cursor up to overwrite previous output (only after first render)
    if (this.hasRendered) {
      const lines = this.stages.length;
      if (lines > 0) {
        process.stdout.write(`\x1b[${lines}A`);
      }
    }
    this.hasRendered = true;

    for (const stage of this.stages) {
      const icon = STATUS_ICONS[stage.status];
      const time = stage.duration ? `${stage.duration.toFixed(1)}s` : "...";
      const detail = stage.detail ? `  (${stage.detail})` : "";
      const line = `${icon} ${stage.name.padEnd(14)} ${stage.status === "pending" ? "   " : time.padStart(6)}${detail}`;
      process.stdout.write(`\x1b[2K${line}\n`);
    }
  }

  summary(): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const done = this.stages.filter((s) => s.status === "done").length;
    const failed = this.stages.filter((s) => s.status === "failed").length;
    console.log(`\nCompleted ${done}/${this.stages.length} stages in ${elapsed}s${failed > 0 ? ` (${failed} failed)` : ""}`);
  }
}

const STATUS_ICONS: Record<StageStatus, string> = {
  pending: "  ",
  running: "\u23f3",
  done: "\u2714",
  failed: "\u2718",
  skipped: "\u23ed",
};
