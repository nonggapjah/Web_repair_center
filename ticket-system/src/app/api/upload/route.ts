import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// เพิ่มการตั้งค่าเพื่อรองรับไฟล์ขนาดใหญ่
export const config = {
    api: {
        bodyParser: false, // ปิดตัวจัดการพื้นฐานเพื่อรองรับไฟล์ใหญ่
    },
};

export const maxDuration = 60; // เพิ่มเวลาประมวลผลเป็น 60 วินาที

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('files') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }

        const uploadDir = join(process.cwd(), 'public', 'uploads');
        
        // Ensure directory exists
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (err) {
            // Already exists
        }

        const urls: string[] = [];

        for (const file of files) {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const path = join(uploadDir, fileName);

            await writeFile(path, buffer);
            
            // Generate local URL
            urls.push(`/uploads/${fileName}`);
        }

        return NextResponse.json({ urls });
    } catch (error: any) {
        console.error('Upload API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
