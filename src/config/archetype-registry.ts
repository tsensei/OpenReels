import type { ArchetypeConfig } from "../schema/archetype.js";
import animeIllustration from "./archetypes/anime-illustration.json" with { type: "json" };
import boldIllustration from "./archetypes/bold-illustration.json" with { type: "json" };
import cinematicDocumentary from "./archetypes/cinematic-documentary.json" with { type: "json" };
import comicBook from "./archetypes/comic-book.json" with { type: "json" };
import editorialCaricature from "./archetypes/editorial-caricature.json" with { type: "json" };
import gothicFantasy from "./archetypes/gothic-fantasy.json" with { type: "json" };
import infographic from "./archetypes/infographic.json" with { type: "json" };
import moodyCinematic from "./archetypes/moody-cinematic.json" with { type: "json" };
import pastoralWatercolor from "./archetypes/pastoral-watercolor.json" with { type: "json" };
import studioRealism from "./archetypes/studio-realism.json" with { type: "json" };
import surrealDreamscape from "./archetypes/surreal-dreamscape.json" with { type: "json" };
import vintageSnapshot from "./archetypes/vintage-snapshot.json" with { type: "json" };
import warmEditorial from "./archetypes/warm-editorial.json" with { type: "json" };
import warmNarrative from "./archetypes/warm-narrative.json" with { type: "json" };

const ARCHETYPES: Record<string, ArchetypeConfig> = {
  editorial_caricature: editorialCaricature as ArchetypeConfig,
  warm_narrative: warmNarrative as ArchetypeConfig,
  studio_realism: studioRealism as ArchetypeConfig,
  infographic: infographic as ArchetypeConfig,
  anime_illustration: animeIllustration as ArchetypeConfig,
  pastoral_watercolor: pastoralWatercolor as ArchetypeConfig,
  comic_book: comicBook as ArchetypeConfig,
  gothic_fantasy: gothicFantasy as ArchetypeConfig,
  vintage_snapshot: vintageSnapshot as ArchetypeConfig,
  surreal_dreamscape: surrealDreamscape as ArchetypeConfig,
  warm_editorial: warmEditorial as ArchetypeConfig,
  cinematic_documentary: cinematicDocumentary as ArchetypeConfig,
  moody_cinematic: moodyCinematic as ArchetypeConfig,
  bold_illustration: boldIllustration as ArchetypeConfig,
};

export function getArchetype(name: string): ArchetypeConfig {
  const config = ARCHETYPES[name];
  if (!config) {
    throw new Error(`Unknown archetype: ${name}. Available: ${Object.keys(ARCHETYPES).join(", ")}`);
  }
  return config;
}

export function listArchetypes(): string[] {
  return Object.keys(ARCHETYPES);
}
