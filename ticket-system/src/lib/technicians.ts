// MON-13 (12-05-2026): canonical technician roster.
// "ทีมช่างรับเหมา" REMOVED from this list — it migrated to JobCategory = "ช่างรับเหมา" (MON-11)
// because contractor work is a category, not an individual assignee. Existing tickets where
// Technician == "ทีมช่างรับเหมา" were converted in scripts/migrate-technicians.mjs.

export const TECHNICIANS = [
    "ช่างยศ",
    "ช่างชา",
    "ช่างต้น",
    "ช่างปาด",
    "ช่างสกล",
    "ช่างเขียด",
    "ช่างประวิท",
    "ช่างเดี่ยว"
] as const;

export type TechnicianName = typeof TECHNICIANS[number];

export function isKnownTechnician(value: unknown): value is TechnicianName {
    return typeof value === "string" && (TECHNICIANS as readonly string[]).includes(value);
}
