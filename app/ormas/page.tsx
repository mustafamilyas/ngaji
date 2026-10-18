import type { Metadata } from "next";
import { ORMAS_LANDING } from "@/components/landing/content";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Untuk ormas",
};

export default function OrmasPage() {
  return <LandingPage content={ORMAS_LANDING} />;
}
