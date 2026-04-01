type StageStatus = "pending" | "running" | "done" | "failed" | "skipped";

interface StageInfo {
  name: string;
  status: StageStatus;
  duration?: number;
  detail?: string;
}

const SPINNER_FRAMES = [
  "\u280b",
  "\u2819",
  "\u2839",
  "\u2838",
  "\u283c",
  "\u2834",
  "\u2826",
  "\u2827",
  "\u2807",
  "\u280f",
];

export class ProgressDisplay {
  private stages: StageInfo[] = [];
  private startTime: number = Date.now();
  private hasRendered: boolean = false;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private spinnerFrame: number = 0;

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
      this.ensureTick();
    }
  }

  complete(index: number, detail?: string): void {
    const stage = this.stages[index];
    if (stage) {
      stage.status = "done";
      stage.duration = (Date.now() - this.startTime) / 1000;
      stage.detail = detail;
      this.render();
      this.maybeStopTick();
    }
  }

  fail(index: number, detail?: string): void {
    const stage = this.stages[index];
    if (stage) {
      stage.status = "failed";
      stage.duration = (Date.now() - this.startTime) / 1000;
      stage.detail = detail;
      this.render();
      this.maybeStopTick();
    }
  }

  skip(index: number, detail?: string): void {
    const stage = this.stages[index];
    if (stage) {
      stage.status = "skipped";
      stage.detail = detail;
      this.render();
      this.maybeStopTick();
    }
  }

  private ensureTick(): void {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => {
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length;
      this.render();
    }, 80);
  }

  private maybeStopTick(): void {
    if (!this.stages.some((s) => s.status === "running") && this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
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

    const now = Date.now();
    for (const stage of this.stages) {
      let icon: string;
      let time: string;

      if (stage.status === "running") {
        icon = SPINNER_FRAMES[this.spinnerFrame] ?? SPINNER_FRAMES[0]!;
        time = `${((now - this.startTime) / 1000).toFixed(1)}s`;
      } else if (stage.status === "pending") {
        icon = "  ";
        time = "   ";
      } else {
        icon = STATUS_ICONS[stage.status];
        time = stage.duration ? `${stage.duration.toFixed(1)}s` : "";
      }

      const detail = stage.detail ? `  (${stage.detail})` : "";
      const line = `${icon} ${stage.name.padEnd(14)} ${time.padStart(6)}${detail}`;
      process.stdout.write(`\x1b[2K${line}\n`);
    }
  }

  summary(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const done = this.stages.filter((s) => s.status === "done").length;
    const failed = this.stages.filter((s) => s.status === "failed").length;
    console.log(
      `\nCompleted ${done}/${this.stages.length} stages in ${elapsed}s${failed > 0 ? ` (${failed} failed)` : ""}`,
    );
  }
}

const STATUS_ICONS: Record<StageStatus, string> = {
  done: "\u2714",
  failed: "\u2718",
  skipped: "\u23ed",
  pending: "  ",
  running: "",
};
