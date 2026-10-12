import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { getOrganizationName } from "@/lib/organization";
import { LoginForm } from "./login-form";

const MESSAGES: Record<string, string> = {
  "password-diubah": "Password berhasil diubah, silakan masuk lagi.",
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: `Masuk · ${await getOrganizationName()}` } };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ pesan?: string }>;
}) {
  const { pesan } = await searchParams;
  const message = pesan ? MESSAGES[pesan] : undefined;
  const organizationName = await getOrganizationName();

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-10">
      <div className="flex items-center gap-3">
        <Logo />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-heading text-lg font-semibold">{organizationName}</p>
          <p className="text-xs text-muted-foreground">oleh Dahan</p>
        </div>
      </div>
      <div>
        <h1 className="text-lg font-semibold">Masuk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Masuk dengan username dan password akun Anda.
        </p>
      </div>
      {message && (
        <p role="status" className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
          {message}
        </p>
      )}
      <LoginForm />
    </div>
  );
}
