"use server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function login(username: string) {
    try {
        const user = await prisma.user.findFirst({
            where: { Username: username },
            include: { Branch: true }
        });

        if (!user) {
            return { success: false, error: "ไม่พบชื่อผู้ใช้งานนี้ในระบบ" };
        }

        // เก็บ session ง่ายๆ ใน cookie (ในระบบจริงควรใช้ JWT หรือ NextAuth)
        const sessionData = JSON.stringify({
            userId: user.UserID,
            username: user.Username,
            role: user.Role,
            branchId: user.BranchID,
            branchName: user.Branch?.BranchName || ""
        });

        cookies().set("user_session", sessionData, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24, // 1 วัน
            path: "/"
        });

        return {
            success: true,
            role: user.Role,
            redirect: user.Role === 'Admin' ? '/admin/dashboard' : '/user/dashboard'
        };
    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: "เกิดข้อผิดพลาดในการเชื่อมต่อ" };
    }
}

export async function logout() {
    cookies().delete("user_session");
}

export async function getSession() {
    const session = cookies().get("user_session");
    if (!session) return null;
    try {
        return JSON.parse(session.value);
    } catch {
        return null;
    }
}
