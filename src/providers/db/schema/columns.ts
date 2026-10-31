import { timestamp, uuid } from "drizzle-orm/pg-core";

/** Random UUID v4 primary key: ids exposed by the API can't be enumerated. */
export const id = () => uuid("id").primaryKey().defaultRandom();

export const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
    timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date());
