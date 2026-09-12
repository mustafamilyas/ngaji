import { z } from "zod";
import { FREQS } from "./enums";

export const ACTIVITY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const ACTIVITY_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function startMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** The recurrence-template fields, shared by `activitySchema` and `activitySplitSchema` (the split's "new template from X onward" carries the same shape, minus `groupId`). */
export const activityFieldsSchema = z.object({
  groupId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1),
  location: z.string().trim().min(1),
  notes: z
    .string()
    .trim()
    .transform((value) => (value ? value : undefined))
    .optional(),
  startTime: z.string().regex(ACTIVITY_TIME_RE, "Format jam tidak valid"),
  durationMinutes: z.number().int().positive(),
  freq: z.enum(FREQS),
  interval: z.number().int().min(1),
  weekdays: z.array(z.number().int().min(0).max(6)),
  // The form converts an empty <input type=number> to `undefined` itself
  // (`setValueAs`), so this only ever sees a real number or nothing.
  monthDay: z.number().int().min(1).max(31).optional(),
  startsOn: z.string().regex(ACTIVITY_DATE_RE, "Tanggal tidak valid"),
  endsOn: z
    .union([z.literal(""), z.string().regex(ACTIVITY_DATE_RE, "Tanggal tidak valid")])
    .transform((value) => (value ? value : undefined))
    .optional(),
});

/** Refinements shared by `activitySchema` and `activitySplitSchema`. See DESIGN.md §5.1. */
export function refineActivityFields(
  data: {
    startTime: string;
    durationMinutes: number;
    freq: string;
    interval: number;
    weekdays: number[];
    monthDay?: number;
    startsOn: string;
    endsOn?: string;
  },
  ctx: z.RefinementCtx,
) {
    if (startMinutes(data.startTime) + data.durationMinutes > 1440) {
      ctx.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "Kegiatan tidak boleh lewat tengah malam",
      });
    }

    if (data.endsOn !== undefined && data.endsOn < data.startsOn) {
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "Tanggal akhir harus sama atau setelah tanggal mulai",
      });
    }

    if (data.freq === "ONCE") {
      if (data.endsOn !== undefined && data.endsOn !== data.startsOn) {
        ctx.addIssue({
          code: "custom",
          path: ["endsOn"],
          message: "Kegiatan sekali harus berakhir pada tanggal mulai",
        });
      }
      if (data.interval !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["interval"],
          message: "Kegiatan sekali harus memiliki interval 1",
        });
      }
    }

    if (data.freq === "WEEKLY") {
      if (data.weekdays.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["weekdays"],
          message: "Pilih minimal satu hari",
        });
      } else if (new Set(data.weekdays).size !== data.weekdays.length) {
        ctx.addIssue({
          code: "custom",
          path: ["weekdays"],
          message: "Hari tidak boleh berulang",
        });
      }
    }

  if (data.freq === "MONTHLY" && data.monthDay === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["monthDay"],
      message: "Tanggal bulan wajib diisi",
    });
  }
}

/** Shared by the activity form and the Server Action. See DESIGN.md §5.1. */
export const activitySchema = activityFieldsSchema.superRefine(refineActivityFields);
export type ActivityInput = z.infer<typeof activitySchema>;

/** `activitySchema` without `groupId` — the owning group never changes on update. */
export const activityUpdateSchema = activityFieldsSchema.omit({ groupId: true }).superRefine(refineActivityFields);
export type ActivityUpdateInput = z.infer<typeof activityUpdateSchema>;

/**
 * "Move this and following" (DESIGN.md §5.5): the new template's fields, minus
 * `groupId` (a split never changes the owning group). `startsOn` here doubles
 * as `fromDate` X — the rule date the change applies from — since a new
 * activity anchored at X naturally produces its own first occurrence on or
 * after X (`expandDates`), matching the spec's "startsOn = tanggal baru".
 */
export const activitySplitSchema = activityFieldsSchema
  .omit({ groupId: true })
  .extend({ activityId: z.coerce.number().int().positive() })
  .superRefine(refineActivityFields);
export type ActivitySplitInput = z.infer<typeof activitySplitSchema>;

export const endActivitySchema = z.object({
  activityId: z.coerce.number().int().positive(),
  fromDate: z.string().regex(ACTIVITY_DATE_RE, "Tanggal tidak valid"),
});
export type EndActivityInput = z.infer<typeof endActivitySchema>;

export const deleteActivitySchema = z.object({
  activityId: z.coerce.number().int().positive(),
});
export type DeleteActivityInput = z.infer<typeof deleteActivitySchema>;
