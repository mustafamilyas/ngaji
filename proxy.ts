import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PASSWORD_CHANGE_PATH = "/akun/password";
const LOGIN_PATH = "/login";

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * DESIGN.md §4.3 calls for `script-src 'self' 'nonce-…'`. Next.js's App
 * Router ships every page's content via inline `<script>` tags (its RSC
 * streaming payload) — with no nonce and no `'unsafe-inline'`, the browser
 * blocks those and every page renders blank, including `/login` itself.
 * `'unsafe-eval'` is dev-only: Next's dev-mode source maps rely on `eval`
 * (see the Next.js CSP guide); production needs neither.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${IS_DEV ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Runs on the Node.js runtime (not Edge) because `auth()` triggers our
 * `jwt` callback, which re-reads the user from Prisma/SQLite on every call —
 * that native query engine isn't available on Edge (DESIGN.md §4.1).
 */
export default auth((req) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  function next(): NextResponse {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  function redirect(url: URL): NextResponse {
    const response = NextResponse.redirect(url);
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (!session) {
    if (pathname === LOGIN_PATH) return next();
    return redirect(new URL(LOGIN_PATH, req.url));
  }

  const destination = session.user.mustChangePassword ? PASSWORD_CHANGE_PATH : "/";

  if (pathname === LOGIN_PATH) {
    return redirect(new URL(destination, req.url));
  }

  if (session.user.mustChangePassword && pathname !== PASSWORD_CHANGE_PATH) {
    return redirect(new URL(PASSWORD_CHANGE_PATH, req.url));
  }

  return next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
