import { redirect } from "next/navigation";

/** Level renaming moved into the settings page; keep old bookmarks working. */
export default function LevelSettingsRedirect(): never {
  redirect("/dashboard/pengaturan");
}
