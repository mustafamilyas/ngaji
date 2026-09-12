"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";
import { useForm } from "react-hook-form";
import { createActivityAction, splitActivityAction, updateActivityAction } from "@/app/kegiatan/actions";
import { Button } from "@/components/ui/button";
import { today } from "@/lib/dates";
import { activityUpdateSchema, type ActivityUpdateInput } from "@/lib/validation/activity";
import { FREQS } from "@/lib/validation/enums";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const textareaClass =
  "min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const FREQ_LABELS: Record<(typeof FREQS)[number], string> = {
  ONCE: "Sekali",
  DAILY: "Harian",
  WEEKLY: "Mingguan",
  MONTHLY: "Bulanan",
};

const WEEKDAY_LABELS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

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

type ActivityFormProps =
  | { mode: "create" }
  | { mode: "edit"; activityId: number; defaultValues: ActivityUpdateInput }
  | { mode: "split"; activityId: number; defaultValues: ActivityUpdateInput };

const emptyDefaults: ActivityUpdateInput = {
  name: "",
  location: "",
  notes: undefined,
  startTime: "19:00",
  durationMinutes: 60,
  freq: "WEEKLY",
  interval: 1,
  weekdays: [0],
  monthDay: undefined,
  startsOn: today(),
  endsOn: undefined,
};

export function ActivityForm(props: ActivityFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ActivityUpdateInput>({
    resolver: zodResolver(activityUpdateSchema),
    defaultValues: props.mode === "create" ? emptyDefaults : props.defaultValues,
  });
  const freq = watch("freq");
  const weekdays = watch("weekdays");

  function toggleWeekday(day: number) {
    const next = weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day].sort();
    setValue("weekdays", next, { shouldValidate: true });
  }

  function onSubmit(values: ActivityUpdateInput) {
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createActivityAction(values)
          : props.mode === "edit"
            ? await updateActivityAction(props.activityId, values)
            : await splitActivityAction({ ...values, activityId: props.activityId });

      if (!result.ok) {
        setError("root", { message: result.error });
        return;
      }
      const suffix = result.data.hasConflict ? "?conflict=1" : "";
      router.push(`/kegiatan/${result.data.activity.id}${suffix}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Nama" htmlFor="name" error={errors.name?.message}>
        <input id="name" className={inputClass} {...register("name")} />
      </Field>

      <Field label="Lokasi" htmlFor="location" error={errors.location?.message}>
        <input id="location" className={inputClass} {...register("location")} />
      </Field>

      <Field label="Catatan (opsional)" htmlFor="notes" error={errors.notes?.message}>
        <textarea id="notes" className={textareaClass} {...register("notes")} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Jam mulai" htmlFor="startTime" error={errors.startTime?.message}>
          <input id="startTime" type="time" className={inputClass} {...register("startTime")} />
        </Field>
        <Field label="Durasi (menit)" htmlFor="durationMinutes" error={errors.durationMinutes?.message}>
          <input
            id="durationMinutes"
            type="number"
            min={1}
            className={inputClass}
            {...register("durationMinutes", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <Field label="Frekuensi" htmlFor="freq" error={errors.freq?.message}>
        <select id="freq" className={inputClass} {...register("freq")}>
          {FREQS.map((value) => (
            <option key={value} value={value}>
              {FREQ_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      {freq !== "ONCE" && (
        <Field label="Interval" htmlFor="interval" error={errors.interval?.message}>
          <input
            id="interval"
            type="number"
            min={1}
            className={inputClass}
            {...register("interval", { valueAsNumber: true })}
          />
        </Field>
      )}

      {freq === "WEEKLY" && (
        <Field label="Hari" htmlFor="weekdays" error={errors.weekdays?.message}>
          <div id="weekdays" className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, day) => (
              <label
                key={day}
                className="flex items-center gap-1.5 rounded-md border border-input px-2 py-1 text-sm"
              >
                <input
                  type="checkbox"
                  checked={weekdays.includes(day)}
                  onChange={() => toggleWeekday(day)}
                />
                {label}
              </label>
            ))}
          </div>
        </Field>
      )}

      {freq === "MONTHLY" && (
        <Field label="Tanggal bulan" htmlFor="monthDay" error={errors.monthDay?.message}>
          <input
            id="monthDay"
            type="number"
            min={1}
            max={31}
            className={inputClass}
            {...register("monthDay", { setValueAs: (value) => (value === "" ? undefined : Number(value)) })}
          />
        </Field>
      )}

      <Field
        label={props.mode === "split" ? "Berlaku mulai tanggal" : "Tanggal mulai"}
        htmlFor="startsOn"
        error={errors.startsOn?.message}
      >
        <input id="startsOn" type="date" className={inputClass} {...register("startsOn")} />
      </Field>

      <Field label="Tanggal akhir (opsional)" htmlFor="endsOn" error={errors.endsOn?.message}>
        <input id="endsOn" type="date" className={inputClass} {...register("endsOn")} />
      </Field>

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
