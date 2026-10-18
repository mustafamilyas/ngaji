/**
 * DESIGN.md §4.3 calls for `script-src 'self' 'nonce-…'`. Next.js's App
 * Router ships every page's content via inline `<script>` tags (its RSC
 * streaming payload) — with no nonce and no `'unsafe-inline'`, the browser
 * blocks those and every page renders blank, including `/login` itself.
 * `'unsafe-eval'` is dev-only: Next's dev-mode source maps rely on `eval`
 * (see the Next.js CSP guide); production needs neither.
 */
export function buildCsp(nonce: string, { dev }: { dev: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
  ].join("; ");
}
