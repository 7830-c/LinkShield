# Integration Code Snippet for page.tsx

Add this to your existing `app/page.tsx` to enable Telethon authentication UI.

## 1. Add Imports (at top with other imports)

```typescript
import { TelethonAuthModal } from "@/app/components/TelethonAuthModal";
```

## 2. Add State in Home Component (inside the component function)

```typescript
const [showTelethonAuth, setShowTelethonAuth] = useState(false);
const [authorizedPhone, setAuthorizedPhone] = useState<string | null>(null);
```

## 3. Add Button to Header (find the header section with "Analyze" button)

Add this button alongside your existing controls:

```typescript
<button
  onClick={() => setShowTelethonAuth(true)}
  className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-gradient-to-r from-accent/10 to-secondary/10 px-4 py-2 mb-4 hover:border-accent/60 transition"
>
  <span className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-accent to-secondary uppercase tracking-widest">
    {authorizedPhone ? "✓ Full Access Enabled" : "🔐 Enable Full Access"}
  </span>
</button>
```

## 4. Add Modal Component (before the closing div of your main component)

```typescript
<TelethonAuthModal
  isOpen={showTelethonAuth}
  onClose={() => setShowTelethonAuth(false)}
  onAuthSuccess={(phone) => {
    setAuthorizedPhone(phone);
    setShowTelethonAuth(false);
  }}
/>
```

## 5. Modify runAnalysis Function (add at the beginning)

```typescript
const runAnalysis = useCallback(async () => {
  const url = channelUrl.trim();
  if (!url) return;
  
  setStatus("running");
  setProgress([]);
  setReport(null);
  setError(null);
  setStreamingUrl(null);
  setRunId(null);
  runIdRef.current = null;
  
  const controller = new AbortController();
  abortControllerRef.current = controller;

  const addProgress = (text: string, type: ProgressItem["type"] = "progress") => {
    progressIdRef.current += 1;
    setProgress((prev) => [...prev, { id: progressIdRef.current, text, type }]);
  };

  try {
    // TRY TELETHON FIRST IF AUTHORIZED
    if (authorizedPhone) {
      addProgress("Attempting Telethon analysis (full access)...", "started");
      
      try {
        const telethonRes = await fetch("/api/telethon-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone_number: authorizedPhone,
            channel_identifier: url,
          }),
          signal: controller.signal,
        });

        if (telethonRes.ok) {
          const telethonData = await telethonRes.json();
          
          if (telethonData.status === "success") {
            addProgress("Successfully fetched full channel data", "complete");
            
            // Convert Telethon data to match fraud report format
            const report: FraudReport = {
              channel_metadata: {
                channel_name: telethonData.channel_metadata.channel_name,
                description: telethonData.channel_metadata.description,
                member_count: telethonData.channel_metadata.member_count,
                verification_status: telethonData.channel_metadata.verified ? "verified" : "unverified",
              },
              message_analysis: {
                message_summary: telethonData.message_summary,
                message_red_flags: telethonData.red_flags,
              },
              outbound_links: [],
              admin_cross_check: {
                admin_visible: false,
                admin_username_or_name: null,
              },
              wallet_addresses: [],
              fraud_risk_score: telethonData.fraud_risk_score,
              conclusion: telethonData.conclusion as any,
            };
            
            setReport(report);
            setStatus("done");
            return; // Skip TinyFish analysis
          }
        }
      } catch (telethonError) {
        console.log("Telethon analysis failed, falling back to TinyFish");
        addProgress("Telethon analysis unavailable, using TinyFish instead", "progress");
      }
    }

    // FALL BACK TO TINYFISH (original code)
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelUrl: url }),
      signal: controller.signal,
    });

    // ... rest of existing code ...
  } catch (err) {
    // ... existing error handling ...
  }
}, [authorizedPhone, channelUrl]); // Add authorizedPhone to dependencies
```

## Complete Integration Example

Here's how the header section should look:

```typescript
<header className="text-center mb-8 md:mb-10">
  {/* Status Badge */}
  <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-gradient-to-r from-accent/10 to-secondary/10 px-4 py-2 mb-6">
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-r from-accent to-accent-glow" />
    </span>
    <span className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-accent to-secondary uppercase tracking-widest">
      🛡️ TinyFish Powered
    </span>
  </div>

  {/* Title */}
  <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white drop-shadow-lg leading-tight mb-6">
    <span className="text-gradient">Link</span>
    <br />
    <span className="inline-block">
      <span className="bg-gradient-to-r from-pink-400 via-red-500 to-orange-500 bg-clip-text text-transparent animate-pulse">
        Shield
      </span>
    </span>
  </h1>

  {/* Enable Full Access Button */}
  <button
    onClick={() => setShowTelethonAuth(true)}
    className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-gradient-to-r from-accent/10 to-secondary/10 px-4 py-2 mb-4 hover:border-accent/60 transition"
  >
    <span className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-accent to-secondary uppercase tracking-widest">
      {authorizedPhone ? "✓ Full Access Enabled" : "🔐 Enable Full Access"}
    </span>
  </button>

  <p className="text-zinc-300 mt-6 text-base md:text-lg max-w-2xl mx-auto leading-relaxed font-light">
    Enter a channel link and we'll <span className="font-semibold text-accent">instantly analyze</span> metadata, messages, links, admins, and wallets.
  </p>
</header>

{/* ... rest of your component ... */}

{/* Add modal at the end */}
<TelethonAuthModal
  isOpen={showTelethonAuth}
  onClose={() => setShowTelethonAuth(false)}
  onAuthSuccess={(phone) => {
    setAuthorizedPhone(phone);
    setShowTelethonAuth(false);
  }}
/>
```

## Notes

- The modal will handle all auth steps automatically
- Sessions persist, so users only login once
- UI updates to show "✓ Full Access Enabled" after login
- Telethon analysis attempts first, falls back to TinyFish if unavailable
- Shows progress in the timeline as analysis happens
