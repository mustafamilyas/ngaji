import type { NextConfig } from "next";

// Content-Security-Policy is set per-request in middleware.ts instead: it
// needs a fresh nonce per request (DESIGN.md §4.3's `script-src 'self'
// 'nonce-…'`) so Next's own inline RSC-streaming scripts can run — a static
// value here would either lack the nonce (every page renders blank) or fight
// the header middleware sets on the same response.
// HSTS only in production: a browser that sees it on localhost would pin
// http://localhost to https for a year and break every other dev server.
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...(IS_PRODUCTION
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
