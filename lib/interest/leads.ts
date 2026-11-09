import { db } from "@/lib/db";

type LeadRow = {
  createdAt: Date;
  name: string;
  phone: string;
  organizationName: string;
  memberCount: number | null;
  message: string | null;
};

const COLUMNS: { title: string; value: (lead: LeadRow) => string }[] = [
  { title: "waktu (UTC)", value: (lead) => lead.createdAt.toISOString().slice(0, 16).replace("T", " ") },
  { title: "nama", value: (lead) => oneLine(lead.name) },
  { title: "whatsapp", value: (lead) => oneLine(lead.phone) },
  { title: "organisasi", value: (lead) => oneLine(lead.organizationName) },
  { title: "anggota", value: (lead) => (lead.memberCount === null ? "-" : String(lead.memberCount)) },
  { title: "pesan", value: (lead) => oneLine(lead.message ?? "") || "-" },
];

/** Free text from the public form must not break the one-line-per-lead layout. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** `pnpm leads [--csv]`; null for anything else so the script can print usage. */
export function parseLeadsArgs(args: readonly string[]): { csv: boolean } | null {
  if (args.length === 0) return { csv: false };
  if (args.length === 1 && args[0] === "--csv") return { csv: true };
  return null;
}

/** Plain-text table for `pnpm leads`, columns padded to the widest cell; the last column is not padded. */
export function formatLeadsTable(leads: readonly LeadRow[]): string {
  if (leads.length === 0) return "Belum ada lead.";
  const rows = [COLUMNS.map((c) => c.title), ...leads.map((lead) => COLUMNS.map((c) => c.value(lead)))];
  const widths = COLUMNS.map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows
    .map((r) => r.map((cell, i) => (i === r.length - 1 ? cell : cell.padEnd(widths[i]))).join("  "))
    .join("\n");
}

/** Read-only: newest first, ties by id. Leads belong to no organization, so there is no scope to apply. */
export function listLeads() {
  return db.interestLead.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
}
