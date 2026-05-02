import { NextResponse } from "next/server";
import { bus, SHIP_EVENT } from "@/lib/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || typeof (body as { type?: unknown }).type !== "string") {
    return NextResponse.json(
      { error: 'event must be JSON with a string "type" field' },
      { status: 400 },
    );
  }

  bus.emit(SHIP_EVENT, body);
  return NextResponse.json({ ok: true, type: (body as { type: string }).type });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}
