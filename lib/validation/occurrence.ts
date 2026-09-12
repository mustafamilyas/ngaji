import { z } from "zod";
import { ACTIVITY_DATE_RE, ACTIVITY_TIME_RE } from "./activity";
import { OCCURRENCE_STATUSES } from "./enums";

/**
 * One rule date's override (DESIGN.md §5.5 "occurrence.override"): cancel,
 * change time/duration/location/notes, or move once via `overrideDate`.
 * Submitted as a whole (not a partial patch) — the occurrence-edit form
 * always carries every field, defaulting from the current effective values.
 */
export const occurrenceOverrideSchema = z
  .object({
    activityId: z.coerce.number().int().positive(),
    /** The rule-generated date X — the stable key, never the moved-to date. */
    date: z.string().regex(ACTIVITY_DATE_RE, "Tanggal tidak valid"),
    status: z.enum(OCCURRENCE_STATUSES),
    overrideDate: z
      .union([z.literal(""), z.string().regex(ACTIVITY_DATE_RE, "Tanggal tidak valid")])
      .transform((value) => (value ? value : undefined))
      .optional(),
    overrideStartTime: z
      .union([z.literal(""), z.string().regex(ACTIVITY_TIME_RE, "Format jam tidak valid")])
      .transform((value) => (value ? value : undefined))
      .optional(),
    overrideDurationMinutes: z.coerce.number().int().positive().optional(),
    overrideLocation: z
      .union([z.literal(""), z.string().trim().min(1)])
      .transform((value) => (value ? value : undefined))
      .optional(),
    overrideNotes: z
      .union([z.literal(""), z.string().trim().min(1)])
      .transform((value) => (value ? value : undefined))
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.overrideStartTime !== undefined && data.overrideDurationMinutes !== undefined) {
      const [hours, minutes] = data.overrideStartTime.split(":").map(Number);
      if (hours * 60 + minutes + data.overrideDurationMinutes > 1440) {
        ctx.addIssue({
          code: "custom",
          path: ["overrideDurationMinutes"],
          message: "Kegiatan tidak boleh lewat tengah malam",
        });
      }
    }
  });
export type OccurrenceOverrideInput = z.infer<typeof occurrenceOverrideSchema>;
