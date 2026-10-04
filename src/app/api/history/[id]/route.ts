import { deleteAnalysisById, getAnalysisById } from "@/lib/server/analysis-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Invalid analysis id." }, { status: 400 });
  }
  try {
    const result = await getAnalysisById(id);
    if (!result) {
      return Response.json({ error: "Analysis not found." }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    console.error("[history:id] error:", err);
    return Response.json(
      { error: "Could not load this analysis." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Invalid analysis id." }, { status: 400 });
  }
  try {
    const deleted = await deleteAnalysisById(id);
    if (!deleted) {
      return Response.json({ error: "Analysis not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[history:id] delete error:", err);
    return Response.json(
      { error: "Could not delete this analysis." },
      { status: 500 },
    );
  }
}
