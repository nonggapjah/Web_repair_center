// MON-11 (12-05-2026): predefined JobCategory list for admin-editable ticket categorization.
// Stored as plain String in RepairTicket.JobCategory (not enum) to allow future expansion
// without migration. Frontend constrains via this constant; server-side validators may
// optionally reject unknown values.
//
// Special semantics:
// - "ช่างรับเหมา" triggers SupplierName field requirement (see MON-12 + ARC-15)
// - "WrongCategory" status (terminal) is a STATUS flag, not a JobCategory — see MON-11 status notes

export const JOB_CATEGORIES = [
    "ไฟฟ้า",
    "ประปา",
    "แอร์",
    "ตู้แช่",
    "ช่างรับเหมา",
    "Request",
    "Supplier",
    "อื่นๆ"
] as const;

export type JobCategory = typeof JOB_CATEGORIES[number];

export const CONTRACTOR_CATEGORY: JobCategory = "ช่างรับเหมา";

export function isJobCategory(value: unknown): value is JobCategory {
    return typeof value === "string" && (JOB_CATEGORIES as readonly string[]).includes(value);
}
