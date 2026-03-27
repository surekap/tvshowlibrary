import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  // Bypass auth entirely on localhost in development.
  // API routes use getCurrentUserId() which falls back to the first DB user in dev mode.
  const host = request.headers.get("host") ?? "";
  const isLocal = host === "localhost" || host.startsWith("localhost:");
  if (process.env.NODE_ENV === "development" && isLocal) {
    return NextResponse.next();
  }

  // The localhost dev bypass above means every request reaching this point
  // is running on the production HTTPS deployment. Always use the secure
  // cookie name (__Secure- prefix) that NextAuth sets on HTTPS.
  const secureCookie = true;
  const cookieName = "__Secure-next-auth.session-token";
  const hasCookie = request.cookies.has(cookieName);

  console.log("[proxy]", request.nextUrl.pathname, {
    secureCookie,
    cookieName,
    hasCookie,
    hasSecret: !!process.env.NEXTAUTH_SECRET,
  });

  // If there's no session cookie at all, redirect immediately (no point calling getToken).
  if (!hasCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Cookie exists — try to verify it. If verification throws (e.g. wrong secret),
  // fall back to trusting the cookie presence so we don't create a redirect loop.
  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie,
      cookieName,
    });
  } catch (err) {
    console.error("[proxy] getToken threw:", err);
  }

  console.log("[proxy] token:", token ? "found" : "null");

  if (!token) {
    // Cookie exists but couldn't be verified — clear it and send to login
    // so the user gets a fresh sign-in rather than an infinite loop.
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(cookieName);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
