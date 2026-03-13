"use client";
import React, { useState } from 'react';
import Link from 'next/link';

// Dummy Data (ภาษาไทย)
const myTickets = [
    { id: "M-9021", product: "ตู้แช่แข็ง Walk-in #2", status: "Planed", date: "12 ต.ค., 10:30", desc: "อุณหภูมิสูงผิดปกติ (-5°C จากปกติ -18°C)" },
    { id: "M-8954", product: "ฝ้าเพดาน - โซนผักสด", status: "Closed", date: "10 ต.ค., 14:15", desc: "น้ำรั่วหลังจากฝนตกหนักเมื่อคืน" },
    { id: "M-9005", product: "เตาอบเบเกอรี่", status: "Completed", date: "05 ต.ค., 09:00", desc: "เปลี่ยนชุดฮีตเตอร์เรียบร้อย" }
];

export default function UserTicketList() {
    const [tickets, setTickets] = useState(myTickets);
    const [showCSAT, setShowCSAT] = useState<string | null>(null);
    const [rating, setRating] = useState(0);

    const handleComplete = (id: string, success: boolean) => {
        if (success) {
            setShowCSAT(id);
        } else {
            setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'On Process' } : t));
            alert("ส่งรายการกลับไปให้ทีมช่างดำเนินการใหม่");
        }
    };

    const submitCSAT = () => {
        setTickets(prev => prev.map(t => t.id === showCSAT ? { ...t, status: 'Completed' } : t));
        setShowCSAT(null);
        setRating(0);
        alert("บันทึกการประเมินความพึงพอใจเรียบร้อย แอดมินจะดำเนินการปิดตั๋วถาวรครับ");
    };

    const translateStatus = (status: string) => {
        switch (status) {
            case 'Planed': return 'รอดำเนินการ';
            case 'Open': return 'เปิดงานแล้ว';
            case 'On Process': return 'กำลังดำเนินการ';
            case 'Repairing': return 'กำลังซ่อม';
            case 'Waiting Parts': return 'รออะไหล่';
            case 'Closed': return 'ซ่อมเสร็จแล้ว';
            case 'Completed': return 'จบงานสมบูรณ์';
            default: return status;
        }
    };

    return (
        <main className="container animate-fade-in" style={{ padding: '4rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ color: 'var(--accent-primary)', fontSize: '2.5rem' }}>รายการแจ้งซ่อมของสาขา</h1>
                    <p style={{ color: 'var(--text-muted)' }}>สาขาพรมพงษ์ (V-PHROM - 024) | ติดตามสถานะและยืนยันการซ่อมบำรุง</p>
                </div>
                <Link href="/user/new-ticket" style={{ textDecoration: 'none' }}>
                    <span className="btn-primary" style={{ display: 'inline-block' }}>+ แจ้งซ่อมรายการใหม่</span>
                </Link>
            </div>

            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: 'rgba(30, 58, 138, 0.05)', borderBottom: '1px solid var(--border-glass)' }}>
                            <th style={{ padding: '1.2rem', color: 'var(--text-secondary)' }}>รหัส</th>
                            <th style={{ padding: '1.2rem', color: 'var(--text-secondary)' }}>อุปกรณ์ / จุดที่เสีย</th>
                            <th style={{ padding: '1.2rem', color: 'var(--text-secondary)' }}>รายละเอียดปัญหา</th>
                            <th style={{ padding: '1.2rem', color: 'var(--text-secondary)' }}>อัปเดตล่าสุด</th>
                            <th style={{ padding: '1.2rem', color: 'var(--text-secondary)' }}>สถานะ</th>
                            <th style={{ padding: '1.2rem', color: 'var(--text-secondary)', textAlign: 'right' }}>ดำเนินการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tickets.map(ticket => (
                            <tr key={ticket.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.2s' }} className="hover-row">
                                <td style={{ padding: '1.2rem', fontWeight: '600', color: 'var(--accent-primary)' }}>{ticket.id}</td>
                                <td style={{ padding: '1.2rem', color: 'var(--text-primary)' }}>{ticket.product}</td>
                                <td style={{ padding: '1.2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{ticket.desc}</td>
                                <td style={{ padding: '1.2rem', color: 'var(--text-muted)' }}>{ticket.date}</td>
                                <td style={{ padding: '1.2rem' }}>
                                    <span className={`badge ${ticket.status === 'Planed' ? 'badge-planed' :
                                            ticket.status === 'Closed' ? 'badge-closed' :
                                                ticket.status === 'On Process' || ticket.status === 'Repairing' ? 'badge-onprocess' : 'badge-open'
                                        }`}>
                                        {translateStatus(ticket.status)}
                                    </span>
                                </td>
                                <td style={{ padding: '1.2rem', textAlign: 'right' }}>
                                    {ticket.status === 'Closed' ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => handleComplete(ticket.id, true)}
                                                className="badge"
                                                style={{ border: '1px solid var(--accent-success)', cursor: 'pointer', background: 'var(--accent-success)', color: '#fff', padding: '0.4rem 0.8rem' }}
                                            >
                                                ยืนยันซ่อมเสร็จ
                                            </button>
                                            <button
                                                onClick={() => handleComplete(ticket.id, false)}
                                                className="badge"
                                                style={{ border: '1px solid var(--accent-danger)', cursor: 'pointer', background: 'var(--accent-danger)', color: '#fff', padding: '0.4rem 0.8rem' }}
                                            >
                                                ยังเสียอยู่
                                            </button>
                                        </div>
                                    ) : (
                                        <span style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: '500', fontSize: '0.9rem' }}>ดูรายละเอียด</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* CSAT Modal */}
            {showCSAT && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div className="glass-panel animate-fade-in" style={{ width: '450px', textAlign: 'center', background: '#fff' }}>
                        <h2 style={{ color: 'var(--accent-primary)' }}>ประเมินการบริการ</h2>
                        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>คุณพอใจกับงานซ่อมอุปกรณ์ {showCSAT} มากน้อยเพียงใด?</p>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <span
                                    key={star}
                                    onClick={() => setRating(star)}
                                    style={{
                                        fontSize: '2.5rem', cursor: 'pointer',
                                        color: star <= rating ? 'var(--accent-warning)' : '#e2e8f0',
                                        transition: 'transform 0.1s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    ★
                                </span>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <button className="btn-primary" style={{ flex: 1 }} onClick={submitCSAT}>ส่งผลการประเมิน</button>
                            <button className="input-glass" style={{ flex: 1, color: 'var(--text-primary)' }} onClick={() => setShowCSAT(null)}>ยกเลิก</button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .hover-row:hover {
                    background: rgba(30, 58, 138, 0.02);
                }
            `}} />
        </main>
    );
}
