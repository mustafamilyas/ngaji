import { describe, expect, it } from "vitest";
import { formatLeadsCsv } from "./csv";

const base = {
  createdAt: new Date("2026-10-24T16:30:00Z"),
  name: "Budi",
  phone: "081234567890",
  organizationName: "Majelis An-Nur",
  memberCount: 40,
  message: "Halo",
};

describe("formatLeadsCsv", () => {
  it("writes a header and one row per lead with an ISO timestamp, CRLF-separated", () => {
    expect(formatLeadsCsv([base])).toBe(
      "createdAt,name,phone,organizationName,memberCount,message\r\n" +
        "2026-10-24T16:30:00.000Z,Budi,081234567890,Majelis An-Nur,40,Halo\r\n",
    );
  });

  it("writes only the header for no leads", () => {
    expect(formatLeadsCsv([])).toBe("createdAt,name,phone,organizationName,memberCount,message\r\n");
  });

  it("leaves absent member count and message empty", () => {
    const row = formatLeadsCsv([{ ...base, memberCount: null, message: null }]).split("\r\n")[1];
    expect(row).toBe("2026-10-24T16:30:00.000Z,Budi,081234567890,Majelis An-Nur,,");
  });

  it("quotes cells containing commas, quotes or newlines and doubles inner quotes", () => {
    const csv = formatLeadsCsv([{ ...base, organizationName: "An-Nur, Cabang 2", message: 'Dia bilang "ya"\nlalu pergi' }]);
    expect(csv).toContain('"An-Nur, Cabang 2"');
    expect(csv).toContain('"Dia bilang ""ya""\nlalu pergi"');
  });

  it("neutralizes spreadsheet formulas but keeps a leading + on phone numbers", () => {
    const csv = formatLeadsCsv([{ ...base, name: "=HYPERLINK(\"x\")", phone: "+62 812 3456 7890", message: "@cmd" }]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain(",+62 812 3456 7890,");
    expect(csv).toContain(",'@cmd");
  });
});
