import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      // Bypass auth entirely on localhost in development.
      // API routes use getCurrentUserId() which falls back to the first DB user in dev mode.
      const host = req.headers.get("host") ?? "";
      const isLocal = host === "localhost" || host.startsWith("localhost:");
      if (process.env.NODE_ENV === "development" && isLocal) return true;
      return !!token;
    },
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
