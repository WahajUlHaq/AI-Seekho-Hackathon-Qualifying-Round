import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chainflow — Autonomous Intelligence Pipeline",
  description:
    "Multi-agent AI pipeline — ingest documents, URLs, and text for real-time synthesized insights and executable action plans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark antialiased`}
    >
      <body className="h-screen overflow-hidden flex flex-col text-foreground">
        {/* Glass navigation bar */}
        <nav
          className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
          style={{
            background: "rgba(6, 6, 10, 0.75)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* Logo mark */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.9) 0%, rgba(59,130,246,0.9) 100%)",
                boxShadow: "0 0 12px rgba(139,92,246,0.4)",
              }}
            >
              N
            </div>
            <span className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">
              Chainflow
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            >
              New Pipeline
            </Link>
            <div
              className="w-px h-4 mx-1"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-zinc-500"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                style={{ boxShadow: "0 0 6px rgba(52,211,153,0.8)" }}
              />
              Agents online
            </div>
          </div>
        </nav>

        <main className="flex-1 flex flex-col min-h-0">
          {children}
        </main>

        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
