import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDb | null = null;

function getDb(): DrizzleDb {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!, {
      fetchOptions: { cache: "no-store" },
    });
    _db = drizzle(sql, { schema });
  }
  return _db;
}

export const rawDb = getDb();

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const instance = rawDb;
    const value = instance[prop as keyof DrizzleDb];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

export type Database = DrizzleDb;
