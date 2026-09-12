"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { createMemberAction, updateMemberAction } from "@/app/anggota/actions";
import { Button } from "@/components/ui/button";
import { today } from "@/lib/dates";
import { formatEnumLabel, SEX_LABELS } from "@/lib/member/labels";
import { MARITAL_STATUSES, MEMBER_STATUSES, SEXES, WORK_STATUSES } from "@/lib/validation/enums";
import { memberFormSchema, type MemberFormValues } from "@/lib/validation/member";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
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

type LeafGroupOption = { id: number; name: string };

type MemberFormProps =
  | { mode: "create"; leafGroups: LeafGroupOption[] }
  | { mode: "edit"; memberId: number; defaultValues: MemberFormValues };

const emptyDefaults: MemberFormValues = {
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
  joinedAt: today(),
  exitedAt: undefined,
};

export function MemberForm(props: MemberFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [groupId, setGroupId] = useState<number | undefined>(
    props.mode === "create" ? props.leafGroups[0]?.id : undefined,
  );
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: props.mode === "edit" ? props.defaultValues : emptyDefaults,
  });
  const status = watch("status");

  function onSubmit(values: MemberFormValues) {
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createMemberAction({ ...values, groupId })
          : await updateMemberAction({ ...values, memberId: props.memberId });

      if (!result.ok) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/anggota/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {props.mode === "create" && (
        <Field label="Grup" htmlFor="groupId">
          {props.leafGroups.length > 0 ? (
            <select
              id="groupId"
              className={inputClass}
              value={groupId}
              onChange={(event) => setGroupId(Number(event.target.value))}
            >
              {props.leafGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada grup daun dalam scope Anda.</p>
          )}
        </Field>
      )}

      <Field label="Nama" htmlFor="name" error={errors.name?.message}>
        <input id="name" className={inputClass} {...register("name")} />
      </Field>

      <Field label="Tempat lahir" htmlFor="birthPlace" error={errors.birthPlace?.message}>
        <input id="birthPlace" className={inputClass} {...register("birthPlace")} />
      </Field>

      <Field label="Tanggal lahir" htmlFor="birthDate" error={errors.birthDate?.message}>
        <input id="birthDate" type="date" className={inputClass} {...register("birthDate")} />
      </Field>

      <Field label="Jenis kelamin" htmlFor="sex" error={errors.sex?.message}>
        <select id="sex" className={inputClass} {...register("sex")}>
          {SEXES.map((sex) => (
            <option key={sex} value={sex}>
              {SEX_LABELS[sex]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Alamat" htmlFor="address" error={errors.address?.message}>
        <textarea id="address" className={textareaClass} {...register("address")} />
      </Field>

      <Field label="No. HP" htmlFor="phone" error={errors.phone?.message}>
        <input id="phone" className={inputClass} {...register("phone")} />
      </Field>

      <Field label="Status pernikahan" htmlFor="maritalStatus" error={errors.maritalStatus?.message}>
        <select id="maritalStatus" className={inputClass} {...register("maritalStatus")}>
          {MARITAL_STATUSES.map((value) => (
            <option key={value} value={value}>
              {formatEnumLabel(value)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Status pekerjaan" htmlFor="workStatus" error={errors.workStatus?.message}>
        <select id="workStatus" className={inputClass} {...register("workStatus")}>
          {WORK_STATUSES.map((value) => (
            <option key={value} value={value}>
              {formatEnumLabel(value)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Email (opsional)" htmlFor="email" error={errors.email?.message}>
        <input id="email" type="email" className={inputClass} {...register("email")} />
      </Field>

      <Field label="Status keanggotaan" htmlFor="status" error={errors.status?.message}>
        <select id="status" className={inputClass} {...register("status")}>
          {MEMBER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {formatEnumLabel(value)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tanggal bergabung" htmlFor="joinedAt" error={errors.joinedAt?.message}>
        <input id="joinedAt" type="date" className={inputClass} {...register("joinedAt")} />
      </Field>

      {status !== "AKTIF" && (
        <Field label="Tanggal keluar" htmlFor="exitedAt" error={errors.exitedAt?.message}>
          <input id="exitedAt" type="date" className={inputClass} {...register("exitedAt")} />
        </Field>
      )}

      {errors.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}
