import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { finishInterview, publicReport, readInterview, runAnalysis } from "@/lib/interview/store";
export const runtime = "nodejs";
export const maxDuration = 240;
const schema = z.object({
  action: z.enum(["finish", "retry"]),
  transcript: z.array(z.object({ role: z.enum(["user", "assistant"]),
    text: z.string().trim().min(1).max(12000), time: z.number().finite(),
  })).max(200).default([]),
});
type Context = { params: Promise<{ id: string }> };
export async function GET(_: NextRequest, context: Context) {
  const value = await readInterview((await context.params).id);
  return NextResponse.json(value ? publicReport(value) : { error: "面试记录不存在" },
    { status: value ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest, context: Context) {
  // Same-origin session capability; the random session ID is returned only at start.
  const origin = request.headers.get("origin");
  // The public Host survives Docker port mapping; nextUrl.origin uses the
  // internal port and would incorrectly reject the local browser at :3010.
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get("host"))
        return NextResponse.json({ error: "无效来源" }, { status: 403 });
    } catch { return NextResponse.json({ error: "无效来源" }, { status: 403 }); }
  }
  const body = await request.text();
  if (body.length > 250000) return NextResponse.json({ error: "面试记录过长" }, { status: 413 });
  let parsed;
  try { parsed = schema.safeParse(JSON.parse(body)); } catch { return NextResponse.json({ error: "无效请求" }, { status: 400 }); }
  if (!parsed.success) return NextResponse.json({ error: "无效面试记录" }, { status: 400 });
  const id = (await context.params).id;
  const value = await finishInterview(id, parsed.data.transcript, parsed.data.action === "retry");
  if (!value) return NextResponse.json({ error: "面试记录不存在" }, { status: 404 });
  if (value.status === "analyzing") after(() => runAnalysis(id));
  return NextResponse.json(publicReport(value), { status: 202, headers: { "Cache-Control": "no-store" } });
}
