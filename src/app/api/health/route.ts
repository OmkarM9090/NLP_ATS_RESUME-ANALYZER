import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  let database: "up" | "down" = "up";
  try {
    await db.execute(sql`select 1`);
  } catch {
    database = "down";
  }

  return Response.json(
    {
      ok: database === "up",
      database,
      pipeline: "ready",
      models_used: [
        "rule-tokenizer+lemmatizer",
        "tf-idf(ngram=1..3)",
        "rake",
        "semantic-sentence-coverage",
        "skill-taxonomy-v1",
        "gazetteer-ner",
      ],
      version: "1.0.0",
      uptime_s: Math.round((Date.now() - startedAt) / 1000),
    },
    { status: database === "up" ? 200 : 503 },
  );
}
