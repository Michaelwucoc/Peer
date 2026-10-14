import { z } from "zod";

/**
 * Landing-page block model — the schema, types, and pure helpers. **Client-safe:** no `~/server`
 * import, so the in-browser editor can use these directly (the server loader `getLandingLayout`
 * lives in `~/server/home/blocks.ts`).
 *
 * The page is an ordered list of blocks:
 *   • System blocks (HERO / FEATURES / SECTIONS / NEWS) carry no inline data — they render the
 *     curated pieces whose content is edited in their own tabs. The block only controls position.
 *   • Content blocks (RICH_TEXT / IMAGE / BUTTONS / COLUMNS) store their own data inline; localized
 *     text is a `{ locale: value }` map with `en` fallback; non-text props are shared across locales.
 */

export const LANDING_OWNER = "landing";

const localized = z.record(z.string());

/**
 * A button destination is an in-app path, a fragment, or an absolute `http(s)`/`mailto`
 * link. A non-`/`-prefixed value reaches a raw `<a href>`, so a stored `javascript:`
 * (or `data:`) value would run in a visitor's origin when clicked. A blank value is a
 * destination-less button: keep it out of the renderer, but let the editor save a
 * half-filled row.
 */
export function isSafeButtonHref(value: string): boolean {
  const href = value.trim();
  if (!href) return false;
  if (href.startsWith("/") || href.startsWith("#")) return true;
  return /^(?:https?:|mailto:)/i.test(href);
}

/** The stored contract is stricter than the renderer: a blank row must stay saveable. */
function isStorableButtonHref(value: string): boolean {
  return value.trim() === "" || isSafeButtonHref(value);
}

const buttonSchema = z.object({
  label: localized,
  href: z.string().max(2000).refine(isStorableButtonHref, {
    message: "Button link must be an in-app path or an http(s)/mailto URL.",
  }),
  style: z.enum(["primary", "secondary"]),
});

// Leaf (content) blocks — valid both at the top level and inside a COLUMNS block.
const richTextSchema = z.object({
  id: z.string(),
  type: z.literal("RICH_TEXT"),
  align: z.enum(["left", "center"]).optional(),
  text: localized,
});
const imageSchema = z.object({
  id: z.string(),
  type: z.literal("IMAGE"),
  imageId: z.string(),
  width: z.enum(["narrow", "wide", "full"]).optional(),
  caption: localized.optional(),
});
const buttonsSchema = z.object({
  id: z.string(),
  type: z.literal("BUTTONS"),
  align: z.enum(["left", "center"]).optional(),
  buttons: z.array(buttonSchema).max(6),
});

const leafSchema = z.discriminatedUnion("type", [richTextSchema, imageSchema, buttonsSchema]);

// COLUMNS lays leaf blocks out in 2–4 columns (one level of nesting; no columns-in-columns).
const columnsSchema = z.object({
  id: z.string(),
  type: z.literal("COLUMNS"),
  /** Render each column as a card (for a card-grid look). */
  card: z.boolean().optional(),
  columns: z.array(z.array(leafSchema)).min(1).max(4),
});

const blockSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("HERO") }),
  z.object({ id: z.string(), type: z.literal("FEATURES") }),
  z.object({ id: z.string(), type: z.literal("SECTIONS") }),
  z.object({ id: z.string(), type: z.literal("NEWS") }),
  richTextSchema,
  imageSchema,
  buttonsSchema,
  columnsSchema,
]);

export const layoutSchema = z.array(blockSchema).max(100);
export type Block = z.infer<typeof blockSchema>;
/** A leaf content block (no system blocks, no nested columns). */
export type LeafBlock = z.infer<typeof leafSchema>;
export type BlockType = Block["type"];

export const SYSTEM_BLOCK_TYPES = ["HERO", "FEATURES", "SECTIONS", "NEWS"] as const;
export const CONTENT_BLOCK_TYPES = ["RICH_TEXT", "IMAGE", "BUTTONS"] as const;

export function isSystemBlock(type: BlockType): boolean {
  return (SYSTEM_BLOCK_TYPES as readonly string[]).includes(type);
}

/** The out-of-the-box page: the curated pieces in their original order. */
export const DEFAULT_LAYOUT: Block[] = [
  { id: "hero", type: "HERO" },
  { id: "features", type: "FEATURES" },
  { id: "sections", type: "SECTIONS" },
  { id: "news", type: "NEWS" },
];

/** A localized text field resolved for a locale (en fallback, then any value). */
export function pickLocalized(map: Record<string, string> | undefined, locale: string): string {
  if (!map) return "";
  return map[locale] ?? map.en ?? Object.values(map)[0] ?? "";
}
