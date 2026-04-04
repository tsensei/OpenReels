import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Archetype, api, type Platform, type ProviderOptions } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  MonitorPlay,
  Palette,
  SlidersHorizontal,
  Lightbulb,
} from "lucide-react";

const SUGGESTIONS = [
  "Black holes explained",
  "How coffee changed history",
  "5 facts about the deep ocean",
  "Ancient Rome",
];

export function HomePage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [archetype, setArchetype] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [llmProvider, setLlmProvider] = useState("anthropic");
  const [ttsProvider, setTtsProvider] = useState("elevenlabs");
  const [imageProvider, setImageProvider] = useState("gemini");
  const [musicProvider, setMusicProvider] = useState("bundled");
  const [pacing, setPacing] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [providers, setProviders] = useState<ProviderOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listArchetypes().then(setArchetypes).catch(() => {});
    api.listPlatforms().then(setPlatforms).catch(() => {});
    api.listProviders().then(setProviders).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      const result = await api.createJob({
        topic: topic.trim(),
        archetype: archetype || undefined,
        pacing: pacing || undefined,
        platform,
        dryRun,
        providers: {
          llm: llmProvider,
          tts: ttsProvider,
          image: imageProvider,
          music: musicProvider,
        },
      });
      navigate(`/jobs/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
      setLoading(false);
    }
  };

  const hasTopic = topic.trim().length > 0;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 sm:px-10 lg:px-[100px]">
      <div className="flex flex-col items-center gap-9">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-4xl font-bold" style={{ letterSpacing: "-1px" }}>
            What story should we tell?
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Describe a topic and we'll turn it into a fully rendered Short.
          </p>
        </div>

        {/* Input Card */}
        <form onSubmit={handleSubmit} className="w-full max-w-[660px]">
          <div
            className={cn(
              "rounded-[14px] border bg-card px-6 py-5 transition-all",
              hasTopic
                ? "border-primary/40 shadow-[0_0_24px_-4px] shadow-primary/20"
                : "border-[#334155]"
            )}
          >
            {/* Topic Input */}
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={200}
              placeholder="The science of black holes, how coffee changed history..."
              className="w-full bg-transparent text-[15px] text-foreground placeholder:text-[#475569] focus:outline-none"
            />

            {/* Controls Row */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {/* Platform selector */}
              <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
                <SelectTrigger size="sm" className="h-auto gap-1.5 rounded-[8px] border-[#334155] bg-transparent px-3 py-1.5 text-xs font-medium text-[#94A3B8]">
                  <MonitorPlay className="size-3.5 text-[#64748B]" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name.charAt(0).toUpperCase() + p.name.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Style selector */}
              <Select value={archetype} onValueChange={(v) => setArchetype(v ?? "")}>
                <SelectTrigger size="sm" className="h-auto gap-1.5 rounded-[8px] border-[#334155] bg-transparent px-3 py-1.5 text-xs font-medium text-[#94A3B8]">
                  <Palette className="size-3.5 text-[#64748B]" />
                  <SelectValue placeholder="Auto Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Auto Style</SelectItem>
                  {archetypes.map((a) => (
                    <SelectItem key={a.name} value={a.name}>
                      {a.name
                        .split(/[-_]/)
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Pacing selector */}
              <Select value={pacing} onValueChange={(v) => setPacing(v ?? "")}>
                <SelectTrigger size="sm" className="h-auto gap-1.5 rounded-[8px] border-[#334155] bg-transparent px-3 py-1.5 text-xs font-medium text-[#94A3B8]">
                  <SlidersHorizontal className="size-3.5 text-[#64748B]" />
                  <SelectValue placeholder="Auto Pace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Auto Pace</SelectItem>
                  <SelectItem value="fast">Fast</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="cinematic">Cinematic</SelectItem>
                </SelectContent>
              </Select>

              {/* Advanced toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  "flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs font-medium transition-colors",
                  showAdvanced
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-[#334155] bg-transparent text-[#94A3B8] hover:text-foreground"
                )}
              >
                <SlidersHorizontal className="size-3.5 text-[#64748B]" />
                Advanced
              </button>

              {/* Spacer + Generate */}
              <div className="ml-auto">
                <Button
                  type="submit"
                  disabled={!hasTopic || loading}
                  className="gap-2 rounded-[10px] px-6 py-2.5 text-sm font-semibold"
                >
                  {loading ? "Generating..." : "Generate"}
                  {!loading && <ArrowRight className="size-4" />}
                </Button>
              </div>
            </div>

            {/* Advanced Options Panel */}
            {showAdvanced && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      LLM Provider
                    </label>
                    <Select value={llmProvider} onValueChange={(v) => v && setLlmProvider(v)}>
                      <SelectTrigger className="h-9 w-full rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providers?.llm.map((p) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      TTS Provider
                    </label>
                    <Select value={ttsProvider} onValueChange={(v) => v && setTtsProvider(v)}>
                      <SelectTrigger className="h-9 w-full rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providers?.tts.map((p) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Image Provider
                    </label>
                    <Select value={imageProvider} onValueChange={(v) => v && setImageProvider(v)}>
                      <SelectTrigger className="h-9 w-full rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providers?.image.map((p) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Music Provider
                    </label>
                    <Select value={musicProvider} onValueChange={(v) => v && setMusicProvider(v)}>
                      <SelectTrigger className="h-9 w-full rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bundled">Bundled (free)</SelectItem>
                        <SelectItem value="lyria">Lyria 3 Pro ($0.08)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dry Run */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Dry Run</span>
                  <div className="flex items-center gap-2">
                    <Switch checked={dryRun} onCheckedChange={setDryRun} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {dryRun ? "On" : "Off"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </form>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTopic(s)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#334155] bg-[#1E293B80] px-3.5 py-1.5 text-xs font-normal text-[#94A3B8] transition-colors hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
            >
              <Lightbulb className="size-3.5 text-primary" />
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
