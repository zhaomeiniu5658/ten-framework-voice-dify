import { NextResponse } from "next/server";
import { getVoiceCatalog } from "@/lib/volcengine/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getVoiceCatalog());
}
