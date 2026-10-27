"use client";

import { type FormEvent, useTransition } from "react";

/**
 * Submit handler for a form driven by `useActionState`, used instead of
 * `<form action={formAction}>`. React 19 resets every uncontrolled field to its
 * default after a form action, errors included, so a refused submit (username
 * taken, name already used) throws away what the user typed. Dispatching the
 * FormData from `onSubmit` keeps the action's state and `pending`, but React
 * never resets the form.
 *
 * Forms that should be empty after success reset themselves (`form.reset()`,
 * a `key`, or by unmounting a dialog).
 */
export function useKeepValues(formAction: (payload: FormData) => void) {
  const [, startTransition] = useTransition();

  return function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
}
