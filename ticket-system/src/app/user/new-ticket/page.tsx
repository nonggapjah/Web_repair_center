"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createTicket } from '@/app/actions/tickets';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Suspense } from 'react';

const BRANCH_MAP: Record<string, string> = {
    "1000": "SUKHUMVIT 33",
    "1003": "NICHADA",
    "1005": "SUKHUMVIT 49",
    "1024": "SAMMAKORN",
    "1030": "K-VILLAGE"
};

function NewTicketForm() {
    const searchParams = useSearchParams();
    const [formData, setFormData] = useState({
        product: '',
        symptom: '',
        description: '',
        branchId: '1024',
        plannedDate: ''
    });

    useEffect(() => {
        const queryBranch = searchParams.get('branchId');
        const storedBranch = localStorage.getItem('userBranchId');
        const finalBranch = queryBranch || storedBranch || '1024';
        setFormData(prev => ({ ...prev, branchId: finalBranch }));
    }, [searchParams]);

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
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

        try {
            let publicUrl = '';

            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('tickets')
                    .upload(filePath, selectedFile);

                if (uploadError) {
                    throw new Error('Upload failed: ' + uploadError.message);
                }

                const { data } = supabase.storage
                    .from('tickets')
                    .getPublicUrl(filePath);

                publicUrl = data.publicUrl;
            }

            // Since product is mandatory in DB but removed from UI, we send an empty string or generic value
            const finalData = {
                ...formData,
                product: formData.product || 'แจ้งซ่อมทั่วไป',
                imageURL: publicUrl
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
                <p style={{ color: 'var(--text-muted)' }}>พนักงานสาขา {formData.branchId} ({BRANCH_MAP[formData.branchId] || 'Unknown Branch'})</p>
            </div>

            <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2.5rem' }}>
                {error && <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</div>}
                {success && <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--accent-success)', color: 'var(--accent-success)', borderRadius: '8px', marginBottom: '1.5rem' }}>ส่งข้อมูลแจ้งซ่อมเรียบร้อยแล้ว!</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>สาขาที่แจ้ง</label>
                        <input type="text" className="input-glass" value={`${formData.branchId} - ${BRANCH_MAP[formData.branchId] || 'Other Branch'}`} disabled style={{ opacity: 0.7 }} />
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

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>รายละเอียดปัญหา</label>
                        <textarea className="input-glass" style={{ minHeight: '120px' }} placeholder="ระบุอาการเสียโดยละเอียด..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>วันที่ต้องการให้เข้างาน</label>
                        <input
                            type="date"
                            className="input-glass"
                            value={formData.plannedDate}
                            onChange={e => setFormData({ ...formData, plannedDate: e.target.value })}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>รูปภาพหลักฐาน</label>
                        <div className="input-glass" style={{ minHeight: '150px', borderStyle: 'dashed', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => document.getElementById('fileUpload')?.click()}>
                            <input type="file" id="fileUpload" style={{ display: 'none' }} accept="image/*" onChange={handleImageChange} />
                            {imagePreview ? (
                                <img src={imagePreview} style={{ width: '100%', maxHeight: '300px', objectFit: 'contain' }} alt="Preview" />
                            ) : (
                                <span>คลิกเพื่อแนบบรูปภาพ</span>
                            )}
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
