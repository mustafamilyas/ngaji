import type { DateRangeConfig } from "@/lib/filters";

export type AgeBracket = {
  label: string;
  min: number;
  /** null = no upper bound */
  max: number | null;
};

/** Age brackets in years, computed from `Member.birthDate` at query time. See DESIGN.md §7. */
export const AGE_BRACKETS: AgeBracket[] = [
  { label: "balita", min: 0, max: 5 },
  { label: "anak", min: 6, max: 12 },
  { label: "remaja", min: 13, max: 18 },
  { label: "dewasa", min: 19, max: 59 },
  { label: "lansia", min: 60, max: null },
];

export const DEFAULT_STATS_RANGE_DAYS = 30;
export const CONFLICT_HORIZON_DAYS = 90;
export const PAGE_SIZE = 50;
/** Page size for lists embedded in a detail page (group members, schedule, history, per-occurrence table). */
export const EMBEDDED_PAGE_SIZE = 10;

/** Date range presets per page for the shared filter (`lib/filters.ts`); first listed = shown first. */
export const ACTIVITY_LIST_DATE_RANGE: DateRangeConfig = { modes: ["hari", "minggu", "bulan", "custom"], defaultMode: "minggu" };
/** Statistics default to the last `DEFAULT_STATS_RANGE_DAYS` (30) days — keep `defaultMode` in step with it. */
export const STATS_DATE_RANGE: DateRangeConfig = { modes: ["7h", "30h", "90h", "bulan", "custom"], defaultMode: "30h" };
export const AUDIT_DATE_RANGE: DateRangeConfig = { modes: ["semua", "hari", "7h", "30h", "90h", "custom"], defaultMode: "semua" };

/** bcrypt work factor for password hashing (DESIGN.md §4.1). */
export const BCRYPT_COST = 12;

/** Login rate limiting, computed from AuditLog (DESIGN.md §4.1). */
export const LOGIN_RATE_LIMIT_WINDOW_MINUTES = 15;
export const LOGIN_RATE_LIMIT_MAX_PER_USERNAME = 5;
export const LOGIN_RATE_LIMIT_MAX_PER_IP = 20;

/** Every `AuditLog.action` value the app writes (audit-log spec "Logged actions"), for the `/audit` action filter. */
export const AUDIT_ACTIONS = [
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "user.create",
  "user.update_role",
  "user.move",
  "user.set_active",
  "user.reset_password",
  "user.change_password",
  "group.create",
  "group.update",
  "group.delete",
  "level.rename",
  "member.create",
  "member.update",
  "member.delete",
  "activity.create",
  "activity.update",
  "activity.delete",
  "activity.split",
  "occurrence.override",
  "attendance.save",
] as const;
