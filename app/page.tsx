import { LandingPage } from "@/components/landing/landing-page";

/** Public landing page. Signed-in users are sent to `/dashboard` by `proxy.ts` before this renders. */
export default function HomePage() {
  return <LandingPage />;
}
