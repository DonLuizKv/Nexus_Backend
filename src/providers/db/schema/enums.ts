import { pgEnum } from "drizzle-orm/pg-core";

// Values mirror the frontend catalog (Nexus/src/lib/entries/catalog.ts). Labels are localized
// on the client; the API only exchanges these ids.

export const ENTRY_KINDS = ["prompt", "skill", "agent", "settings", "context"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const entryKind = pgEnum("entry_kind", ENTRY_KINDS);

/** public: listed and searchable. unlisted: link only. burn: link works once, then the entry is deleted. */
export const ENTRY_VISIBILITIES = ["public", "unlisted", "burn"] as const;
export type EntryVisibility = (typeof ENTRY_VISIBILITIES)[number];
export const entryVisibility = pgEnum("entry_visibility", ENTRY_VISIBILITIES);

export const ENTRY_CATEGORIES = ["escritura", "codigo", "imagen", "datos", "aprendizaje", "negocio"] as const;
export type EntryCategory = (typeof ENTRY_CATEGORIES)[number];
export const entryCategory = pgEnum("entry_category", ENTRY_CATEGORIES);

/** Chat models and coding tools an entry can target ("Funciona con"). */
export const AI_TARGETS = [
    "chatgpt",
    "claude",
    "gemini",
    "llama",
    "midjourney",
    "claude-code",
    "cursor",
    "kiro",
    "copilot",
    "codex",
] as const;
export type AiTarget = (typeof AI_TARGETS)[number];
export const aiTarget = pgEnum("ai_target", AI_TARGETS);
