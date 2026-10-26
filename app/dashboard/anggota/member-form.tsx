"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Save } from "lucide-react";
import { createMemberAction, updateMemberAction } from "@/app/dashboard/anggota/actions";
import { GroupAutocomplete, type GroupAutocompleteOption } from "@/components/group-autocomplete";
import { Button } from "@/components/ui/button";
import { touchField } from "@/components/ui/touch";
import { cn } from "@/lib/utils";
import { formatEnumLabel, SEX_LABELS } from "@/lib/member/labels";
import { MARITAL_STATUSES, MEMBER_STATUSES, SEXES, WORK_STATUSES } from "@/lib/validation/enums";
import { memberFormSchema, type MemberFormValues } from "@/lib/validation/member";

const inputClass = touchField;
const textareaClass =
  "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 xl:min-h-20 xl:text-sm";

function Field({
  label,
  htmlFor,
  error,
  wide,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  /** Spans both columns of the form grid. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
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


type MemberFormProps =
  | {
      mode: "create";
      leafGroups: GroupAutocompleteOption[];
      initialGroupId?: number;
      /** The organization's "today" (`YYYY-MM-DD`), computed on the server. */
      today: string;
    }
  | { mode: "edit"; memberId: number; defaultValues: MemberFormValues };

const emptyDefaults = (today: string): MemberFormValues => ({
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
  joinedAt: today,
  exitedAt: undefined,
});

export function MemberForm(props: MemberFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [groupId, setGroupId] = useState<number | undefined>(
    props.mode === "create" ? (props.initialGroupId ?? props.leafGroups[0]?.id) : undefined,
  );
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: props.mode === "edit" ? props.defaultValues : emptyDefaults(props.today),
  });
  const status = useWatch({ control, name: "status" });

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
      router.push(`/dashboard/anggota/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      {props.mode === "create" && (
        <div className="sm:col-span-2">
          {props.leafGroups.length > 0 ? (
            <GroupAutocomplete id="groupId" groups={props.leafGroups} value={groupId} onChange={setGroupId} />
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada grup daun dalam scope Anda.</p>
          )}
        </div>
      )}

      <Field label="Nama" htmlFor="name" error={errors.name?.message} wide>
        <input id="name" className={inputClass} autoComplete="off" {...register("name")} />
      </Field>

      <Field label="Tempat lahir" htmlFor="birthPlace" error={errors.birthPlace?.message}>
        <input id="birthPlace" className={inputClass} autoComplete="off" {...register("birthPlace")} />
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

      <Field label="Alamat" htmlFor="address" error={errors.address?.message} wide>
        <textarea id="address" className={textareaClass} autoComplete="off" {...register("address")} />
      </Field>

      <Field label="No. HP" htmlFor="phone" error={errors.phone?.message}>
        <input id="phone" type="tel" inputMode="tel" autoComplete="off" className={inputClass} {...register("phone")} />
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
        <input id="email" type="email" inputMode="email" autoComplete="off" className={inputClass} {...register("email")} />
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
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {errors.root.message}
        </p>
      )}

      {/* Sticky below xl so Simpan stays under the thumb on this long form (like the survey answer form); `-mx-4` bleeds to the card edge (the card must not clip: it needs `overflow-visible`, see the pages). */}
      <div className="sticky bottom-0 -mx-4 flex justify-end border-t bg-background/95 px-4 py-3 backdrop-blur sm:col-span-2 xl:static xl:mx-0 xl:bg-transparent xl:px-0 xl:pt-4 xl:pb-0 xl:backdrop-blur-none">
        <Button type="submit" size="lg" disabled={pending} className="h-12 w-full text-base xl:h-9 xl:w-auto xl:text-sm">
          <Save />
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
