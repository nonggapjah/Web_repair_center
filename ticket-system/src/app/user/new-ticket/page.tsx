"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createTicket } from '@/app/actions/tickets';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/app/actions/auth';
import Link from 'next/link';
import { Suspense } from 'react';

const PRODUCT_OPTIONS: Record<string, string[]> = {
    "เครื่องใช้ไฟฟ้า": ["เครื่องพิมพ์ใบเสร็จ", "เครื่องสแกนบาร์โค้ด", "เครื่องรูดบัตร", "พัดลม", "ไมโครเวฟ", "กาน้ำร้อน", "อื่นๆ"],
    "งานไฟ": ["หลอดไฟ/ป้ายสาขา", "ปลั๊กไฟ/เต้ารับ", "ตู้เบรกเกอร์/ตู้ไฟ", "เครื่องสำรองไฟ (UPS)", "สวิตช์ไฟ", "อื่นๆ"],
    "งานซ่อมบำรุง": ["ประตูอัตโนมัติ", "แอร์/เครื่องปรับอากาศ", "ประตูห้องน้ำ/ลูกบิด", "ก๊อกน้ำ/อ่างล้างมือ", "ชักโครก/สายชำระ", "พื้น/กระเบื้อง/เพดาน", "อื่นๆ"],
    "งานตู้แช่": ["ตู้แช่เย็น (Chiller)", "ตู้แช่แข็ง (Freezer)", "ตู้แช่ไวน์", "ห้องเย็น (Cold Room)", "ตู้แช่เคาน์เตอร์", "อื่นๆ"],
    "งานซ่อมทั่วไป": ["เคาน์เตอร์แคชเชียร์", "ชั้นวางสินค้า (Gondola)", "รถเข็นสินค้า", "โต๊ะ/เก้าอี้พนักงาน", "ป้ายโปรโมชั่น", "อื่นๆ"],
    "งานรับเหมา": ["งานทาสี", "งานปรับปรุงโครงสร้าง", "งานกันสาด/หน้าร้าน", "งานระบบประปาหลัก", "อื่นๆ"]
};

function NewTicketForm() {
    const searchParams = useSearchParams();
    const [formData, setFormData] = useState({
        product: '',
        symptom: '',
        description: '',
        branchId: '',
        requestDate: ''
    });
    const [branchName, setBranchName] = useState('');
    const [otherProductName, setOtherProductName] = useState('');

    useEffect(() => {
        const init = async () => {
            const session = await getSession();
            if (session) {
                setFormData(prev => ({ ...prev, branchId: session.branchId }));
                setBranchName(session.branchName);
            }
        };
        init();
    }, [searchParams]);

    const [filePreviews, setFilePreviews] = useState<{ url: string, type: string }[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const processedFiles: File[] = [];
        
        for (const file of files) {
            const isHeic = file.name.match(/\.(heic|heif)$/i);
            if (isHeic) {
                try {
                    const heic2any = (await import('heic2any')).default;
                    const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
                    const blobArray = Array.isArray(convertedBlob) ? convertedBlob : [convertedBlob];
                    const newFile = new File([blobArray[0]], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
                    processedFiles.push(newFile);
                } catch (err) {
                    console.error("HEIC conversion failed", err);
                    processedFiles.push(file);
                }
            } else {
                processedFiles.push(file);
            }
        }

        setSelectedFiles(prev => [...prev, ...processedFiles]);
        
        processedFiles.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFilePreviews(prev => [...prev, { url: reader.result as string, type: file.type }]);
            };
            reader.readAsDataURL(file);
        });
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        if (!formData.symptom) {
            setError('กรุณาระบุหมวดหมู่การซ่อมบำรุง');
            setIsSubmitting(false);
            return;
        }

        if (!formData.product) {
            setError('กรุณาระบุชนิดอุปกรณ์ที่มีปัญหา');
            setIsSubmitting(false);
            return;
        }

        if (formData.product === 'อื่นๆ' && !otherProductName) {
            setError('กรุณาระบุชื่ออุปกรณ์ที่ต้องการแจ้งซ่อม');
            setIsSubmitting(false);
            return;
        }

        if (!formData.description) {
            setError('กรุณาระบุรายละเอียดปัญหา');
            setIsSubmitting(false);
            return;
        }

        if (!formData.requestDate) {
            setError('กรุณาระบุวันที่ต้องการให้เข้างาน');
            setIsSubmitting(false);
            return;
        }

        if (selectedFiles.length === 0) {
            setError('กรุณาแนบรูปภาพหรือวิดิโอหลักฐาน');
            setIsSubmitting(false);
            return;
        }

        try {
            let publicUrls: string[] = [];

            for (const file of selectedFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('tickets').upload(fileName, file);
                if (uploadError) throw new Error('Upload failed');
                const { data } = supabase.storage.from('tickets').getPublicUrl(fileName);
                publicUrls.push(data.publicUrl);
            }

            const finalData = {
                ...formData,
                product: formData.product === 'อื่นๆ' ? `อื่นๆ: ${otherProductName}` : formData.product,
                imageURL: publicUrls.join(',')
            };

            const result = await createTicket(finalData);
            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    window.location.href = '/user/dashboard';
                }, 1500);
            } else {
                setError(result.error || 'เกิดข้อผิดพลาด');
            }
        } catch (err: any) {
            console.error('Submit error:', err);
            setError(err.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="container animate-fade-in" style={{ padding: '2rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', textAlign: 'center', position: 'relative' }}>
                <Link href="/user/dashboard" style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    textDecoration: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1rem',
                    background: 'rgba(0,0,0,0.05)',
                    borderRadius: '8px'
                }}>
                    <span>← กลับ</span>
                </Link>
                <h1 style={{ color: 'var(--accent-primary)', fontSize: '2.5rem' }}>ส่งคำขอแจ้งซ่อม</h1>
                <p style={{ color: 'var(--text-muted)' }}>พนักงานสาขา {formData.branchId} ({branchName || '...' })</p>
            </div>

            <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2.5rem' }}>
                {error && <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</div>}
                {success && <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--accent-success)', color: 'var(--accent-success)', borderRadius: '8px', marginBottom: '1.5rem' }}>ส่งข้อมูลแจ้งซ่อมเรียบร้อยแล้ว!</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>สาขาที่แจ้ง</label>
                        <input type="text" className="input-glass" value={`${formData.branchId} - ${branchName || 'กำลังโหลด...'}`} disabled style={{ opacity: 0.7 }} />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>หมวดหมู่ปัญหา <span style={{ color: 'red' }}>*</span></label>
                        <select className="input-glass" value={formData.symptom} onChange={e => setFormData({ ...formData, symptom: e.target.value })} style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
                            <option value="" disabled>เลือกประเภทปัญหา</option>
                            <option value="เครื่องใช้ไฟฟ้า">เครื่องใช้ไฟฟ้า</option>
                            <option value="งานไฟ">งานไฟ</option>
                            <option value="งานซ่อมบำรุง">งานซ่อมบำรุง</option>
                            <option value="งานตู้แช่">งานตู้แช่</option>
                            <option value="งานซ่อมทั่วไป">งานซ่อมทั่วไป</option>
                            <option value="งานรับเหมา">งานรับเหมา</option>
                        </select>
                    </div>

                    {formData.symptom && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>ระบุอุปกรณ์/สินค้าที่มีปัญหา <span style={{ color: 'red' }}>*</span></label>
                            <select
                                className="input-glass"
                                value={formData.product}
                                onChange={e => setFormData({ ...formData, product: e.target.value })}
                                style={{ background: 'rgba(15, 23, 42, 0.6)' }}
                            >
                                <option value="" disabled>เลือกชนิดอุปกรณ์</option>
                                {PRODUCT_OPTIONS[formData.symptom]?.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {formData.product === 'อื่นๆ' && (
                        <div className="animate-fade-in">
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>ระบุชื่ออุปกรณ์ที่ต้องการแจ้งซ่อม <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="text"
                                className="input-glass"
                                placeholder="เช่น ชั้นวางของโซนอาหารสด..."
                                value={otherProductName}
                                onChange={e => setOtherProductName(e.target.value)}
                            />
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>รายละเอียดปัญหา <span style={{ color: 'red' }}>*</span></label>
                        <textarea className="input-glass" style={{ minHeight: '120px' }} placeholder="ระบุอาการเสียโดยละเอียด..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>วันที่ต้องการให้เข้างาน (สาขาระบุ) <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="date"
                            className="input-glass"
                            value={formData.requestDate}
                            onChange={e => setFormData({ ...formData, requestDate: e.target.value })}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>รูปภาพ/วิดิโอหลักฐาน <span style={{ color: 'red' }}>*</span></label>
                        <div className="input-glass" style={{ minHeight: '150px', borderStyle: 'dashed', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', width: '100%', marginBottom: filePreviews.length > 0 ? '1rem' : '0' }}>
                                {filePreviews.map((preview, idx) => (
                                    <div key={idx} style={{ position: 'relative', width: '100px', height: '100px' }}>
                                        {preview.type.startsWith('video/') ? (
                                            <video src={preview.url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                                        ) : (
                                            <img src={preview.url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} alt={`Preview ${idx}`} />
                                        )}
                                        <button type="button" onClick={(e) => {
                                            e.stopPropagation();
                                            setFilePreviews(prev => prev.filter((_, i) => i !== idx));
                                            setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                                        }} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px' }}>X</button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={() => document.getElementById('fileUpload')?.click()} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                                + เพิ่มรูปภาพหรือวิดิโอ
                            </button>
                            <input type="file" id="fileUpload" style={{ display: 'none' }} accept="image/*,video/*" multiple onChange={handleImageChange} />
                        </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <button type="submit" className="btn-primary" style={{ padding: '1rem 3rem' }} disabled={isSubmitting}>
                            {isSubmitting ? 'กำลังส่ง...' : 'ส่งข้อมูลแจ้งซ่อม'}
                        </button>
                    </div>
                </div>
            </form>
        </main>
    );
}

export default function UserNewTicket() {
    return (
        <Suspense fallback={<div style={{ textAlign: 'center', padding: '5rem' }}>กำลังโหลดหน้าแบบฟอร์ม...</div>}>
            <NewTicketForm />
        </Suspense>
    );
}
