import { z } from "zod";
import { VIEW_MAX_AGE, VIEW_MAX_AGE_BUCKETS, VIEW_MAX_BUCKET_LABEL_LENGTH, VIEW_MAX_GROUP_LEVEL } from "@/lib/constants";
import { GROUPABLE_FIELDS } from "@/lib/member-view/fields";

/**
 * Summary dimensions (member-summaries spec): what a "Ringkasan" card, the
 * Statistik "Per tag" card and the attendance breakdown can count by. The
 * age-bucket and org-level shapes are shared with the view's group-by
 * (`lib/validation/member-view.ts`); tag IDs are only shape-checked here and
 * resolved against the viewer's visible tags by the caller.
 */

const ageBucketSchema = z
  .object({
    label: z.string().trim().min(1).max(VIEW_MAX_BUCKET_LABEL_LENGTH),
    min: z.number().int().min(0).max(VIEW_MAX_AGE),
    max: z.number().int().min(0).max(VIEW_MAX_AGE).nullable(),
  })
  .strict()
  .refine((b) => b.max === null || b.max >= b.min, { message: "Batas usia tidak valid" });

export const ageBucketsDimensionSchema = z
  .object({ kind: z.literal("ageBuckets"), buckets: z.array(ageBucketSchema).min(1).max(VIEW_MAX_AGE_BUCKETS) })
  .strict()
  .superRefine((value, ctx) => {
    const sorted = [...value.buckets].sort((a, b) => a.min - b.min);
    for (let i = 1; i < sorted.length; i++) {
      const prevMax = sorted[i - 1].max;
      if (prevMax === null || sorted[i].min <= prevMax) {
        ctx.addIssue({ code: "custom", message: "Rentang usia saling tumpang tindih", path: ["buckets"] });
        return;
      }
    }
  });

export const groupLevelDimensionSchema = z
  .object({ kind: z.literal("groupLevel"), depth: z.number().int().min(0).max(VIEW_MAX_GROUP_LEVEL) })
  .strict();

export const propertyDimensionSchema = z
  .object({ kind: z.literal("property"), field: z.enum(GROUPABLE_FIELDS as [(typeof GROUPABLE_FIELDS)[number], ...(typeof GROUPABLE_FIELDS)[number][]]) })
  .strict();

const tagId = z.number().int().positive();

export const dimensionSchema = z.discriminatedUnion("kind", [
  propertyDimensionSchema,
  ageBucketsDimensionSchema,
  groupLevelDimensionSchema,
  z.object({ kind: z.literal("tagKey"), tagId }).strict(),
  z.object({ kind: z.literal("tag"), tagId }).strict(),
]);
export type Dimension = z.infer<typeof dimensionSchema>;

/** One summary = a count per bucket of one dimension. An object so it can grow options later. */
export const summarySchema = z.object({ dimension: dimensionSchema }).strict();
export type Summary = z.infer<typeof summarySchema>;
