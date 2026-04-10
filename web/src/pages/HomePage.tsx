import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Archetype, api, type Platform, type ProviderOptions } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Gauge,
  MonitorPlay,
  SlidersHorizontal,
  Lightbulb,
  Shuffle,
} from "lucide-react";
import { ArchetypeCard } from "@/components/ArchetypeCard";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const TOPIC_CATEGORIES: Record<string, string[]> = {
  History: [
    "How coffee changed history",
    "Ancient Rome's greatest inventions",
    "The fall of the Berlin Wall",
    "5 forgotten civilizations",
  ],
  Science: [
    "Black holes explained",
    "Why do we dream?",
    "CRISPR gene editing in 2026",
    "The science of time perception",
  ],
  Culture: [
    "How anime conquered the world",
    "The psychology of music",
    "Street food capitals of the world",
    "Why we love horror movies",
  ],
  Technology: [
    "Top 5 AI advancements in 2026",
    "How quantum computing works",
    "The future of space tourism",
    "Inside a data center",
  ],
};

const CATEGORY_KEYS = Object.keys(TOPIC_CATEGORIES);

const DISPLAY_NAMES: Record<string, string> = {
  // Platforms
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  // LLM
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  "openai-compatible": "Custom (OpenAI-compatible)",
  // TTS
  elevenlabs: "ElevenLabs",
  inworld: "Inworld",
  kokoro: "Kokoro (Local)",
  "gemini-tts": "Gemini TTS",
  "openai-tts": "OpenAI TTS",
  // Image
  // gemini/openai already covered above
  // Music
  bundled: "Bundled (Free)",
  lyria: "Lyria 3 Pro",
  // Video
  fal: "fal.ai (Kling)",
};

function displayName(key: string): string {
  return DISPLAY_NAMES[key] ?? key;
}

export function HomePage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [archetype, setArchetype] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [llmProvider, setLlmProvider] = useState("anthropic");
  const [llmModel, setLlmModel] = useState("");
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [searchProvider, setSearchProvider] = useState("");
  const [ttsProvider, setTtsProvider] = useState("elevenlabs");
  const [imageProvider, setImageProvider] = useState("gemini");
  const [musicProvider, setMusicProvider] = useState("bundled");
  const [pacing, setPacing] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [directionText, setDirectionText] = useState("");
  const [scoreJson, setScoreJson] = useState<Record<string, unknown> | null>(null);
  const [scoreFileName, setScoreFileName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [providers, setProviders] = useState<ProviderOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Topic inspiration
  const [activeCategory, setActiveCategory] = useState(CATEGORY_KEYS[0]!);
  const [shuffledTopics, setShuffledTopics] = useState<string[]>([]);

  useEffect(() => {
    api.listArchetypes().then(setArchetypes).catch(() => {});
    api.listPlatforms().then(setPlatforms).catch(() => {});
    api.listProviders().then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    setShuffledTopics(TOPIC_CATEGORIES[activeCategory] ?? []);
  }, [activeCategory]);

  const handleShuffle = () => {
    setShuffledTopics((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

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
        ...(directionText.trim() ? { direction: directionText.trim() } : {}),
        ...(scoreJson ? { score: scoreJson } : {}),
        providers: {
          llm: llmProvider,
          tts: ttsProvider,
          image: imageProvider,
          music: musicProvider,
          ...(llmModel ? { llmModel } : {}),
          ...(llmBaseUrl ? { llmBaseUrl } : {}),
          ...(searchProvider ? { searchProvider } : {}),
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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 sm:px-6 lg:px-24 py-8">
      <div className="flex w-full max-w-[720px] flex-col items-center gap-8">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            What story should we tell?
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Describe a topic and we'll turn it into a fully rendered Short.
          </p>
        </div>

        {/* Input Card */}
        <form onSubmit={handleSubmit} className="w-full">
          <div
            className={cn(
              "rounded-[14px] border bg-card px-5 sm:px-6 py-5 transition-all",
              hasTopic
                ? "border-primary/40 shadow-glow-md shadow-primary/20"
                : "border-border",
            )}
          >
            {/* Topic Input */}
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={200}
              placeholder="The science of black holes, how coffee changed history..."
              className="w-full bg-transparent text-[15px] text-foreground placeholder:text-text-faint focus:outline-none"
            />

            {/* Controls Row */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {/* Platform selector */}
              <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
                <SelectTrigger
                  size="sm"
                  className="h-auto gap-1.5 rounded-[8px] border-border bg-transparent px-3 py-1.5 text-xs font-medium text-text-subtle"
                >
                  <MonitorPlay className="size-3.5 text-muted-foreground" />
                  <SelectValue>{displayName(platform)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {displayName(p.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Pacing selector */}
              <Select value={pacing} onValueChange={(v) => setPacing(v ?? "")}>
                <SelectTrigger
                  size="sm"
                  className="h-auto gap-1.5 rounded-[8px] border-border bg-transparent px-3 py-1.5 text-xs font-medium text-text-subtle"
                >
                  <Gauge className="size-3.5 text-muted-foreground" />
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
                    : "border-border bg-transparent text-text-subtle hover:text-foreground",
                )}
              >
                <SlidersHorizontal className="size-3.5 text-muted-foreground" />
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      LLM Provider
                    </label>
                    <Select value={llmProvider} onValueChange={(v) => v && setLlmProvider(v)}>
                      <SelectTrigger className="h-9 w-full rounded-lg">
                        <SelectValue>{displayName(llmProvider)}</SelectValue>
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
                        <SelectValue>{displayName(ttsProvider)}</SelectValue>
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
                        <SelectValue>{displayName(imageProvider)}</SelectValue>
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
                        <SelectValue>{displayName(musicProvider)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bundled">Bundled (Free)</SelectItem>
                        <SelectItem value="lyria">Lyria 3 Pro ($0.08)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Conditional LLM config fields */}
                  {(llmProvider === "openrouter" || llmProvider === "openai-compatible") && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Model ID
                      </label>
                      <Input
                        className="h-9 rounded-lg text-sm"
                        placeholder={llmProvider === "openrouter" ? "anthropic/claude-sonnet-4" : "llama3:8b"}
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value)}
                      />
                    </div>
                  )}

                  {llmProvider === "openai-compatible" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Base URL
                      </label>
                      <Input
                        className="h-9 rounded-lg text-sm"
                        placeholder="http://localhost:11434/v1"
                        value={llmBaseUrl}
                        onChange={(e) => setLlmBaseUrl(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Search Provider
                    </label>
                    <Select value={searchProvider} onValueChange={(v) => setSearchProvider(v ?? "")}>
                      <SelectTrigger className="h-9 w-full rounded-lg">
                        <SelectValue placeholder="Auto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Auto</SelectItem>
                        {providers?.search?.map((p) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Archetype fallback dropdown in Advanced */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Style Override
                    </label>
                    <Select value={archetype} onValueChange={(v) => setArchetype(v ?? "")}>
                      <SelectTrigger className="h-9 w-full rounded-lg">
                        <SelectValue placeholder="Auto" />
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

                {/* Direction & Replay */}
                <div className="mt-4 border-t border-border pt-4 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Creative Direction
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-primary/40 resize-y min-h-[60px]"
                      placeholder="Describe your creative vision: visual style, mood, script notes, scene ideas, music preference..."
                      value={directionText}
                      onChange={(e) => {
                        const bytes = new TextEncoder().encode(e.target.value).length;
                        if (bytes <= 10240) setDirectionText(e.target.value);
                      }}
                      rows={3}
                    />
                    <p className="mt-1 text-right text-[10px] text-muted-foreground">
                      {new TextEncoder().encode(directionText).length.toLocaleString()} / 10,240 bytes
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Replay from Score
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".json"
                        className="h-9 rounded-lg text-sm file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) {
                            setScoreJson(null);
                            setScoreFileName("");
                            return;
                          }
                          try {
                            const text = await file.text();
                            setScoreJson(JSON.parse(text));
                            setScoreFileName(file.name);
                          } catch {
                            setError("Invalid JSON in score file");
                            setScoreJson(null);
                            setScoreFileName("");
                          }
                        }}
                      />
                      {scoreFileName && (
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {scoreFileName}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Load a previous score.json to skip research &amp; director stages
                    </p>
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

        {/* Archetype Gallery */}
        {archetypes.length > 0 && (
          <div className="w-full">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[1.5px] text-muted-foreground">
              Visual Style
            </h3>
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-3">
                {/* Auto Style card */}
                <ArchetypeCard
                  archetype={null}
                  selected={archetype === ""}
                  onClick={() => setArchetype("")}
                />
                {archetypes.map((a) => (
                  <ArchetypeCard
                    key={a.name}
                    archetype={a}
                    selected={archetype === a.name}
                    onClick={() => setArchetype(a.name)}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}

        {/* Topic Inspiration */}
        <div className="w-full">
          <div className="mb-3 flex items-center gap-3">
            {CATEGORY_KEYS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {cat}
              </button>
            ))}
            <button
              type="button"
              onClick={handleShuffle}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Shuffle className="size-3" />
              Shuffle
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {shuffledTopics.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTopic(s)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3.5 py-1.5 text-xs font-normal text-text-subtle transition-colors hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
              >
                <Lightbulb className="size-3.5 text-primary" />
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
