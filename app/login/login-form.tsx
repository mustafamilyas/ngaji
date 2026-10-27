"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { touchButton, touchField } from "@/components/ui/touch";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  // Controlled, so a wrong password does not also throw the username away: React resets uncontrolled fields after
  // every form action. The password is cleared by that reset on purpose.
  const [username, setUsername] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          className={touchField}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={touchField}
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className={touchButton}>
        {pending ? "Memproses…" : "Masuk"}
      </Button>
    </form>
  );
}
