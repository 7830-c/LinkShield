# LinkShield

Analyze any URL for fraud, scams, and legitimacy. Enter a URL and get a structured **Fraud Risk Report** with metadata, content analysis, outbound link checks, reputation signals, and a clear verdict.

Built for the **TinyFish $2M Pre-Accelerator Hackathon**, using the [TinyFish Web Agent API](https://docs.tinyfish.ai/) to autonomously browse and compile reports.

---

## What you need to install

- **Node.js** (LTS 18 or 20 recommended)  
  - Download: [https://nodejs.org](https://nodejs.org)  
  - Check: `node -v` and `npm -v` in a terminal

That’s it. No Python or other runtimes required.

---

## Setup and run

1. **Install dependencies**
   ```bash
   cd Universal_fraud_analyzer
   npm install
   ```

2. **Add your TinyFish API key**
   - Get a key at [https://agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys)
   - Copy the example env file and add your key:
   ```bash
   copy .env.example .env.local
   ```
   - Edit `.env.local` and set:
   ```
   TINYFISH_API_KEY=sk-tinyfish-your-actual-key
   ```

3. **Start the app**
   ```bash
   npm run dev
   ```
   - Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Use the analyzer**
   - Enter a Telegram channel URL (e.g. `https://t.me/channelname` or `@channelname`).
   - Click **Analyze**.
   - Watch live progress, then view the Fraud Risk Report (verdict, score, metadata, messages, links, admins, wallets, evidence).

---

## Build for production

```bash
npm run build
npm start
```

---

## Tech stack

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **TinyFish Web Agent** (`/run-sse`) for browser automation and streaming progress
- API key is used only on the server (in `/api/analyze`), not exposed to the client
