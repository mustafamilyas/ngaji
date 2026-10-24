import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { auditLogout } from "@/lib/auth/audit-events";
import { claimsFromSignIn, refreshTokenClaims } from "@/lib/auth/jwt-claims";
import { attemptLogin } from "@/lib/auth/login";
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
        const result = await attemptLogin(raw, {
          ip: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
        });
        return result.ok ? result.user : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: authorize() already read fresh claims.
      if (user) return claimsFromSignIn(token, user);
      return refreshTokenClaims(token);
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.username = token.username;
      session.user.name = token.name;
      session.user.role = token.role;
      session.user.groupId = token.groupId;
      session.user.groupPath = token.groupPath;
      session.user.organizationId = token.organizationId;
      session.user.timeZone = token.timeZone;
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
