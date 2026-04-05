import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const ARCHETYPES_DIR = path.resolve(
	import.meta.dirname,
	"../../src/config/archetypes",
);

const REQUIRED_FIELDS = [
	"colorPalette",
	"artStyle",
	"lighting",
	"captionStyle",
	"defaultTransition",
	"transitionDurationFrames",
	"motionIntensity",
	"textCardFont",
	"compositionRules",
	"mood",
	"visualColorPalette",
] as const;

const COLOR_PALETTE_FIELDS = ["background", "accent", "text"] as const;

function getArchetypeFiles() {
	return fs
		.readdirSync(ARCHETYPES_DIR)
		.filter((f) => f.endsWith(".json"))
		.map((f) => ({
			name: f.replace(".json", ""),
			path: path.join(ARCHETYPES_DIR, f),
		}));
}

describe("archetype configs", () => {
	const archetypes = getArchetypeFiles();

	it("should have exactly 14 archetypes", () => {
		expect(archetypes).toHaveLength(14);
	});

	for (const archetype of archetypes) {
		describe(archetype.name, () => {
			const config = JSON.parse(fs.readFileSync(archetype.path, "utf-8"));

			for (const field of REQUIRED_FIELDS) {
				it(`has required field: ${field}`, () => {
					expect(config).toHaveProperty(field);
				});
			}

			it("has valid colorPalette with background, accent, and text", () => {
				expect(config.colorPalette).toBeDefined();
				for (const field of COLOR_PALETTE_FIELDS) {
					expect(config.colorPalette[field]).toBeDefined();
					expect(config.colorPalette[field]).toMatch(/^#[0-9a-fA-F]{3,8}$/);
				}
			});

			it("has a non-empty artStyle string", () => {
				expect(typeof config.artStyle).toBe("string");
				expect(config.artStyle.length).toBeGreaterThan(10);
			});

			it("has motionIntensity between 0.5 and 3", () => {
				expect(config.motionIntensity).toBeGreaterThanOrEqual(0.5);
				expect(config.motionIntensity).toBeLessThanOrEqual(3);
			});

			it("has visualColorPalette as non-empty array", () => {
				expect(Array.isArray(config.visualColorPalette)).toBe(true);
				expect(config.visualColorPalette.length).toBeGreaterThan(0);
			});
		});
	}
});

describe("sync script output", () => {
	const SYNCED_DIR = path.resolve(import.meta.dirname, "../src/data/archetypes");

	const hasSyncedDir = fs.existsSync(SYNCED_DIR);

	it.skipIf(!hasSyncedDir)("synced directory has all 14 archetype JSONs", () => {
		const syncedFiles = fs
			.readdirSync(SYNCED_DIR)
			.filter((f) => f.endsWith(".json"));
		expect(syncedFiles).toHaveLength(14);
	});

	it.skipIf(!hasSyncedDir)("barrel file exports all archetypes", () => {
		const indexPath = path.join(SYNCED_DIR, "index.ts");
		expect(fs.existsSync(indexPath)).toBe(true);

		const content = fs.readFileSync(indexPath, "utf-8");
		expect(content).toContain("export const archetypes");
		expect(content).toContain("warm_narrative");
		expect(content).toContain("editorial_caricature");
	});
});
