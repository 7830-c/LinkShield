import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TINYFISH_API_KEY is not set." },
      { status: 500 }
    );
  }

  let body: { runId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON. Send { runId: string }." },
      { status: 400 }
    );
  }

  const runId = body.runId;
  if (!runId || typeof runId !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid runId." },
      { status: 400 }
    );
  }

  const res = await fetch(
    `https://agent.tinyfish.ai/v1/runs/${encodeURIComponent(runId)}/cancel`,
    {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Cancel request failed", details: text },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
