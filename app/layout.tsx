import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "LinkShield",
  description: "Analyze any URL for fraud, scams, and legitimacy using AI security agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} font-sans antialiased bg-void text-zinc-200 min-h-screen`}>
        <div className="bg-animated" aria-hidden>
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
          <div className="bg-stars">
            <div className="star" />
            <div className="star" />
            <div className="star" />
            <div className="star" />
            <div className="star" />
            <div className="star" />
            <div className="star" />
            <div className="star" />
          </div>
        </div>
        <div className="bg-grid" aria-hidden />
        <div className="relative z-10 min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
