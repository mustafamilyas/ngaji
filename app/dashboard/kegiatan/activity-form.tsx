"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Save } from "lucide-react";
import { createActivityAction, splitActivityAction, updateActivityAction } from "@/app/dashboard/kegiatan/actions";
import { Button } from "@/components/ui/button";
import { touchField } from "@/components/ui/touch";
import { cn } from "@/lib/utils";
import { activityUpdateSchema, type ActivityUpdateInput } from "@/lib/validation/activity";
import { FREQS } from "@/lib/validation/enums";

const inputClass = touchField;
const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 xl:min-h-16 xl:text-sm";

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

type ActivityFormProps =
  | {
      mode: "create";
      /** The organization's "today" (`YYYY-MM-DD`), computed on the server. */
      today: string;
      /** Groups the user may own an activity for (ADMIN+ role there); the first is preselected. */
      ownerGroups: { id: number; name: string; parentName?: string }[];
    }
  | { mode: "edit"; activityId: number; defaultValues: ActivityUpdateInput }
  | { mode: "split"; activityId: number; defaultValues: ActivityUpdateInput };

const emptyDefaults = (today: string): ActivityUpdateInput => ({
  name: "",
  location: "",
  notes: undefined,
  startTime: "19:00",
  durationMinutes: 60,
  freq: "WEEKLY",
  interval: 1,
  weekdays: [0],
  monthDay: undefined,
  startsOn: today,
  endsOn: undefined,
});

export function ActivityForm(props: ActivityFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ownerGroupId, setOwnerGroupId] = useState(props.mode === "create" ? props.ownerGroups[0]?.id : undefined);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ActivityUpdateInput>({
    resolver: zodResolver(activityUpdateSchema),
    defaultValues: props.mode === "create" ? emptyDefaults(props.today) : props.defaultValues,
  });
  const freq = useWatch({ control, name: "freq" });
  const weekdays = useWatch({ control, name: "weekdays" });

  function toggleWeekday(day: number) {
    const next = weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day].sort();
    setValue("weekdays", next, { shouldValidate: true });
  }

  function onSubmit(values: ActivityUpdateInput) {
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createActivityAction({ ...values, groupId: ownerGroupId })
          : props.mode === "edit"
            ? await updateActivityAction(props.activityId, values)
            : await splitActivityAction({ ...values, activityId: props.activityId });

      if (!result.ok) {
        setError("root", { message: result.error });
        return;
      }
      const suffix = result.data.hasConflict ? "?conflict=1" : "";
      router.push(`/dashboard/kegiatan/${result.data.activity.id}${suffix}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      {props.mode === "create" && (
        <Field label="Grup pemilik" htmlFor="ownerGroupId" wide>
          <select
            id="ownerGroupId"
            className={inputClass}
            value={ownerGroupId}
            onChange={(event) => setOwnerGroupId(Number(event.target.value))}
          >
            {props.ownerGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.parentName ? `${group.name} (${group.parentName})` : group.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Kegiatan berlaku untuk grup ini dan semua turunannya.</p>
        </Field>
      )}

      <Field label="Nama" htmlFor="name" error={errors.name?.message}>
        <input id="name" className={inputClass} {...register("name")} />
      </Field>

      <Field label="Lokasi" htmlFor="location" error={errors.location?.message}>
        <input id="location" className={inputClass} {...register("location")} />
      </Field>

      <Field label="Catatan (opsional)" htmlFor="notes" error={errors.notes?.message} wide>
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
        <Field label="Hari" htmlFor="weekdays" error={errors.weekdays?.message} wide>
          <div id="weekdays" className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, day) => (
              <label
                key={day}
                className="flex min-h-11 items-center gap-2 rounded-md border border-input px-3 text-base xl:min-h-8 xl:px-2 xl:text-sm"
              >
                <input
                  type="checkbox"
                  className="size-5 xl:size-4"
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
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {errors.root.message}
        </p>
      )}

      <div className="flex justify-end border-t pt-4 sm:col-span-2">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          <Save />
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
