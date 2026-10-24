"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { UserPlus } from "lucide-react";
import { createMemberAction } from "@/app/dashboard/anggota/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { today } from "@/lib/dates";
import { SEX_LABELS } from "@/lib/member/labels";
import { SEXES } from "@/lib/validation/enums";
import { memberFormSchema, type MemberFormValues } from "@/lib/validation/member";
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Compact member registration for the check-in page. Fields the form doesn't
 * ask for take defaults (single, working, active) and the member joins on or
 * before the occurrence date so they are expected at it.
 */
export function QuickRegisterDialog({
  groupId,
  groupName,
  occurrenceDate,
  onRegistered,
}: {
  groupId: number | undefined;
  groupName: string;
  occurrenceDate: string;
  onRegistered: (member: { id: number; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      name: "",
      birthPlace: "",
      birthDate: "",
      sex: "L",
      address: "",
      phone: "",
      maritalStatus: "BELUM_MENIKAH",
      workStatus: "BEKERJA",
      email: undefined,
      status: "AKTIF",
      joinedAt: occurrenceDate < today(DEFAULT_TIMEZONE) ? occurrenceDate : today(DEFAULT_TIMEZONE),
      exitedAt: undefined,
    },
  });

  function onSubmit(values: MemberFormValues) {
    startTransition(async () => {
      const result = await createMemberAction({ ...values, groupId });
      if (!result.ok) {
        setError("root", { message: result.error });
        return;
      }
      onRegistered({ id: result.data.id, name: result.data.name });
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={groupId === undefined}
        className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-primary outline-none hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        <UserPlus className="size-4" />
        Daftar sebagai anggota baru
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Anggota baru</DialogTitle>
        <DialogDescription>Akan didaftarkan di {groupName}.</DialogDescription>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-3">
          <Field label="Nama" htmlFor="qr-name" error={errors.name?.message}>
            <input id="qr-name" autoComplete="off" className={inputClass} {...register("name")} />
          </Field>
          <Field label="Jenis kelamin" htmlFor="qr-sex" error={errors.sex?.message}>
            <select id="qr-sex" className={inputClass} {...register("sex")}>
              {SEXES.map((sex) => (
                <option key={sex} value={sex}>
                  {SEX_LABELS[sex]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tempat lahir" htmlFor="qr-birthPlace" error={errors.birthPlace?.message}>
              <input id="qr-birthPlace" className={inputClass} {...register("birthPlace")} />
            </Field>
            <Field label="Tanggal lahir" htmlFor="qr-birthDate" error={errors.birthDate?.message}>
              <input id="qr-birthDate" type="date" className={inputClass} {...register("birthDate")} />
            </Field>
          </div>
          <Field label="No. HP" htmlFor="qr-phone" error={errors.phone?.message}>
            <input id="qr-phone" type="tel" inputMode="tel" className={inputClass} {...register("phone")} />
          </Field>
          <Field label="Alamat" htmlFor="qr-address" error={errors.address?.message}>
            <input id="qr-address" className={inputClass} {...register("address")} />
          </Field>
          {errors.root?.message && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" className="h-10" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" size="lg" className="h-10" disabled={pending}>
              {pending ? "Menyimpan…" : "Daftar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
