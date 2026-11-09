import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { InterestForm } from "./interest-form";

export const metadata: Metadata = {
  title: "Daftar minat",
};

/** Public interest form (spec: interest-signup). Static: reads nothing from the database. */
export default function DaftarPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10 sm:py-16">
      <Link href="/" className="flex min-h-11 items-center gap-3 self-start rounded-md outline-offset-4">
        <Logo />
        <span className="font-heading text-lg font-semibold">Dahan</span>
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Daftar minat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ceritakan sedikit tentang organisasi Anda. Setelah mengirim, Anda diarahkan ke WhatsApp untuk berbincang dengan kami.
        </p>
      </div>
      <InterestForm />
      <p className="text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Masuk
        </Link>
      </p>
    </div>
  );
}
