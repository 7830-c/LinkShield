"use client";

import { useState, useCallback, useRef } from "react";
import type { FraudReport } from "./types";

type Status = "idle" | "running" | "done" | "error" | "cancelled";

interface ProgressItem {
  id: number;
  text: string;
  type: "progress" | "started" | "url" | "complete";
}

export default function Home() {
  const [urlInput, setUrlInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [report, setReport] = useState<FraudReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const progressIdRef = { current: 0 };
  const abortControllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);

  const stopAnalysis = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const id = runIdRef.current || runId;
    if (id) {
      try {
        await fetch("/api/analyze/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: id }),
        });
      } catch {
        // ignore cancel API errors
      }
    }
    setError("Analysis stopped by you.");
    setStatus("cancelled");
  }, [runId]);

  const runAnalysis = useCallback(async () => {
    const url = urlInput.trim();
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
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputUrl: url }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("API Error Response:", data);
        throw new Error(data.error || data.details || `Request failed: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        console.error("No response body available in the response");
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      const processLine = (line: string) => {
        console.log("Raw line from stream:", line);
        if (!line.startsWith("data: ")) return;
        const payload = line.slice(6).trim();
        console.log("Payload content:", payload);
        if (payload === "[DONE]" || payload === "") {
          console.log("Payload is DONE or empty");
          return;
        }
        try {
          const event = JSON.parse(payload);
          console.log("Parsed SSE event:", event);
          
          // TinyFish API uses snake_case keys
          const currentRunId = event.run_id || event.runId;

          if (event.type === "STARTED") {
            if (currentRunId) {
              runIdRef.current = currentRunId;
              setRunId(currentRunId);
            }
            addProgress("Browser session active.", "started");
          } else if (event.type === "STREAMING_URL" && (event.streaming_url || event.streamingUrl)) {
            const sUrl = event.streaming_url || event.streamingUrl;
            console.log("Setting streaming URL:", sUrl);
            setStreamingUrl(sUrl);
            addProgress("Live view connected.", "url");
          } else if (event.type === "PROGRESS") {
            const purpose = event.purpose || event.message || "Working…";
            addProgress(purpose, "progress");
          } else if (event.type === "COMPLETE") {
            console.log("COMPLETE event received:", event);
            if (event.status === "COMPLETED") {
              let result = event.result || event.resultJson;
              if (typeof result === "string") {
                try {
                  result = JSON.parse(result);
                } catch {
                  result = { raw: result };
                }
              }
              console.log("Setting final report:", result);
              setReport(result as FraudReport);
              addProgress("Report generated.", "complete");
              setStatus("done");
            } else {
              const errMsg = event.error?.message || event.status || "Unknown error";
              console.error("Audit COMPLETED with error:", errMsg);
              throw new Error(errMsg);
            }
          }
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) {
            console.warn("Syntax error parsing payload:", payload);
            return;
          }
          throw parseErr;
        }
      };

      addProgress("Connected. Initializing agent…", "started");

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("Stream reader DONE.");
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          processLine(line);
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        console.log("Processing final buffer:", buffer);
        processLine(buffer);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Analysis stopped by you.");
        setStatus("cancelled");
        return;
      }
      setError(err instanceof Error ? err.message : "Analysis failed");
      setStatus("error");
    } finally {
      abortControllerRef.current = null;
    }
  }, [urlInput]);

  const scoreColor = (n: number) => {
    if (n >= 70) return "text-success";
    if (n >= 40) return "text-warn";
    return "text-danger";
  };

  const scoreBg = (n: number) => {
    if (n >= 70) return "bg-success/20 border-success/40";
    if (n >= 40) return "bg-warn/20 border-warn/40";
    return "bg-danger/20 border-danger/40";
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 md:py-16">
      <div className="w-full max-w-6xl flex-1 flex flex-col">
        <header className="text-center mb-10 md:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 mb-8 opacity-0 animate-fade-up [animation-fill-mode:forwards] [animation-delay:100ms] backdrop-blur-md shadow-[0_0_15px_rgba(0,212,170,0.2)]">
            <span className="relative flex h-2 w-2 mr-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent animate-blink" />
            </span>
            <span className="flex items-center justify-center p-1 bg-white/20 rounded-md">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zm-2 5c0-1.103.897-2 2-2s2 .897 2 2v3h-4V7z"/>
              </svg>
            </span>
            <span className="text-[10px] font-black text-accent uppercase tracking-[0.3em] ml-1">TinyFish Powered</span>
          </div>
          
          <h1 
            className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] flex justify-center"
            aria-label="LinkShield"
          >
            <span className="relative inline-flex">
              {["Link", "Shield"].map((word, wordIdx) => (
                <span key={wordIdx} className="inline-flex">
                  {word.split("").map((char, charIdx) => {
                    const i = wordIdx === 0 ? charIdx : 4 + charIdx;
                    return (
                      <span 
                        key={i} 
                        className={`animate-char-reveal ${wordIdx === 0 ? "text-white" : "text-blue-400 font-extrabold"}`}
                        style={{ animationDelay: `${200 + i * 50}ms` }}
                      >
                        {char}
                      </span>
                    );
                  })}
                </span>
              ))}
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary to-transparent opacity-50 blur-sm" />
            </span>
          </h1>
          
          <p className="text-zinc-400 mt-10 text-lg md:text-xl max-w-2xl mx-auto opacity-0 animate-fade-up [animation-fill-mode:forwards] [animation-delay:300ms] leading-relaxed font-light">
            Enter any URL to perform an <span className="font-semibold text-white">AI-driven security audit</span>. We analyze SSL, content red flags, outbound links, and ownership signals in <span className="text-secondary">real-time</span>.
          </p>
        </header>

        <div className="relative max-w-3xl mx-auto w-full mb-12 opacity-0 animate-scale-in [animation-fill-mode:forwards] [animation-delay:500ms]">
          <div className="gradient-border p-1.5 shadow-2xl shadow-black/50">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Paste URL to analyze (e.g. https://example.com)"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
                  className="w-full bg-void/50 border-none rounded-xl pl-12 pr-4 py-4 text-white focus:ring-0 placeholder-zinc-600 transition-all text-lg"
                  disabled={status === "running"}
                />
              </div>
              <button
                onClick={runAnalysis}
                disabled={status === "running" || !urlInput.trim()}
                className="btn-primary rounded-xl font-bold px-10 py-4 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
              >
                {status === "running" ? (
                  <>
                    <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Auditing…</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Analyze URL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {status === "running" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 animate-fade-in">
            <div className="lg:col-span-4 lg:sticky lg:top-8 h-fit">
              <div className="gradient-border p-6 shadow-xl h-full">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
                    </span>
                    Live Audit
                  </h2>
                  <button
                    onClick={stopAnalysis}
                    className="text-xs px-3 py-1.5 rounded-lg border border-danger/30 bg-danger/5 text-danger hover:bg-danger/20 transition-all flex items-center gap-1.5 font-bold uppercase tracking-wider"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                    Stop
                  </button>
                </div>
                <div className="relative progress-timeline pl-7">
                  <ul className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {progress.map((item, i) => (
                      <li key={item.id} className="relative flex items-start gap-4 py-3 animate-slide-in" style={{ animationDelay: `${i * 50}ms` }}>
                        <span className="absolute left-[-1.5rem] top-4.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface border border-accent/40 text-accent">
                          {item.type === "started" && <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                          {item.type === "url" && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 10-5.656-5.656l-1.102 1.101" /></svg>}
                          {item.type === "progress" && <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
                          {item.type === "complete" && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        <p className="text-sm font-medium text-zinc-300 leading-tight">{item.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="live-preview-wrap rounded-2xl overflow-hidden aspect-video shadow-2xl">
                <div className="bg-black/80 px-4 py-2 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                    </div>
                    <span className="ml-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Agent Live Feed</span>
                  </div>
                  {streamingUrl && <div className="status-badge py-0.5 px-2 text-[9px]">Stealth Instance Active</div>}
                </div>
                <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
                  {streamingUrl ? (
                    <iframe
                      src={streamingUrl}
                      title="Live analysis"
                      className="absolute inset-0 w-full h-full border-0"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
                      <span className="text-xs text-zinc-600 font-medium">Provisioning secure browser environment…</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {(status === "error" || status === "cancelled") && error && (
          <div className={`max-w-2xl mx-auto rounded-2xl border p-6 mb-12 animate-fade-in flex items-center gap-4 ${
            status === "cancelled" ? "border-warn/30 bg-warn/5 text-warn" : "border-danger/30 bg-danger/5 text-danger"
          }`}>
            <div className={`p-3 rounded-xl ${status === "cancelled" ? "bg-warn/10" : "bg-danger/10"}`}>
              {status === "cancelled" ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg mb-0.5">{status === "cancelled" ? "Audit Cancelled" : "Audit Failed"}</h3>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          </div>
        )}

        {status === "done" && report && (
          <div className="space-y-8 animate-fade-in pb-16">
            {/* Veredict Card */}
            <div className="gradient-border p-8 md:p-10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[100px] group-hover:bg-accent/10 transition-all duration-700" />
              
              <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
                <div className="relative shrink-0">
                  <svg className="w-48 h-48 -rotate-90">
                    <circle className="text-white/5" strokeWidth="8" stroke="currentColor" fill="transparent" r="88" cx="96" cy="96" />
                    <circle
                      className={`transition-all duration-1000 ease-out ${scoreColor(report.fraud_risk_score || 0)}`}
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 88}
                      strokeDashoffset={2 * Math.PI * 88 * (1 - (report.fraud_risk_score || 0) / 100)}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="88"
                      cx="96"
                      cy="96"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-5xl font-black text-white leading-none">{(report.fraud_risk_score || 0)}</span>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Score</span>
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-[0.2em] mb-4 border ${scoreBg(report.fraud_risk_score || 0)} ${scoreColor(report.fraud_risk_score || 0)}`}>
                    {report.conclusion?.replace("_", " ")}
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
                    {report.conclusion === "legitimate" ? "Trust Signal Strong" : report.conclusion === "suspicious" ? "Exercise Extreme Caution" : "High Risk Detected"}
                  </h2>
                  <p className="text-zinc-400 text-lg font-light leading-relaxed max-w-xl">
                    Our agent analyzed {report.site_metadata?.domain || "the target site"} across {report.evidence?.length || 0} security vectors. 
                    {report.content_analysis?.summary ? ` ${report.content_analysis.summary}` : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Site Metadata Card */}
              <div className="gradient-border p-6 shadow-xl card-hover">
                <h3 className="text-lg font-black text-white mb-6 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Site Identity
                </h3>
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    <StatusChip label="HTTPS" active={report.site_metadata?.https} />
                    <StatusChip label="SSL Valid" active={report.site_metadata?.ssl_valid} />
                    <StatusChip label="Favicon" active={report.site_metadata?.favicon_present} />
                  </div>
                  <dl className="grid gap-4 text-sm mt-4">
                    <DataRow label="Title" value={report.site_metadata?.title} />
                    <DataRow label="Domain" value={report.site_metadata?.domain} />
                    <DataRow label="Description" value={report.site_metadata?.description} />
                  </dl>
                </div>
              </div>

              {/* Content Analysis Card */}
              <div className="gradient-border p-6 shadow-xl card-hover">
                <h3 className="text-lg font-black text-white mb-6 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Content Analysis
                </h3>
                <div className="space-y-4">
                  {report.content_analysis?.red_flags?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {report.content_analysis.red_flags.map((flag, i) => (
                        <div key={i} className="px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs font-bold flex items-center gap-1.5">
                          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                          {flag}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-success text-sm font-bold flex items-center gap-2 bg-success/10 border border-success/30 p-3 rounded-xl">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      No malicious patterns detected in visible content
                    </div>
                  )}
                  <p className="text-zinc-400 text-sm leading-relaxed mt-2">{report.content_analysis?.summary || "No specific content summary provided."}</p>
                </div>
              </div>

              {/* Ownership & Links */}
              <div className="gradient-border p-6 shadow-xl card-hover">
                <h3 className="text-lg font-black text-white mb-6 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Ownership Info
                </h3>
                <dl className="grid gap-4 text-sm mb-8">
                  <DataRow label="Admin Found" value={report.ownership_info?.admin_visible ? "Yes" : "No"} />
                  <DataRow label="Name/Handle" value={report.ownership_info?.admin_name} />
                  <DataRow label="Social Match" value={report.ownership_info?.cross_platform_match} />
                </dl>
                
                <h4 className="text-zinc-500 font-black text-[10px] uppercase tracking-[0.2em] mb-3">Outbound Links</h4>
                {report.outbound_links?.length ? (
                  <div className="space-y-2">
                    {report.outbound_links.slice(0, 5).map((l, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`shrink-0 px-2 py-0.5 rounded-md font-black uppercase text-[9px] ${
                          l.label === "safe" ? "bg-success/20 text-success" : l.label === "suspicious" ? "bg-warn/20 text-warn" : "bg-danger/20 text-danger"
                        }`}>{l.label}</span>
                        <a href={l.url} target="_blank" rel="noopener" className="text-zinc-300 hover:text-accent truncate transition-colors underline decoration-white/10">{l.url}</a>
                      </div>
                    ))}
                    {report.outbound_links.length > 5 && <p className="text-[10px] text-zinc-600 font-bold ml-1">+ {report.outbound_links.length - 5} more links analyzed</p>}
                  </div>
                ) : (
                  <p className="text-zinc-600 text-xs font-bold italic">No external links found.</p>
                )}
              </div>

              {/* Payment & Evidence */}
              <div className="gradient-border p-6 shadow-xl card-hover flex flex-col">
                <h3 className="text-lg font-black text-white mb-6 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  Payment & Trust
                </h3>
                <div className="flex gap-3 mb-6">
                  <StatusChip label="Secure Gateway" active={report.payment_security?.secure_gateway} />
                  <StatusChip label="E-Comm Checkout" active={report.payment_security?.https_checkout} />
                </div>
                
                <h4 className="text-zinc-500 font-black text-[10px] uppercase tracking-[0.2em] mb-3 mt-auto">Evidence Log</h4>
                <div className="bg-void/50 rounded-xl p-4 border border-white/5 space-y-2">
                  {report.evidence?.length ? report.evidence.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-400">
                      <span className="mt-1 text-accent">•</span>
                      <p className="leading-tight">{e}</p>
                    </div>
                  )) : (
                    <p className="text-zinc-600 text-xs italic">No evidence log points recorded.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-auto w-full pt-20 pb-10 border-t border-white/5">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h3 className="text-xs font-black text-accent uppercase tracking-[0.3em] mb-10">Detection Engine Features</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 px-4">
              <FeatureItem icon="🔍" text="SSL Audit" />
              <FeatureItem icon="🚩" text="Scam Flags" />
              <FeatureItem icon="🔗" text="Link Scoring" />
              <FeatureItem icon="📱" text="Social Proof" />
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-8 border-t border-white/5 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              <p>Powered by <a href="https://docs.tinyfish.ai" target="_blank" className="text-accent underline">TinyFish Web Agent</a></p>
              <p>© 2026 LinkShield — Round 2 Hackathon</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function StatusChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
      active ? "bg-success/10 border-success/40 text-success shadow-lg shadow-success/10" : "bg-zinc-900 border-white/10 text-zinc-600"
    }`}>
      {active ? (
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
      ) : (
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      )}
      {label}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: unknown }) {
  const v = value === undefined || value === null ? "—" : String(value);
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{label}</dt>
      <dd className="text-zinc-300 break-words font-medium">{v}</dd>
    </div>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 group">
      <span className="text-3xl group-hover:scale-125 transition-transform duration-300">{icon}</span>
      <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{text}</span>
    </div>
  );
}
