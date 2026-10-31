import { relations } from "drizzle-orm";
import { comments, entries, entryFiles, stars } from "./entries";
import { refreshTokens, users } from "./users";

export const usersRelations = relations(users, ({ many }) => ({
    entries: many(entries),
    stars: many(stars),
    comments: many(comments),
    refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
    user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const entriesRelations = relations(entries, ({ one, many }) => ({
    author: one(users, { fields: [entries.authorId], references: [users.id] }),
    files: many(entryFiles),
    stars: many(stars),
    comments: many(comments),
}));

export const entryFilesRelations = relations(entryFiles, ({ one }) => ({
    entry: one(entries, { fields: [entryFiles.entryId], references: [entries.id] }),
}));

export const starsRelations = relations(stars, ({ one }) => ({
    user: one(users, { fields: [stars.userId], references: [users.id] }),
    entry: one(entries, { fields: [stars.entryId], references: [entries.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
    entry: one(entries, { fields: [comments.entryId], references: [entries.id] }),
    author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));
