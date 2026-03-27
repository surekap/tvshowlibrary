"use client";

import { signIn } from "next-auth/react";

export default function GoogleSignInButton() {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/" })}
      className="inline-flex items-center justify-center gap-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 px-5 py-3 text-sm font-semibold transition-colors"
    >
      <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.27-2.09 3.57-5.17 3.57-8.64Z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.43 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.3v3.09A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.55.38-2.29V6.62H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.38l3.99-3.09Z" />
        <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.94 1.06 15.24 0 12 0 7.31 0 3.26 2.69 1.3 6.62l3.99 3.09C6.23 6.88 8.88 4.77 12 4.77Z" />
      </svg>
      Continue With Google
    </button>
  );
}
