import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-10">
      <div>
        <h1 className="text-lg font-semibold">Masuk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Masuk dengan username dan password akun Anda.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
