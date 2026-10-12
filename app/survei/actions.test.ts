import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { type PageFixture, buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/survei" });
  }),
}));

import { auth } from "@/auth";
import {
  createSurveyAction,
  deleteSurveyAction,
  deleteSurveyResponseAction,
  saveSurveyResponseAction,
  updateSurveyAction,
} from "./actions";

const validForm = {
  title: "Kesiapan Ramadhan",
  description: "Survei awal",
  questions: [
    { type: "SINGLE_CHOICE", label: "Siap?", required: true, options: [{ label: "Ya" }, { label: "Tidak" }] },
    { type: "SHORT_TEXT", label: "Catatan", required: false, options: [] },
  ],
};

describe("survei server actions", () => {
  let fixture: PageFixture;

  beforeAll(async () => {
    fixture = await buildPageFixture("survei-actions");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("createSurveyAction", () => {
    it("creates the survey for the caller's own group, ignoring a client groupId", async () => {
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.branch) });

      const result = await createSurveyAction({ ...validForm, groupId: fixture.otherLeaf.id });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const stored = await db.survey.findUniqueOrThrow({ where: { id: result.data.id } });
      expect(stored.groupId).toBe(fixture.branch.id);
    });

    it("rejects a USER with a generic permission error and writes nothing", async () => {
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });
      const before = await db.survey.count();

      const result = await createSurveyAction(validForm);

      expect(result.ok).toBe(false);
      expect(await db.survey.count()).toBe(before);
    });

    it("rejects a blank title with a field message", async () => {
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.branch) });

      const result = await createSurveyAction({ ...validForm, title: "  " });

      expect(result).toEqual({ ok: false, error: "Judul wajib diisi" });
    });
  });

  describe("updateSurveyAction", () => {
    it("rejects a non-numeric survey id with the generic validation error", async () => {
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.branch) });

      expect(await updateSurveyAction("abc", validForm)).toEqual({ ok: false, error: "Data tidak valid" });
    });

    it("lets the owner admin rename the survey", async () => {
      const session = sessionFor(fixture.actorId, "ADMIN", fixture.branch);
      mockAuthSession(auth, { user: session });
      const created = await createSurveyAction(validForm);
      if (!created.ok) throw new Error("setup failed");

      const result = await updateSurveyAction(created.data.id, { ...validForm, title: "Judul baru" });

      expect(result.ok).toBe(true);
      const stored = await db.survey.findUniqueOrThrow({ where: { id: created.data.id } });
      expect(stored.title).toBe("Judul baru");
    });

    it("rejects an ancestor admin (403 path) and leaves the survey untouched", async () => {
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.branch) });
      const created = await createSurveyAction(validForm);
      if (!created.ok) throw new Error("setup failed");

      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
      const result = await updateSurveyAction(created.data.id, { ...validForm, title: "Dibajak" });

      expect(result.ok).toBe(false);
      const stored = await db.survey.findUniqueOrThrow({ where: { id: created.data.id } });
      expect(stored.title).toBe(validForm.title);
    });
  });

  describe("deleteSurveyAction", () => {
    it("soft deletes and redirects to /survei", async () => {
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.branch) });
      const created = await createSurveyAction(validForm);
      if (!created.ok) throw new Error("setup failed");
      const formData = new FormData();
      formData.set("surveyId", String(created.data.id));

      await expect(deleteSurveyAction(null, formData)).rejects.toMatchObject({
        digest: expect.stringContaining("NEXT_REDIRECT"),
      });

      const stored = await db.survey.findUniqueOrThrow({ where: { id: created.data.id } });
      expect(stored.deletedAt).not.toBeNull();
    });

    it("rejects a non-numeric survey id", async () => {
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.branch) });
      const formData = new FormData();
      formData.set("surveyId", "abc");

      expect(await deleteSurveyAction(null, formData)).toEqual({ ok: false, error: "Data tidak valid" });
    });
  });
  describe("saveSurveyResponseAction", () => {
    async function setupSurvey() {
      const survey = await db.survey.create({
        data: {
          groupId: fixture.branch.id,
          createdById: fixture.actorId,
          title: "Isi",
          questions: { create: [{ order: 0, type: "SHORT_TEXT", label: "Catatan", required: true }] },
        },
        include: { questions: true },
      });
      return { surveyId: survey.id, questionId: survey.questions[0].id };
    }

    it("saves the answers for a member in the caller's scope", async () => {
      const { surveyId, questionId } = await setupSurvey();
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });

      const result = await saveSurveyResponseAction({
        surveyId,
        memberId: fixture.memberId,
        answers: [{ questionId, text: "Siap" }],
      });

      expect(result).toEqual({ ok: true, data: { memberId: fixture.memberId } });
      const rows = await db.surveyAnswer.findMany({ where: { response: { surveyId } } });
      expect(rows.map((r) => r.textValue)).toEqual(["Siap"]);
    });

    it("reports a missing required answer without writing", async () => {
      const { surveyId } = await setupSurvey();
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });

      const result = await saveSurveyResponseAction({ surveyId, memberId: fixture.memberId, answers: [] });

      expect(result.ok).toBe(false);
      expect(await db.surveyResponse.count({ where: { surveyId } })).toBe(0);
    });

    it("rejects malformed input generically", async () => {
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });

      expect(await saveSurveyResponseAction({ surveyId: "x", memberId: 1, answers: [] })).toEqual({
        ok: false,
        error: "Data tidak valid",
      });
    });

    it("refuses a user above the owning group", async () => {
      const { surveyId, questionId } = await setupSurvey();
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });

      const result = await saveSurveyResponseAction({
        surveyId,
        memberId: fixture.memberId,
        answers: [{ questionId, text: "Siap" }],
      });

      expect(result.ok).toBe(false);
      expect(await db.surveyResponse.count({ where: { surveyId } })).toBe(0);
    });
  });

  describe("deleteSurveyResponseAction", () => {
    async function setupResponse() {
      const survey = await db.survey.create({
        data: { groupId: fixture.branch.id, createdById: fixture.actorId, title: "Hapus respons" },
      });
      await db.surveyResponse.create({
        data: { surveyId: survey.id, memberId: fixture.memberId, recordedById: fixture.actorId },
      });
      return survey.id;
    }

    it("deletes the response of a member in the caller's scope", async () => {
      const surveyId = await setupResponse();
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });

      const result = await deleteSurveyResponseAction({ surveyId, memberId: fixture.memberId });

      expect(result).toEqual({ ok: true, data: { memberId: fixture.memberId } });
      expect(await db.surveyResponse.count({ where: { surveyId } })).toBe(0);
    });

    it("refuses a user above the owning group and keeps the response", async () => {
      const surveyId = await setupResponse();
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });

      const result = await deleteSurveyResponseAction({ surveyId, memberId: fixture.memberId });

      expect(result.ok).toBe(false);
      expect(await db.surveyResponse.count({ where: { surveyId } })).toBe(1);
    });

    it("rejects malformed input generically", async () => {
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });

      expect(await deleteSurveyResponseAction({ surveyId: "x", memberId: 1 })).toEqual({
        ok: false,
        error: "Data tidak valid",
      });
    });
  });
});
