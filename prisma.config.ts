import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` / `prisma validate` must work without a database (CI, Render build step),
// so we fall back to a placeholder URL instead of using the throwing `env()` helper.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
