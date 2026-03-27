import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, isNull, notExists } from "drizzle-orm";
import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db, rawDb } from "@/lib/db";
import {
  accounts,
  sessions,
  shows,
  users,
  verificationTokens,
} from "@/lib/schema";

export const googleAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(rawDb, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: googleAuthConfigured
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : [],
  // JWT strategy: sessions are stored in a signed cookie, not the database.
  // The DrizzleAdapter is still needed for the users/accounts tables.
  // Trade-off: server-side session revocation is not available with this strategy.
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      const id = token.userId ?? token.sub;
      if (session.user && id) {
        session.user.id = String(id);
      }
      return session;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}

// In-memory cache to avoid repeated DB checks once a user's legacy adoption
// is confirmed. Resets on cold start (acceptable: the DB check is cheap when
// the user already owns shows).
const adoptedUsers = new Set<string>();

async function adoptLegacyShows(userId: string) {
  if (adoptedUsers.has(userId)) return;

  // Single atomic UPDATE: assigns all NULL-owned shows to this user only if
  // they don't already own any. The NOT EXISTS sub-select is evaluated under
  // Postgres row-level locking, so concurrent first-logins can't both adopt
  // the same data — the second UPDATE will find the rows already claimed.
  await db
    .update(shows)
    .set({ userId })
    .where(
      and(
        isNull(shows.userId),
        notExists(
          db.select({ id: shows.id }).from(shows).where(eq(shows.userId, userId))
        )
      )
    );

  adoptedUsers.add(userId);
}

export async function getCurrentUserId() {
  const session = await getAuthSession();
  // Use || instead of ?? so an empty string also falls through to null.
  const userId = session?.user?.id || null;

  if (userId) {
    await adoptLegacyShows(userId);
    return userId;
  }

  // In development on localhost, fall back to the first user in the DB so all
  // API routes work without needing a real OAuth session.
  if (process.env.NODE_ENV === "development") {
    const [devUser] = await db.select({ id: users.id }).from(users).limit(1);
    if (devUser) {
      await adoptLegacyShows(devUser.id);
      return devUser.id;
    }
  }

  return null;
}
