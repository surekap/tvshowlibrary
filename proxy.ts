import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  // Bypass auth entirely on localhost in development.
  // API routes use getCurrentUserId() which falls back to the first DB user in dev mode.
  const host = request.headers.get("host") ?? "";
  const isLocal = host === "localhost" || host.startsWith("localhost:");
  if (process.env.NODE_ENV === "development" && isLocal) {
    return NextResponse.next();
  }

  // Explicitly set secureCookie based on NEXTAUTH_URL so the correct cookie
  // name is used. In production (HTTPS) NextAuth sets __Secure-next-auth.session-token;
  // withAuth defaults secureCookie=false and looks for the non-prefixed name, causing
  // the token to appear missing even though getServerSession can read it fine.
  const secureCookie = process.env.NEXTAUTH_URL?.startsWith("https://") ?? true;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie,
  });

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
