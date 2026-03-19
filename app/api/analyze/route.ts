import { NextRequest, NextResponse } from "next/server";

const TINYFISH_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";

function buildGoal(inputUrl: string): string {
  return `You are a LinkShield Fraud Detection Agent. Open the provided URL and produce a structured Fraud Risk Report.

URL: ${inputUrl}

Workflow:

1. Identify link type:
   - If URL contains "t.me/" → treat as Telegram channel link.
   - Else → treat as website/domain link.

2. Open the given URL.
   - If website: extract visible metadata (page title, description, domain name, SSL certificate status, HTTPS presence, favicon/logo, and any visible links).
   - If Telegram: extract channel metadata (name, description, member count, creation date if visible).
   - If Telegram channel preview button is not working → stop clicking further, only use available metadata and web reputation search.

3. Content analysis:
   - If page/channel content is visible, analyze text/posts for red flags (urgency, fake giveaways, requests for money/keys, impersonation of banks or brands, unrealistic offers).
   - If no content is visible (e.g., login wall, redirect, or Telegram preview disabled), base findings only on metadata and links.

4. Outbound links:
   - Collect all clickable links.
   - For each external link, check if it leads to a trusted site with proper HTTPS and valid SSL.
   - Label each as "safe" | "suspicious" | "phishing" with reason.

5. Web reputation search:
   - Always search the web for news, articles, or reports about the domain or channel.
   - If scam alerts, fraud warnings, or negative coverage are found, mark unsafe.
   - If coverage is positive or neutral, include that in evidence.

6. Admin/ownership:
   - If WHOIS or ownership info is visible (websites), record it.
   - If Telegram admin info visible, record it.
   - If not, set admin_visible: false.

7. Payment/security signals:
   - If the site offers shopping or payments, check for secure payment gateways, HTTPS checkout, and trusted providers.
   - If Telegram channel promotes unsafe payment flows (direct wallet addresses, suspicious QR codes), flag insecure.
   - Flag if payment flow looks fake or insecure.

8. Evidence:
   - Compile a list of findings that support the risk score (e.g., "Domain has valid SSL", "Outbound links safe", "Scam reports found online", "Telegram posts contain crypto giveaway scams").

9. Fraud Risk Score:
   - Start at 50 baseline.
   - Add points for positive signals:
     • +20 valid SSL certificate
     • +15 realistic traffic/brand presence
     • +15 normal content
     • +20 safe outbound links
     • +10 ownership/admin info visible
     • +10 no scam reports
   - Subtract points for negative signals:
     • −30 scam red flags in content
     • −25 suspicious/phishing links
     • −20 hidden/impersonated ownership
     • −20 insecure payment flow
     • −25 scam reports online
     • −15 very new domain (<3 months)
     • −10 incomplete metadata
     • −20 repeated scam patterns in Telegram/social posts
   - Interpret score:
     • 70–100 = legitimate
     • 40–69 = suspicious
     • 0–39 = likely_fraud

Return ONLY a single JSON object (no markdown, no code block):

{
  "site_metadata": { "title": "", "description": null, "domain": "", "https": false, "ssl_valid": false, "favicon_present": false, "domain_age": null, "registrar": null },
  "content_analysis": { "red_flags": [], "summary": "" },
  "outbound_links": [],
  "ownership_info": { "admin_visible": false, "admin_name": null, "registrar": null, "domain_age": null },
  "payment_security": { "secure_gateway": false, "https_checkout": false },
  "evidence": [],
  "fraud_risk_score": 0,
  "conclusion": "legitimate"
}`;
}

function normalizeUrl(input: string): string {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TINYFISH_API_KEY is not set. Add it to .env.local." },
      { status: 500 }
    );
  }

  let body: { inputUrl?: string; channelUrl?: string }; // Support both during migration if needed
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Send { inputUrl: string }." },
      { status: 400 }
    );
  }

  const inputUrl = body.inputUrl || body.channelUrl;
  if (!inputUrl || typeof inputUrl !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid inputUrl." },
      { status: 400 }
    );
  }

  const url = normalizeUrl(inputUrl);

  const goal = buildGoal(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min

  try {
    const res = await fetch(TINYFISH_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        goal,
        browser_profile: "stealth",
      }),
      signal: controller.signal,
      // @ts-expect-error Next.js / Node fetch may support duplex for streaming
      duplex: "half",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `TinyFish API error: ${res.status}`, details: text },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "text/event-stream";
    console.log("TinyFish response status:", res.status, "ContentType:", contentType);

    // Create a transform stream to log chunks as they pass through
    const tracker = new TransformStream({
      transform(chunk, controller) {
        try {
          const text = new TextDecoder().decode(chunk);
          console.log(">>> [SERVER] Outbound Stream Chunk:", text);
        } catch (err) {
          console.log(">>> [SERVER] Error decoding chunk:", err);
        }
        controller.enqueue(chunk);
      }
    });

    const stream = (res.body as any).pipeThrough(tracker);

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    clearTimeout(timeout);
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(">>> [SERVER] Error in /api/analyze:", e);
    return NextResponse.json(
      { error: "Analysis request failed", details: message },
      { status: 502 }
    );
  }
}
