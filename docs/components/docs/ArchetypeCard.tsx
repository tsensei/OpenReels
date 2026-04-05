import type { ArchetypeConfig } from "@/src/data/archetypes";

interface ArchetypeCardProps {
	slug: string;
	name: string;
	config: ArchetypeConfig;
}

const BEST_FOR: Record<string, string> = {
	"editorial-caricature": "News commentary, satire, social issues",
	"warm-narrative": "Storytelling, history, human interest",
	"studio-realism": "Professional photography, editorial, luxury",
	infographic: "Data, facts, explainers, rapid-fire content",
	"anime-illustration": "Dynamic, action-oriented, pop culture",
	"pastoral-watercolor": "Nature, contemplative, hand-painted aesthetic",
	"comic-book": "Action, adventure, energetic content",
	"gothic-fantasy": "Dark themes, mythology, epic content",
	"vintage-snapshot": "Nostalgic, intimate, personal stories",
	"surreal-dreamscape": "Sci-fi, fantasy, mind-bending topics",
	"warm-editorial": "Lifestyle, people stories, general purpose",
	"cinematic-documentary": "Factual, historical, science",
	"moody-cinematic": "Mystery, tension, crime, dark history",
	"bold-illustration": "Educational, how-to, listicles",
};

export function ArchetypeCard({ slug, name, config }: ArchetypeCardProps) {
	const palette = config.colorPalette;

	return (
		<a
			href={`/docs/archetypes/${slug}`}
			className="group block overflow-hidden rounded-lg border border-neutral-200 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
		>
			{/* Color preview bar */}
			<div className="flex h-3">
				<div
					className="flex-1"
					style={{ backgroundColor: palette.background }}
				/>
				<div
					className="flex-1"
					style={{ backgroundColor: palette.accent }}
				/>
				<div
					className="flex-1"
					style={{ backgroundColor: palette.text }}
				/>
			</div>

			{/* Thumbnail */}
			<div className="aspect-video bg-neutral-100 dark:bg-neutral-900">
				<img
					src={`/gallery/${slug}/thumbnail.webp`}
					alt={`${name} archetype example`}
					className="h-full w-full object-cover"
					loading="lazy"
					onError={(e) => {
						(e.target as HTMLImageElement).style.display = "none";
					}}
				/>
			</div>

			{/* Info */}
			<div className="p-4">
				<h3 className="font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">
					{name}
				</h3>
				<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
					{BEST_FOR[slug] ?? config.mood}
				</p>
				<p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
					{config.captionStyle.replace(/_/g, " ")} ·{" "}
					{config.scenePacing} pacing
				</p>
			</div>
		</a>
	);
}
