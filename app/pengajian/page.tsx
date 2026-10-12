import type { Metadata } from "next";
import { PENGAJIAN_LANDING } from "@/components/landing/content";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Untuk pengajian",
};

export default function PengajianPage() {
  return <LandingPage content={PENGAJIAN_LANDING} />;
}
