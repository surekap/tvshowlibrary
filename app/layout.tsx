import type { Metadata } from "next";
import Link from "next/link";
import { Syne, DM_Sans } from "next/font/google";
import { TopNav, BottomNav } from "@/components/Nav";
import AuthControls from "@/components/AuthControls";
import { Providers } from "@/components/Providers";
import { googleAuthConfigured } from "@/lib/auth";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Episode Calendar",
  description: "Track your favorite TV shows and never miss an episode",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${syne.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans antialiased">
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-white focus:rounded-lg focus:text-sm focus:font-medium focus:shadow-lg"
          >
            Skip to main content
          </a>
          <div className="flex flex-col min-h-screen">
            {/* Top header */}
            <header className="sticky top-0 z-40 header-glass border-b border-[var(--border)]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-4 h-14 md:h-16">
                  <Link
                    href="/"
                    className="flex items-center gap-2.5 group shrink-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/20 border border-[var(--accent)]/30 flex items-center justify-center group-hover:bg-[var(--accent)]/30 transition-colors">
                      <svg aria-hidden="true" className="w-4 h-4 text-[var(--accent-hover)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                    </div>
                    <span className="font-display font-bold text-lg text-white tracking-tight group-hover:text-[var(--accent-hover)] transition-colors">
                      Episode Calendar
                    </span>
                  </Link>

                  <div className="flex items-center gap-3">
                    <TopNav />
                    <AuthControls googleAuthConfigured={googleAuthConfigured} />
                  </div>
                </div>
              </div>
            </header>

            <main id="main-content" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 md:py-8 pb-24 md:pb-8">
              {children}
            </main>

            <footer className="hidden md:block border-t border-[var(--border)] py-5">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <p className="text-center text-xs text-[var(--text-dim)]">
                  Powered by{" "}
                  <a
                    href="https://thetvdb.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                  >
                    TVDB
                  </a>
                  {" "}· Episode data refreshes automatically
                </p>
              </div>
            </footer>

            <BottomNav />
          </div>
        </Providers>
      </body>
    </html>
  );
}
