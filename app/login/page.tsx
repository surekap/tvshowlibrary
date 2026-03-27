import { redirect } from "next/navigation";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { getAuthSession, googleAuthConfigured } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getAuthSession();

  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent)]/25 flex items-center justify-center">
          <svg
            aria-hidden="true"
            className="w-8 h-8 text-[var(--accent-hover)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"
            />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          Sign in to Episode Calendar
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
          Use your Google account to keep shows, episodes, and watch history
          separate for each user.
        </p>
        <div className="mt-8 space-y-3">
          {googleAuthConfigured ? (
            <GoogleSignInButton />
          ) : (
            <div className="rounded-xl border border-[var(--warn)]/25 bg-[var(--warn)]/10 px-4 py-3 text-sm text-[var(--warn)]">
              Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env.local`
              to enable sign-in.
            </div>
          )}
          {process.env.NODE_ENV === "development" && (
            <a
              href="/"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-dim)] px-4 py-2.5 text-sm font-medium text-[var(--accent-hover)] hover:bg-[var(--accent-dim)] transition-colors"
            >
              <span className="text-xs font-mono bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">DEV</span>
              Continue without sign-in (localhost only)
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
