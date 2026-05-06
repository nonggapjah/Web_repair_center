"use server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function login(username: string, password?: string) {
    try {
        // ค้นหาผู้ใช้งานจากฐานข้อมูล MSSQL โดยตรง
        const user = await prisma.user.findFirst({
            where: { Username: username },
            include: { Branch: true }
        });

        if (!user) {
            return { success: false, error: "ไม่พบชื่อผู้ใช้งานนี้ในระบบ" };
        }

        // เช็ครหัสผ่าน (ใช้ข้อมูลจากที่สร้างใน MSSQL)
        if ((user as any).Password !== password) {
            return { success: false, error: "รหัสผ่านไม่ถูกต้อง" };
        }

        const techMapping: Record<string, string> = {
            "yot": "ช่างยศ",
            "cha": "ช่างชา",
            "ton": "ช่างต้น",
            "pat": "ช่างปาด",
            "sakol": "ช่างสกล",
            "kiat": "ช่างเขียด",
            "prawit": "ช่างประวิท",
            "deaw": "ช่างเดี่ยว",
            "team": "ทีมช่างรับเหมา"
        };

        const sessionData = JSON.stringify({
            userId: user.UserID,
            username: user.Username,
            displayName: techMapping[user.Username.toLowerCase()] || user.Username,
            role: user.Role,
            branchId: user.BranchID,
            branchName: user.Branch?.BranchName || ""
        });

        const cookieStore = await cookies();
        cookieStore.set("user_session", sessionData, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24, // 1 วัน
            path: "/"
        });

        return {
            success: true,
            role: user.Role,
            redirect: user.Role === 'Admin' ? '/admin/dashboard' : user.Role === 'Technician' ? '/technician/dashboard' : '/user/dashboard'
        };
    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล" };
    }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete("user_session");
}

export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get("user_session");
    if (!session) return null;
    try {
        return JSON.parse(session.value);
    } catch {
        return null;
    }
}
