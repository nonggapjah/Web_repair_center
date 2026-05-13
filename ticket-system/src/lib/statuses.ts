// MON-11 (12-05-2026): canonical ticket status list, including "WrongCategory" terminal state.
// "WrongCategory" = "ไม่ใช่งานช่าง" — admin marks ticket as out-of-scope (e.g., IT work that
// branch mistakenly filed via the repair system). Terminal — no revert; branch must re-file.
//
// Frontend (admin/dashboard/page.tsx + technician/user views) imports from here so all UIs
// remain in sync when the catalog changes.

export const TICKET_STATUSES = [
    "Open",
    "On Process",
    "Repairing",
    "Waiting Parts",
    "Completed",
    "Closed",
    "WrongCategory"
] as const;

export type TicketStatus = typeof TICKET_STATUSES[number];

// Statuses an admin may transition INTO via the dashboard.
// "Closed" is reached via user signature flow; "WrongCategory" via the dedicated reject button (ARC-11).
export const ADMIN_SELECTABLE_STATUSES = [
    "Open",
    "On Process",
    "Repairing",
    "Waiting Parts",
    "Completed"
] as const;

// Terminal statuses — no further transitions allowed (used by ARC-11 to gate the reject button).
export const TERMINAL_STATUSES: readonly TicketStatus[] = ["Closed", "WrongCategory"] as const;

export const STATUS_TH: Record<TicketStatus, string> = {
    "Open": "แจ้งซ่อมใหม่",
    "On Process": "รับเรื่องแล้ว",
    "Repairing": "กำลังเข้าซ่อม",
    "Waiting Parts": "รออะไหล่",
    "Completed": "ซ่อมเรียบร้อย",
    "Closed": "ปิดงานถาวร",
    "WrongCategory": "แจ้งงานผิดประเภท"
};

export const STATUS_COLOR: Record<TicketStatus, string> = {
    "Open": "#3b82f6",
    "On Process": "#8b5cf6",
    "Repairing": "#f59e0b",
    "Waiting Parts": "#ef4444",
    "Completed": "#10b981",
    "Closed": "#64748b",
    "WrongCategory": "#94a3b8"
};

export function isTicketStatus(value: unknown): value is TicketStatus {
    return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}

export function isTerminalStatus(value: TicketStatus): boolean {
    return TERMINAL_STATUSES.includes(value);
}
