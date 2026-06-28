import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { databaseEnv } from "@/lib/database-env";
import * as schema from "./schema";

const sql = neon(databaseEnv.DATABASE_URL);

export const db = drizzle(sql, { schema });
