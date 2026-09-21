import "server-only";
import { readFileSync } from "node:fs";
import postgres from "postgres";
let connection: ReturnType<typeof postgres> | undefined;
export function database() {
  if (!process.env.DATABASE_URL)
    throw new Error("Institution database is not configured");
  // Pool contains no user state. Prepared statements disabled for Supavisor transaction pooling.
  connection ??= postgres(process.env.DATABASE_URL, {
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.DATABASE_SSL_CA_FILE
        ? readFileSync(process.env.DATABASE_SSL_CA_FILE, "utf8")
        : undefined,
    },
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return connection;
}
