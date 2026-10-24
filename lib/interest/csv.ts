type LeadRow = {
  createdAt: Date;
  name: string;
  phone: string;
  organizationName: string;
  memberCount: number | null;
  message: string | null;
};

const HEADER = ["createdAt", "name", "phone", "organizationName", "memberCount", "message"];

/** Leads are public input opened in spreadsheets: a cell that would be read as a formula gets a leading `'`. A `+` before a digit is a phone number, not a formula. */
function neutralizeFormula(value: string): string {
  return /^([=@\t\r]|[+-](?!\d))/.test(value) ? `'${value}` : value;
}

function cell(value: string): string {
  const safe = neutralizeFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** RFC 4180 CSV (CRLF) of leads for `pnpm leads --csv`; `createdAt` is an ISO UTC timestamp. */
export function formatLeadsCsv(leads: readonly LeadRow[]): string {
  const rows = leads.map((lead) =>
    [
      lead.createdAt.toISOString(),
      lead.name,
      lead.phone,
      lead.organizationName,
      lead.memberCount === null ? "" : String(lead.memberCount),
      lead.message ?? "",
    ]
      .map(cell)
      .join(","),
  );
  return [HEADER.join(","), ...rows].map((line) => `${line}\r\n`).join("");
}
