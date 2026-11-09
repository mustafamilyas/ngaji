import { describe, expect, it } from "vitest";
import { VIEW_MAX_AGE_BUCKETS, VIEW_MAX_GROUP_LEVEL } from "@/lib/constants";
import { dimensionSchema, summarySchema } from "./summary";

const buckets = (b: unknown[]) => ({ kind: "ageBuckets", buckets: b });

describe("dimensionSchema", () => {
  it("accepts every dimension kind", () => {
    for (const dimension of [
      { kind: "property", field: "sex" },
      { kind: "property", field: "status" },
      { kind: "property", field: "maritalStatus" },
      { kind: "property", field: "workStatus" },
      buckets([{ label: "Remaja", min: 13, max: 17 }, { label: "Lansia", min: 60, max: null }]),
      { kind: "groupLevel", depth: 2 },
      { kind: "tagKey", tagId: 7 },
      { kind: "tag", tagId: 7 },
    ]) {
      expect(dimensionSchema.safeParse(dimension).success, JSON.stringify(dimension)).toBe(true);
    }
  });

  it("rejects an unknown kind", () => {
    expect(dimensionSchema.safeParse({ kind: "phone" }).success).toBe(false);
    expect(dimensionSchema.safeParse({ kind: "property", field: "age" }).success).toBe(false);
    expect(dimensionSchema.safeParse({ kind: "property", field: "birthPlace" }).success).toBe(false);
  });

  it("rejects extra keys", () => {
    expect(dimensionSchema.safeParse({ kind: "property", field: "sex", extra: 1 }).success).toBe(false);
    expect(dimensionSchema.safeParse({ kind: "tag", tagId: 1, key: "x" }).success).toBe(false);
  });

  it("rejects overlapping age buckets", () => {
    expect(dimensionSchema.safeParse(buckets([{ label: "A", min: 13, max: 17 }, { label: "B", min: 17, max: 25 }])).success).toBe(false);
    expect(dimensionSchema.safeParse(buckets([{ label: "A", min: 13, max: null }, { label: "B", min: 20, max: 25 }])).success).toBe(false);
  });

  it("rejects bad age bucket bounds, labels and counts", () => {
    expect(dimensionSchema.safeParse(buckets([{ label: "A", min: 10, max: 5 }])).success).toBe(false);
    expect(dimensionSchema.safeParse(buckets([{ label: " ", min: 1, max: 5 }])).success).toBe(false);
    expect(dimensionSchema.safeParse(buckets([])).success).toBe(false);
    const many = Array.from({ length: VIEW_MAX_AGE_BUCKETS + 1 }, (_, i) => ({ label: `B${i}`, min: i * 10, max: i * 10 + 9 }));
    expect(dimensionSchema.safeParse(buckets(many)).success).toBe(false);
  });

  it("rejects a bad org level depth", () => {
    expect(dimensionSchema.safeParse({ kind: "groupLevel", depth: -1 }).success).toBe(false);
    expect(dimensionSchema.safeParse({ kind: "groupLevel", depth: VIEW_MAX_GROUP_LEVEL + 1 }).success).toBe(false);
    expect(dimensionSchema.safeParse({ kind: "groupLevel", depth: 1.5 }).success).toBe(false);
  });

  it("rejects a tag id that is not a positive integer", () => {
    for (const tagId of [0, -1, 1.5, "3", null]) {
      expect(dimensionSchema.safeParse({ kind: "tagKey", tagId }).success, String(tagId)).toBe(false);
      expect(dimensionSchema.safeParse({ kind: "tag", tagId }).success, String(tagId)).toBe(false);
    }
  });
});

describe("summarySchema", () => {
  it("wraps one dimension", () => {
    expect(summarySchema.safeParse({ dimension: { kind: "property", field: "sex" } }).success).toBe(true);
  });

  it("rejects a missing dimension and extra keys", () => {
    expect(summarySchema.safeParse({}).success).toBe(false);
    expect(summarySchema.safeParse({ dimension: { kind: "property", field: "sex" }, title: "x" }).success).toBe(false);
  });
});
