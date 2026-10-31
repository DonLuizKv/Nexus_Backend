import { sql } from "drizzle-orm";
import { type AnyPgColumn, char, check, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./columns";

export const users = pgTable(
    "users",
    {
        id: id(),
        /** Public username used in URLs (/u/:handle). Lowercase, immutable. */
        handle: varchar("handle", { length: 20 }).notNull().unique("users_handle_key"),
        /** Stored lowercase. Never returned except to its owner. */
        email: varchar("email", { length: 254 }).notNull().unique("users_email_key"),
        /** argon2id hash. */
        passwordHash: text("password_hash").notNull(),
        name: varchar("name", { length: 60 }).notNull(),
        bio: varchar("bio", { length: 160 }).notNull().default(""),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    () => [
        check("users_handle_format", sql`handle ~ '^[a-z0-9._-]{3,20}$'`),
        check("users_email_lowercase", sql`email = lower(email)`),
        check("users_name_not_blank", sql`char_length(btrim(name)) >= 1`),
    ],
);

/**
 * One row per issued refresh token. Rotation: every refresh revokes the current row and points
 * `replaced_by_id` to the new one. Reusing a rotated token within the grace window (successor still
 * unrevoked) issues another token in the same family; any other reuse revokes the whole `family_id`.
 */
export const refreshTokens = pgTable(
    "refresh_tokens",
    {
        id: id(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        familyId: uuid("family_id").notNull(),
        /** SHA-256 (hex) of the token; the token itself is never stored. */
        tokenHash: char("token_hash", { length: 64 }).notNull().unique("refresh_tokens_token_hash_key"),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        revokedAt: timestamp("revoked_at", { withTimezone: true }),
        replacedById: uuid("replaced_by_id").references((): AnyPgColumn => refreshTokens.id, {
            onDelete: "set null",
        }),
        userAgent: varchar("user_agent", { length: 256 }),
        ip: varchar("ip", { length: 45 }),
        createdAt: createdAt(),
    },
    (t) => [
        index("refresh_tokens_user_id_idx").on(t.userId),
        index("refresh_tokens_family_id_idx").on(t.familyId),
        index("refresh_tokens_expires_at_idx").on(t.expiresAt),
    ],
);
