import { NextResponse } from "next/server";
import { listInterviews } from "@/lib/interview/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ records: await listInterviews() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "面试记录读取失败" }, { status: 500 }); }
}
