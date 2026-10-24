"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { interestSchema, type InterestInput } from "@/lib/validation/interest";
import { submitInterestAction } from "./actions";

type FormValues = z.input<typeof interestSchema>;

type FieldMessage = { message?: string };

const fieldClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: FieldMessage;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hasHint: boolean, error?: FieldMessage) {
  return error ? `${id}-error` : hasHint ? `${id}-hint` : undefined;
}

export function InterestForm() {
  const [pending, startTransition] = useTransition();
  const [whatsappUrl, setWhatsappUrl] = useState<string | null | undefined>(undefined);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues, unknown, InterestInput>({
    resolver: zodResolver(interestSchema),
    defaultValues: { name: "", phone: "", organizationName: "", memberCount: "", message: "", website: "" },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await submitInterestAction(values);
      if (!result.ok) {
        setError("root", { message: result.error });
        return;
      }
      setWhatsappUrl(result.data.whatsappUrl);
      // The link below stays on screen in case the browser blocks this navigation.
      if (result.data.whatsappUrl) window.location.assign(result.data.whatsappUrl);
    });
  });

  if (whatsappUrl !== undefined) {
    return (
      <div role="status" className="flex flex-col gap-4 rounded-lg border border-input bg-muted/40 p-4">
        <p className="font-medium">Terima kasih, data Anda sudah kami terima.</p>
        {whatsappUrl ? (
          <>
            <p className="text-sm text-muted-foreground">
              Kami akan mengarahkan Anda ke WhatsApp. Jika tidak terbuka, ketuk tombol di bawah.
            </p>
            <a
              href={whatsappUrl}
              rel="noopener noreferrer"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/80 sm:w-auto sm:self-start"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              Lanjut ke WhatsApp
            </a>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Kami akan menghubungi Anda lewat WhatsApp secepatnya.</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field id="name" label="Nama Anda" error={errors.name}>
        <input
          id="name"
          type="text"
          autoComplete="name"
          maxLength={100}
          aria-invalid={!!errors.name}
          aria-describedby={describedBy("name", false, errors.name)}
          className={fieldClass}
          {...register("name")}
        />
      </Field>
      <Field id="phone" label="Nomor WhatsApp" hint="Contoh: 0812-3456-7890" error={errors.phone}>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={30}
          aria-invalid={!!errors.phone}
          aria-describedby={describedBy("phone", true, errors.phone)}
          className={fieldClass}
          {...register("phone")}
        />
      </Field>
      <Field id="organizationName" label="Nama organisasi" error={errors.organizationName}>
        <input
          id="organizationName"
          type="text"
          autoComplete="organization"
          maxLength={100}
          aria-invalid={!!errors.organizationName}
          aria-describedby={describedBy("organizationName", false, errors.organizationName)}
          className={fieldClass}
          {...register("organizationName")}
        />
      </Field>
      <Field id="memberCount" label="Perkiraan jumlah anggota (opsional)" error={errors.memberCount}>
        <input
          id="memberCount"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-invalid={!!errors.memberCount}
          aria-describedby={describedBy("memberCount", false, errors.memberCount)}
          className={fieldClass}
          {...register("memberCount")}
        />
      </Field>
      <Field id="message" label="Pesan (opsional)" error={errors.message}>
        <textarea
          id="message"
          rows={4}
          maxLength={1000}
          aria-invalid={!!errors.message}
          aria-describedby={describedBy("message", false, errors.message)}
          className={`${fieldClass} h-auto min-h-28 py-2`}
          {...register("message")}
        />
      </Field>

      {/* Honeypot: off-screen, skipped by keyboard and screen readers; bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Situs web</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="consent" className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm">
          <input
            id="consent"
            type="checkbox"
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? "consent-error" : undefined}
            className="mt-0.5 size-6 shrink-0 accent-primary"
            {...register("consent")}
          />
          <span>Saya setuju data ini dipakai untuk menghubungi saya</span>
        </label>
        {errors.consent && (
          <p id="consent-error" role="alert" className="text-sm text-destructive">
            {errors.consent.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-12 w-full text-base sm:w-auto sm:self-start sm:px-6">
        {pending ? "Mengirim…" : "Kirim"}
      </Button>
    </form>
  );
}
