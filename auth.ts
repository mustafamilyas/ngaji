import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { auditLoginAttempt, auditLogout } from "@/lib/auth/audit-events";
import { extractUsername, verifyCredentials } from "@/lib/auth/credentials";
import { isLoginRateLimited } from "@/lib/auth/rate-limit";
import { revalidateSessionUser } from "@/lib/auth/revalidate";
import { getClientIp } from "@/lib/http";

const WEEK_SECONDS = 60 * 60 * 24 * 7;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: WEEK_SECONDS },
  pages: { signIn: "/login" },
  // httpOnly + sameSite=lax come from Auth.js's own cookie defaults; this
  // only pins `secure` to NODE_ENV rather than URL-protocol sniffing
  // (DESIGN.md §4.1).
  useSecureCookies: process.env.NODE_ENV === "production",
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      authorize: async (raw, request) => {
        const ip = getClientIp(request);
        const userAgent = request.headers.get("user-agent");
        const username = extractUsername(raw);

        if (await isLoginRateLimited(username, ip)) {
          await auditLoginAttempt(
            { ok: false, reason: "rate_limited", actorId: null, username },
            { ip, userAgent },
          );
          return null;
        }

        const result = await verifyCredentials(raw);
        await auditLoginAttempt(result, { ip, userAgent });
        return result.ok ? result.user : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: authorize() already read fresh claims.
        token.id = user.id;
        token.username = user.username;
        token.name = user.name;
        token.role = user.role;
        token.groupId = user.groupId;
        token.groupPath = user.groupPath;
        token.mustChangePassword = user.mustChangePassword;
        return token;
      }

      // Every other session read: re-validate against the DB so a
      // deactivation or role/group change takes effect immediately
      // (DESIGN.md §4.1). A revoked or missing user drops the session.
      const fresh = await revalidateSessionUser(Number(token.id));
      if (!fresh) return null;

      token.username = fresh.username;
      token.name = fresh.name;
      token.role = fresh.role;
      token.groupId = fresh.groupId;
      token.groupPath = fresh.groupPath;
      token.mustChangePassword = fresh.mustChangePassword;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.username = token.username;
      session.user.name = token.name;
      session.user.role = token.role;
      session.user.groupId = token.groupId;
      session.user.groupPath = token.groupPath;
      session.user.mustChangePassword = token.mustChangePassword;
      return session;
    },
  },
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (!token) return;
      await auditLogout(Number(token.id), token.username);
    },
  },
});
