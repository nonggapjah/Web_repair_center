"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createTicket } from '@/app/actions/tickets';

const BRANCH_MAP: Record<string, string> = {
    "1000": "SUKHUMVIT 33",
    "1003": "NICHADA",
    "1005": "SUKHUMVIT 49",
    "1024": "SAMMAKORN",
    "1030": "K-VILLAGE"
};

export default function UserNewTicket() {
    const searchParams = useSearchParams();
    const [formData, setFormData] = useState({
        product: '',
        symptom: '',
        description: '',
        branchId: '1024'
    });

    useEffect(() => {
        const queryBranch = searchParams.get('branchId');
        const storedBranch = localStorage.getItem('userBranchId');
        const finalBranch = queryBranch || storedBranch || '1024';
        setFormData(prev => ({ ...prev, branchId: finalBranch }));
    }, [searchParams]);

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setImagePreview(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        if (!formData.product || !formData.symptom) {
            setError('กรุณาระบุอุปกรณ์และหมวดหมู่การซ่อมบำรุง');
            setIsSubmitting(false);
            return;
        }

        try {
            const result = await createTicket(formData);
            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    window.location.href = '/user/dashboard';
                }, 1500);
            } else {
                setError(result.error || 'เกิดข้อผิดพลาด');
            }
        } catch (err) {
            setError('ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="container animate-fade-in" style={{ padding: '2rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
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
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>ชื่ออุปกรณ์ / หมายเลขเครื่อง <span style={{ color: 'red' }}>*</span></label>
                        <input type="text" className="input-glass" placeholder="เช่น ตู้แช่แข็ง #03, ประตูหน้า, ฝ้าเพดาน" value={formData.product} onChange={e => setFormData({ ...formData, product: e.target.value })} />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>หมวดหมู่ปัญหา <span style={{ color: 'red' }}>*</span></label>
                        <select className="input-glass" value={formData.symptom} onChange={e => setFormData({ ...formData, symptom: e.target.value })} style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
                            <option value="" disabled>เลือกประเภทปัญหา</option>
                            <option value="Refrigeration">ระบบทำความเย็น</option>
                            <option value="Electrical">ระบบไฟฟ้า</option>
                            <option value="Plumbing">ระบบประปา</option>
                            <option value="Other">อื่นๆ</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>รูปภาพหลักฐาน</label>
                        <div className="input-glass" style={{ minHeight: '150px', borderStyle: 'dashed', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => document.getElementById('fileUpload')?.click()}>
                            <input type="file" id="fileUpload" style={{ display: 'none' }} accept="image/*" onChange={handleImageChange} />
                            {imagePreview ? (
                                <img src={imagePreview} style={{ width: '100%', maxHeight: '300px', objectFit: 'contain' }} />
                            ) : (
                                <span>คลิกเพื่อแนบบรูปภาพ</span>
                            )}
                        </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <button type="submit" className="btn-primary" style={{ padding: '1rem 3rem' }} disabled={isSubmitting}>
                            {isSubmitting ? 'กำลังส่ง...' : 'ส่งข้อมูล'}
                        </button>
                    </div>
                </div>
            </form>
        </main>
    );
}
