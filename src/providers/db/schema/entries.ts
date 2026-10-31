import { sql } from "drizzle-orm";
import {
    char,
    check,
    index,
    integer,
    pgTable,
    primaryKey,
    smallint,
    text,
    unique,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./columns";
import { aiTarget, entryCategory, entryKind, entryVisibility } from "./enums";
import { users } from "./users";

const isPublic = sql`visibility = 'public'`;

export const entries = pgTable(
    "entries",
    {
        id: id(),
        /**
         * URL key (/p/:slug). Public entries: slugified title. Unlisted and burn entries always end
         * in a random suffix so the link can't be guessed.
         */
        slug: varchar("slug", { length: 80 }).notNull().unique("entries_slug_key"),
        authorId: uuid("author_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        kind: entryKind("kind").notNull(),
        category: entryCategory("category").notNull(),
        visibility: entryVisibility("visibility").notNull().default("public"),
        title: varchar("title", { length: 90 }).notNull(),
        summary: varchar("summary", { length: 200 }).notNull().default(""),
        tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
        targets: aiTarget("targets").array().notNull(),
        /**
         * Lowercased, accent-folded title + summary + tags + author handle, written by the app on
         * every insert/update. Backs the `q` search filter.
         */
        searchText: text("search_text").notNull().default(""),
        /** Denormalized counters, updated in the same transaction as stars/uses/comments. */
        starsCount: integer("stars_count").notNull().default(0),
        usesCount: integer("uses_count").notNull().default(0),
        commentsCount: integer("comments_count").notNull().default(0),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        check("entries_slug_format", sql`slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
        check("entries_title_length", sql`char_length(btrim(title)) >= 4`),
        check("entries_tags_max", sql`cardinality(tags) <= 8`),
        check("entries_targets_min", sql`cardinality(targets) >= 1`),
        check(
            "entries_counters_non_negative",
            sql`stars_count >= 0 AND uses_count >= 0 AND comments_count >= 0`,
        ),
        index("entries_author_updated_idx").on(t.authorId, t.updatedAt.desc()),
        index("entries_public_updated_idx").on(t.updatedAt.desc(), t.id.desc()).where(isPublic),
        index("entries_public_stars_idx").on(t.starsCount.desc(), t.id.desc()).where(isPublic),
        index("entries_public_uses_idx").on(t.usesCount.desc(), t.id.desc()).where(isPublic),
        index("entries_public_kind_idx").on(t.kind, t.updatedAt.desc()).where(isPublic),
        index("entries_public_category_idx").on(t.category, t.updatedAt.desc()).where(isPublic),
        index("entries_tags_idx").using("gin", t.tags),
        index("entries_targets_idx").using("gin", t.targets),
    ],
);

/**
 * Files of an entry. Metadata lives here; the content is stored through the storage provider
 * (local `uploads/` folder for now) under `storage_key`. Position 0 is the main file.
 */
export const entryFiles = pgTable(
    "entry_files",
    {
        id: id(),
        entryId: uuid("entry_id")
            .notNull()
            .references(() => entries.id, { onDelete: "cascade" }),
        position: smallint("position").notNull(),
        /** Relative POSIX path inside the project where the file gets installed. */
        path: varchar("path", { length: 255 }).notNull(),
        storageKey: varchar("storage_key", { length: 512 }).notNull().unique("entry_files_storage_key_key"),
        sizeBytes: integer("size_bytes").notNull(),
        /** SHA-256 (hex) of the stored content. */
        sha256: char("sha256", { length: 64 }).notNull(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        unique("entry_files_entry_position_key").on(t.entryId, t.position),
        unique("entry_files_entry_path_key").on(t.entryId, t.path),
        check("entry_files_position_range", sql`"position" BETWEEN 0 AND 11`),
        check("entry_files_size_range", sql`size_bytes BETWEEN 1 AND 200000`),
    ],
);

export const stars = pgTable(
    "stars",
    {
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        entryId: uuid("entry_id")
            .notNull()
            .references(() => entries.id, { onDelete: "cascade" }),
        createdAt: createdAt(),
    },
    (t) => [
        primaryKey({ name: "stars_pkey", columns: [t.userId, t.entryId] }),
        index("stars_entry_id_idx").on(t.entryId),
        index("stars_user_created_idx").on(t.userId, t.createdAt.desc()),
    ],
);

/** Guestbook ("Libro de visitas") messages on an entry. */
export const comments = pgTable(
    "comments",
    {
        id: id(),
        entryId: uuid("entry_id")
            .notNull()
            .references(() => entries.id, { onDelete: "cascade" }),
        authorId: uuid("author_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        message: varchar("message", { length: 500 }).notNull(),
        createdAt: createdAt(),
    },
    (t) => [
        check("comments_message_not_blank", sql`char_length(btrim(message)) >= 1`),
        index("comments_entry_created_idx").on(t.entryId, t.createdAt.desc(), t.id.desc()),
    ],
);
