import { describe, expect, it } from "vitest";
import { getArchetype, listArchetypes } from "./archetype-registry.js";

describe("listArchetypes", () => {
  it("returns all 14 archetype names", () => {
    const names = listArchetypes();
    expect(names).toHaveLength(14);
    expect(names).toContain("editorial_caricature");
    expect(names).toContain("warm_narrative");
    expect(names).toContain("studio_realism");
    expect(names).toContain("infographic");
    expect(names).toContain("anime_illustration");
    expect(names).toContain("pastoral_watercolor");
    expect(names).toContain("comic_book");
    expect(names).toContain("gothic_fantasy");
    expect(names).toContain("vintage_snapshot");
    expect(names).toContain("surreal_dreamscape");
    expect(names).toContain("warm_editorial");
    expect(names).toContain("cinematic_documentary");
    expect(names).toContain("moody_cinematic");
    expect(names).toContain("bold_illustration");
  });
});

describe("getArchetype", () => {
  it("returns a valid config for a known archetype", () => {
    const config = getArchetype("editorial_caricature");
    expect(config.captionStyle).toBe("bold_outline");
    expect(config.colorPalette).toHaveProperty("background");
    expect(config.colorPalette).toHaveProperty("accent");
    expect(config.colorPalette).toHaveProperty("text");
    expect(config.textCardFont).toBeTruthy();
    expect(typeof config.motionIntensity).toBe("number");
    expect(config.artStyle).toBeTruthy();
    expect(config.visualColorPalette).toBeInstanceOf(Array);
    expect(config.visualColorPalette.length).toBe(5);
  });

  it("has a valid scenePacing tier for all archetypes", () => {
    const validTiers = ["fast", "moderate", "cinematic"];
    for (const name of listArchetypes()) {
      const config = getArchetype(name);
      expect(validTiers).toContain(config.scenePacing);
    }
  });

  it("classifies archetypes into expected tiers", () => {
    expect(getArchetype("infographic").scenePacing).toBe("fast");
    expect(getArchetype("bold_illustration").scenePacing).toBe("fast");
    expect(getArchetype("comic_book").scenePacing).toBe("fast");
    expect(getArchetype("editorial_caricature").scenePacing).toBe("moderate");
    expect(getArchetype("warm_editorial").scenePacing).toBe("moderate");
    expect(getArchetype("cinematic_documentary").scenePacing).toBe("cinematic");
    expect(getArchetype("warm_narrative").scenePacing).toBe("cinematic");
  });

  it("has valid transition defaults for all archetypes", () => {
    const validTransitions = ["none", "crossfade", "slide_left", "slide_right", "wipe", "flip"];
    for (const name of listArchetypes()) {
      const config = getArchetype(name);
      expect(validTransitions).toContain(config.defaultTransition);
      expect(config.transitionDurationFrames).toBeGreaterThanOrEqual(5);
      expect(config.transitionDurationFrames).toBeLessThanOrEqual(30);
    }
  });

  it("throws for an unknown archetype", () => {
    expect(() => getArchetype("nonexistent")).toThrowError(/Unknown archetype/);
    expect(() => getArchetype("nonexistent")).toThrowError(/Available/);
  });

  it("returns distinct configs for different archetypes", () => {
    const a = getArchetype("editorial_caricature");
    const b = getArchetype("infographic");
    expect(a.captionStyle).not.toBe(b.captionStyle);
    expect(a.artStyle).not.toBe(b.artStyle);
  });
});
