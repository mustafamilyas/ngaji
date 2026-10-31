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
/** The activity calendar shows whole calendar periods only, so no free from–to range. */
export const ACTIVITY_CALENDAR_DATE_RANGE: DateRangeConfig = { modes: ["hari", "minggu", "bulan"], defaultMode: "minggu" };
/** Longest range the printable schedule accepts, in calendar months. */
export const PRINT_MAX_MONTHS = 3;
/** Statistics default to the last `DEFAULT_STATS_RANGE_DAYS` (30) days — keep `defaultMode` in step with it. */
export const STATS_DATE_RANGE: DateRangeConfig = { modes: ["7h", "30h", "90h", "bulan", "custom"], defaultMode: "30h" };
export const AUDIT_DATE_RANGE: DateRangeConfig = { modes: ["semua", "hari", "7h", "30h", "90h", "custom"], defaultMode: "semua" };

/** Upper bounds on client-supplied text and lists (input-validation spec). Reject, never truncate. */
export const MAX_NAME_LENGTH = 200;
export const MAX_LOCATION_LENGTH = 200;
export const MAX_NOTES_LENGTH = 1000;
/** Notes this long (or multi-line) get a "Selengkapnya" toggle in the activity list; shorter ones are shown as is. */
export const OCCURRENCE_NOTES_EXPAND_FROM = 60;
export const MAX_ATTENDANCE_ENTRIES = 1000;
/** Reason (alasan) stored with an IZIN attendance row. */
export const MAX_ATTENDANCE_NOTE_LENGTH = 500;
export const MAX_WEEKDAYS = 7;
export const MAX_GROUP_FILTER_IDS = 50;

/** Survey form limits and defaults (member-surveys spec). Reject, never truncate. */
export const SURVEY_TITLE_MAX = 200;
export const SURVEY_MAX_QUESTIONS = 100;
export const SURVEY_MAX_OPTIONS = 50;
export const SURVEY_DESCRIPTION_MAX = MAX_NOTES_LENGTH;
export const SURVEY_QUESTION_LABEL_MAX = 300;
export const SURVEY_HELP_TEXT_MAX = 500;
export const SURVEY_OPTION_LABEL_MAX = 200;
export const SHORT_TEXT_MAX = 200;
export const LONG_TEXT_MAX = 2000;
export const SCALE_MAX_STEPS = 11;
export const SCALE_DEFAULT_MIN = 1;
export const SCALE_DEFAULT_MAX = 5;

/** Member view limits (member-view-query spec). Reject, never truncate. */
export const VIEW_MAX_RULE_GROUPS = 10;
export const VIEW_MAX_RULES_PER_GROUP = 10;
export const VIEW_MAX_AGE_BUCKETS = 12;
export const VIEW_MAX_TEXT_VALUE_LENGTH = 100;
export const VIEW_MAX_WITHIN_DAYS = 3650;
export const VIEW_MAX_AGE = 150;
export const VIEW_MAX_GROUP_IDS = 50;
export const VIEW_MAX_BUCKET_LABEL_LENGTH = 50;
/** Deepest org level a view may group by (levels are depth 0 = root). */
export const VIEW_MAX_GROUP_LEVEL = 20;
/** Members loaded per section in a grouped view, and per "Tampilkan lebih banyak" click. */
export const VIEW_SECTION_PAGE_SIZE = 25;
/** Sections that start expanded; the rest start collapsed. */
export const VIEW_EXPANDED_SECTIONS = 5;
/** Most in-scope groups offered in the view editor's group picker. */
export const VIEW_GROUP_OPTIONS_LIMIT = 500;
/** Max length (characters) of the base64url `?d=` URL draft. */
export const VIEW_MAX_DRAFT_LENGTH = 4000;
/** Most summaries ("Ringkasan") one member view may hold. */
export const VIEW_MAX_SUMMARIES = 6;
/** Buckets drawn in a summary chart; a summary with more buckets also gets a paginated table. */
export const SUMMARY_MAX_BARS = 12;

/** bcrypt work factor for password hashing (DESIGN.md §4.1). */
export const BCRYPT_COST = 12;

/** Login rate limiting, computed from AuditLog (DESIGN.md §4.1). */
export const LOGIN_RATE_LIMIT_WINDOW_MINUTES = 15;
export const LOGIN_RATE_LIMIT_MAX_PER_USERNAME = 5;
export const LOGIN_RATE_LIMIT_MAX_PER_IP = 20;

/** Public interest form (/daftar) rate limiting, computed from AuditLog `lead.create` rows per IP. */
export const INTEREST_RATE_LIMIT_MAX_PER_IP = 5;
export const INTEREST_RATE_LIMIT_WINDOW_MINUTES = 60;

/** Bounds for the public interest form fields. */
export const INTEREST_MAX_FIELD_LENGTH = 100;
export const INTEREST_MAX_MESSAGE_LENGTH = 1000;
export const INTEREST_MAX_MEMBER_COUNT = 100_000;

/** Every `AuditLog.action` value the app writes (audit-log spec "Logged actions"), for the `/dashboard/audit` action filter. */
export const AUDIT_ACTIONS = [
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "user.create",
  "user.update_role",
  "user.add_extra_role",
  "user.remove_extra_role",
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
  "survey.create",
  "survey.update",
  "survey.delete",
  "survey_response.save",
  "survey_response.delete",
  "member_view.create",
  "member_view.update",
  "member_view.delete",
  "member_view.transfer",
  "tag.create",
  "tag.update",
  "tag.delete",
  "member.tag",
  "member.untag",
  "activity.tag",
  "activity.untag",
] as const;

/** Tag limits (tags spec). Reject, never truncate. */
export const TAG_MAX_PART_LENGTH = 30;
export const TAG_MAX_PER_GROUP = 100;
export const TAG_MAX_PER_ENTITY = 20;
export const MAX_TAG_FILTER_IDS = 50;
/** Fixed tag palette; `components/tags/tag-chip.tsx` maps each token to checked-contrast classes. */
/** Color of a tag created from the picker; the owner group recolors it from its Tag tab. */
export const TAG_DEFAULT_COLOR = "slate" as const;
export const TAG_COLORS = ["slate", "red", "orange", "amber", "green", "teal", "blue", "indigo", "purple", "pink"] as const;
