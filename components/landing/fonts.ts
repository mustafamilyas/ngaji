import { Bricolage_Grotesque } from "next/font/google";

/** Heading face for the public pages only; self-hosted by next/font, so no external origin. */
export const landingHeading = Bricolage_Grotesque({
  variable: "--font-landing",
  subsets: ["latin"],
});
