"use client";
import React, { useState } from 'react';

export default function UserNewTicket() {
    const [formData, setFormData] = useState({
        product: '',
        symptom: '',
        description: '',
        branchId: 'V-PHROM'
    });

    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.product || !formData.symptom) {
            setError('กรุณาระบุอุปกรณ์และหมวดหมู่การซ่อมบำรุง');
            return;
        }

        // Mock API Submit
        setTimeout(() => {
            setSuccess(true);
            setFormData({ product: '', symptom: '', description: '', branchId: 'V-PHROM' });
            setTimeout(() => setSuccess(false), 3000);
        }, 1000);
    };

    return (
        <main className="container animate-fade-in" style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
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
                        ส่งข้อมูลแจ้งซ่อมเรียบร้อยแล้ว! รายการถูกส่งไปยังทีมช่างแล้ว
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
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', borderStyle: 'dashed', cursor: 'pointer' }}
                            onClick={() => document.getElementById('fileUpload')?.click()}
                        >
                            <input type="file" id="fileUpload" style={{ display: 'none' }} accept="image/*" />
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>คลิกเพื่ออัปโหลดรูปภาพ หรือลากไฟล์มาวาง</p>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <button type="submit" className="btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}>
                        ส่งข้อมูลแจ้งซ่อม
                    </button>
                </div>
            </form>
        </main>
    );
}
