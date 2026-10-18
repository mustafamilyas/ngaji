import { ChangePasswordForm } from "./change-password-form";

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-10">
      <div>
        <h1 className="text-lg font-semibold">Ganti Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Masukkan password saat ini dan password baru (minimal 8 karakter).
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
