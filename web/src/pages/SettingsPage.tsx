import { useEffect, useState } from "react";
import { api, type StatsResponse } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { Film, DollarSign, CheckCircle, XCircle, BarChart3 } from "lucide-react";

const API_KEY_FIELDS = [
  { key: "ANTHROPIC_API_KEY", label: "Anthropic (LLM)" },
  { key: "OPENAI_API_KEY", label: "OpenAI (LLM/Image)" },
  { key: "GOOGLE_API_KEY", label: "Google Gemini (LLM/Image/Video)" },
  { key: "ELEVENLABS_API_KEY", label: "ElevenLabs (TTS)" },
  { key: "INWORLD_TTS_API_KEY", label: "Inworld (TTS)" },
  { key: "PEXELS_API_KEY", label: "Pexels (Stock)" },
  { key: "PIXABAY_API_KEY", label: "Pixabay (Stock)" },
];

interface HealthData {
  status: string;
  redis: string;
  keys?: Record<string, boolean>;
}

export function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    api
      .getHealth()
      .then((data) => setHealth(data as unknown as HealthData))
      .catch(() => {});
    api
      .getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const avgCost =
    stats && stats.completedJobs > 0
      ? stats.totalCost / stats.completedJobs
      : null;

  return (
    <div className="py-8 px-4 sm:px-10">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="max-w-[560px] flex flex-col gap-8">
        {/* Usage Statistics */}
        {stats && stats.totalJobs > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <BarChart3 className="size-4 text-muted-foreground" />
              Usage Statistics
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox
                icon={<Film className="size-4" />}
                label="Total Videos"
                value={String(stats.totalJobs)}
              />
              <StatBox
                icon={<CheckCircle className="size-4 text-status-success" />}
                label="Completed"
                value={String(stats.completedJobs)}
                color="text-status-success"
              />
              <StatBox
                icon={<XCircle className="size-4 text-destructive" />}
                label="Failed"
                value={String(stats.failedJobs)}
                color="text-destructive"
              />
              <StatBox
                icon={<DollarSign className="size-4 text-status-info" />}
                label="Total Spend"
                value={`$${stats.totalCost.toFixed(2)}`}
                color="text-status-info"
              />
            </div>
            {avgCost != null && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Average cost per video: ${avgCost.toFixed(2)}
              </p>
            )}
          </section>
        )}

        {/* System Status */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            System Status
          </h2>
          <div className="overflow-hidden rounded-[12px] border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[13px] text-text-subtle">API Server</span>
              <StatusDot
                ok={health?.status === "healthy"}
                label={
                  health
                    ? health.status === "healthy"
                      ? "Connected"
                      : health.status
                    : "Checking..."
                }
              />
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[13px] text-text-subtle">Redis Queue</span>
              <StatusDot
                ok={health?.redis === "connected"}
                label={
                  health
                    ? health.redis === "connected"
                      ? "Connected"
                      : health.redis
                    : "Checking..."
                }
              />
            </div>
          </div>
        </section>

        {/* API Keys */}
        <section>
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            API Keys
          </h2>
          <p className="mb-4 text-[13px] text-muted-foreground">
            API keys are configured server-side via environment variables.
          </p>
          <div className="overflow-hidden rounded-[12px] border border-border bg-card">
            {API_KEY_FIELDS.map((field, i) => {
              const isSet = health?.keys?.[field.key] ?? null;
              return (
                <div key={field.key}>
                  {i > 0 && <div className="border-t border-border" />}
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex flex-col gap-0.5">
                      <code className="font-mono text-[13px] text-text-subtle">
                        {field.key}
                      </code>
                      <span className="text-[11px] text-text-faint">{field.label}</span>
                    </div>
                    {isSet !== null ? (
                      <StatusDot
                        ok={isSet}
                        label={isSet ? "Set" : "Not set"}
                        colorOk="text-emerald-400"
                        colorBad="text-amber-400"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusDot({
  ok,
  label,
  colorOk = "text-emerald-400",
  colorBad = "text-destructive",
}: {
  ok: boolean;
  label: string;
  colorOk?: string;
  colorBad?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-sm font-medium",
        ok ? colorOk : colorBad,
      )}
    >
      <span
        className={cn(
          "inline-block size-2 rounded-full",
          ok ? "bg-emerald-400" : "bg-current",
        )}
      />
      {label}
    </span>
  );
}

function StatBox({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[10px] border border-border bg-card py-3 px-2">
      <div className="text-muted-foreground">{icon}</div>
      <span className={cn("text-lg font-bold", color ?? "text-foreground")}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
