"use client";
import React, { useState } from 'react';
import { createTicket } from '@/app/actions/tickets';

export default function UserNewTicket() {
    const [formData, setFormData] = useState({
        product: '',
        symptom: '',
        description: '',
        branchId: 'V-PHROM'
    });

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
        const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        // Validation
        if (!formData.product || !formData.symptom) {
            setError('กรุณาระบุอุปกรณ์และหมวดหมู่การซ่อมบำรุง');
            setIsSubmitting(false);
            return;
        }

        try {
            const result = await createTicket(formData);
            if (result.success) {
                setSuccess(true);
                setFormData({ product: '', symptom: '', description: '', branchId: 'V-PHROM' });
                setImagePreview(null);
                setTimeout(() => {
                    window.location.href = '/user/dashboard';
                }, 1500);
            } else {
                setError(result.error || 'เกิดข้อผิดพลาดบางอย่าง');
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
                <p style={{ color: 'var(--text-muted)' }}>แจ้งซ่อมตู้แช่, งานไฟฟ้า, งานประปา หรือปัญหาทางโครงสร้างอาคาร</p>
            </div>

            <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2.5rem' }}>
                {error && (
                    <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', borderRadius: 'var(--border-radius-sm)', marginBottom: '1.5rem' }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--accent-success)', color: 'var(--accent-success)', borderRadius: 'var(--border-radius-sm)', marginBottom: '1.5rem' }}>
                        ส่งข้อมูลแจ้งซ่อมเรียบร้อยแล้ว! ระบบกำลังพาคุณกลับไปยังหน้าแดชบอร์ด...
                    </div>
                )}

                <div className="flex-col gap-6" style={{ display: 'flex', marginBottom: '2rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>สาขาที่แจ้ง (แก้ไขไม่ได้)</label>
                        <input
                            type="text"
                            className="input-glass"
                            value="สาขาพรมพงษ์ (V-PHROM - 024)"
                            disabled
                            style={{ opacity: 0.7 }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                            ชื่ออุปกรณ์ / หมายเลขเครื่อง / จุดที่เสีย <span style={{ color: 'var(--accent-danger)' }}>*</span>
                        </label>
                        <input
                            type="text"
                            className="input-glass"
                            placeholder="เช่น ตู้แช่แข็ง #03, ประตูหน้า, ฝ้าเพดานบริเวณแคชเชียร์"
                            value={formData.product}
                            onChange={e => setFormData({ ...formData, product: e.target.value })}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                            หมวดหมู่ปัญหา <span style={{ color: 'var(--accent-danger)' }}>*</span>
                        </label>
                        <select
                            className="input-glass"
                            value={formData.symptom}
                            onChange={e => setFormData({ ...formData, symptom: e.target.value })}
                            style={{ appearance: 'none', background: 'rgba(15, 23, 42, 0.6)' }}
                        >
                            <option value="" disabled>กรุณาเลือกประเภทปัญหา</option>
                            <option value="Refrigeration/Chiller">ระบบทำความเย็น / ตู้แช่ (ตู้แช่)</option>
                            <option value="Electrical/Power">ระบบไฟฟ้า / แสงสว่าง (ไฟฟ้า)</option>
                            <option value="Plumbing/Water">ระบบประปา / สุขาภิบาล (ประปา)</option>
                            <option value="Infrastructure/Ceiling">งานโครงสร้าง / ฝ้าเพดาน (ฝ้าเพดาน)</option>
                            <option value="Other">อื่นๆ</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>รายละเอียดเพิ่มเติม (ถ้ามี)</label>
                        <textarea
                            className="input-glass"
                            placeholder="กรุณาอธิบายอาการเสียของคุณเพื่อให้ช่างเตรียมอุปกรณ์มาได้ถูกต้อง..."
                            rows={4}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        ></textarea>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>อัปโหลดรูปภาพ (หลักฐานความเสียหาย)</label>
                        <div
                            className="input-glass"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: imagePreview ? '1rem' : '2rem',
                                borderStyle: 'dashed',
                                cursor: 'pointer',
                                position: 'relative',
                                minHeight: '150px',
                                justifyContent: 'center',
                                transition: '0.2s'
                            }}
                            onClick={() => document.getElementById('fileUpload')?.click()}
                        >
                            <input
                                type="file"
                                id="fileUpload"
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handleImageChange}
                            />

                            {imagePreview ? (
                                <div style={{ width: '100%', position: 'relative' }}>
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px' }}
                                    />
                                    <button
                                        onClick={removeImage}
                                        style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            background: 'var(--accent-danger)',
                                            color: '#fff',
                                            border: 'none',
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            fontSize: '18px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                                            zIndex: 10
                                        }}
                                        title="ลบรูปภาพ"
                                    >
                                        &times;
                                    </button>
                                    <div style={{ textAlign: 'center', marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        คลิกที่รูปเพื่อเปลี่ยนรูปภาพ
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                        <circle cx="12" cy="13" r="4"></circle>
                                    </svg>
                                    <p style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.2rem' }}>ถ่ายรูปหรือเลือกไฟล์</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>รองรับไฟล์ภาพทุกประเภท</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <button
                        type="submit"
                        className="btn-primary"
                        style={{ padding: '1rem 3rem', fontSize: '1.1rem', opacity: isSubmitting ? 0.7 : 1 }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลแจ้งซ่อม'}
                    </button>
                </div>
            </form>
        </main>
    );
}
