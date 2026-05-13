// MON-12 (12-05-2026): predefined Supplier list for ช่างรับเหมา jobs.
// "อื่นๆ" is a UI-only sentinel — when selected, frontend renders a free-text input
// and the resulting custom string is stored directly in SupplierName (not the literal "อื่นๆ").
// So DB values are: "24fis" | "123" | <custom string> | NULL — never literally "อื่นๆ".

export const SUPPLIERS = ["24fis", "123", "อื่นๆ"] as const;

export type SupplierOption = typeof SUPPLIERS[number];

export const OTHER_SUPPLIER_SENTINEL: SupplierOption = "อื่นๆ";

// Validation: when JobCategory == "ช่างรับเหมา", SupplierName MUST be a non-empty string.
// Used by both server actions (MON-12) and UI form gating (ARC-15).
export function requiresSupplier(jobCategory: string | null | undefined): boolean {
    return jobCategory === "ช่างรับเหมา";
}

export function isValidSupplierFor(
    jobCategory: string | null | undefined,
    supplierName: string | null | undefined
): boolean {
    if (!requiresSupplier(jobCategory)) return true;
    return typeof supplierName === "string" && supplierName.trim().length > 0;
}
