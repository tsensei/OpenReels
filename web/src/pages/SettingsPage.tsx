import { useEffect, useState } from "react";
import { api } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

const API_KEY_FIELDS = [
  { key: "ANTHROPIC_API_KEY", label: "Anthropic (LLM)" },
  { key: "ELEVENLABS_API_KEY", label: "ElevenLabs (TTS)" },
  { key: "GEMINI_API_KEY", label: "Google Gemini (Image)" },
  { key: "PEXELS_API_KEY", label: "Pexels (Stock)" },
];

interface HealthData {
  status: string;
  redis: string;
  keys?: Record<string, boolean>;
}

export function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    api
      .getHealth()
      .then((data) => setHealth(data as unknown as HealthData))
      .catch(() => {});
  }, []);

  return (
    <div className="py-8 px-10">
      <h1 className="mb-8 text-2xl font-bold">Settings</h1>

      <div className="max-w-[560px]">
        {/* System Status */}
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold text-[#E2E8F0]">
            System Status
          </h2>
          <div className="overflow-hidden rounded-[12px] border border-[#334155] bg-[#1E293B]">
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[13px] text-[#94A3B8]">API Server</span>
              <StatusDot
                ok={health?.status === "healthy"}
                label={health ? (health.status === "healthy" ? "Connected" : health.status) : "Checking..."}
              />
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[13px] text-[#94A3B8]">Redis Queue</span>
              <StatusDot
                ok={health?.redis === "connected"}
                label={health ? (health.redis === "connected" ? "Connected" : health.redis) : "Checking..."}
              />
            </div>
          </div>
        </section>

        {/* API Keys */}
        <section>
          <h2 className="mb-1 text-sm font-semibold text-[#E2E8F0]">
            API Keys
          </h2>
          <p className="mb-4 text-[13px] text-[#64748B]">
            API keys are configured server-side via environment variables.
          </p>
          <div className="overflow-hidden rounded-[12px] border border-[#334155] bg-[#1E293B]">
            {API_KEY_FIELDS.map((field, i) => {
              const isSet = health?.keys?.[field.key] ?? null;
              return (
                <div key={field.key}>
                  {i > 0 && <div className="border-t border-border" />}
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <code className="font-mono text-[13px] text-[#94A3B8]">{field.key}</code>
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
    <span className={cn("flex items-center gap-2 text-sm font-medium", ok ? colorOk : colorBad)}>
      <span
        className={cn(
          "inline-block size-2 rounded-full",
          ok ? "bg-emerald-400" : "bg-current"
        )}
      />
      {label}
    </span>
  );
}
