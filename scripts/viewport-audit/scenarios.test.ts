import { describe, expect, it } from "vitest";
import type { SeedIds } from "./pages";
import { locateExpression } from "./scenario-runner";
import { buildScenarios, SCENARIO_VIEWPORTS } from "./scenarios";

const ids: SeedIds = {
  memberId: 5,
  branchGroupId: 3,
  leafGroupId: 4,
  activityId: 7,
  attendanceDate: "2026-10-04",
  surveyId: 1,
  viewId: 2,
  keyTagId: 9,
  pagedActivityId: 11,
};

describe("buildScenarios", () => {
  it("runs at the phone, small tablet and landscape phone sizes the tag task names", () => {
    expect(SCENARIO_VIEWPORTS.map((v) => `${v.width}x${v.height}`)).toEqual(["375x812", "768x1024", "812x375"]);
  });

  it("covers the picker, bulk bar, filters, group tag tab and its dialogs", () => {
    const states = buildScenarios(ids).flatMap((s) => s.steps.flatMap((step) => ("measure" in step && step.measure ? [step.measure] : [])));
    for (const state of ["picker open", "one row selected", "add chooser open", "filter open", "tab", "new tag dialog", "recolor dialog", "delete dialog"]) {
      expect(states).toContain(state);
    }
  });

  it("runs the tag tab as the admin of the group that owns the seeded tags", () => {
    const scenario = buildScenarios(ids).find((s) => s.name === "group tag tab");
    expect(scenario).toMatchObject({ role: "admin", path: "/dashboard/grup/3?tab=tag" });
  });

  it("skips detail flows whose seed row is missing", () => {
    const names = buildScenarios({ ...ids, memberId: null, activityId: null, branchGroupId: null }).map((s) => s.name);
    expect(names).not.toContain("member detail tag picker");
    expect(names).not.toContain("activity detail tag picker");
    expect(names).not.toContain("group tag tab");
  });
});

describe("locateExpression", () => {
  it("embeds the selector and text as data, not code", () => {
    const expression = locateExpression({ selector: `button[aria-label="x"]`, text: `"); alert(1); ("` });
    expect(() => new Function(`return ${expression}`)).not.toThrow();
    expect(expression).toContain(JSON.stringify(`"); alert(1); ("`));
  });
});
