"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthControls({
  googleAuthConfigured,
}: {
  googleAuthConfigured: boolean;
}) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="hidden sm:block w-20 h-9 rounded-lg skeleton" />;
  }

  if (!session?.user) {
    if (!googleAuthConfigured) {
      return (
        <span className="hidden sm:inline-flex px-3 py-2 rounded-lg text-sm font-medium bg-[var(--bg-elevated)] text-[var(--text-dim)] border border-[var(--border)]">
          Google Auth Not Configured
        </span>
      );
    }

    return (
      <button
        onClick={() => signIn("google", { callbackUrl: "/" })}
        className="px-3 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
      >
        Sign In
      </button>
    );
  }

  const label =
    session.user.name?.split(" ")[0] ?? session.user.email ?? "Account";

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:block text-sm text-[var(--text-secondary)]">
        {label}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="px-3 py-2 rounded-lg text-sm font-medium bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}
