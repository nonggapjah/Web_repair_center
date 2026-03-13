"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getBranchTickets } from '@/app/actions/tickets';

const BRANCH_LIST = [
    { code: "1000", name: "SUKHUMVIT 33" },
    { code: "1003", name: "NICHADA" },
    { code: "1005", name: "SUKHUMVIT 49" },
    { code: "1024", name: "SAMMAKORN" },
    { code: "1030", name: "K-VILLAGE" }
];

export default function UserTicketList() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentBranch, setCurrentBranch] = useState<string | null>(null);
    const [showCSAT, setShowCSAT] = useState<string | null>(null);
    const [rating, setRating] = useState(0);

    // จำลองการดึงสาขาจาก User Profile (ในที่นี้ใช้ localStorage เพื่อการทดสอบ)
    useEffect(() => {
        const storedBranch = localStorage.getItem('userBranchId') || '1024';
        setCurrentBranch(storedBranch);
    }, []);

    useEffect(() => {
        if (!currentBranch) return;

        const fetchTickets = async () => {
            setIsLoading(true);
            try {
                // ดึงเฉพาะข้อมูลของสาขาตัวเองเท่านั้น (เงื่อนไข User เห็นแค่สาขาตัวเอง)
                const data = await getBranchTickets(currentBranch);
                setTickets(data);
            } catch (error) {
                console.error("Fetch tickets error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTickets();
    }, [currentBranch]);

    const handleSwitchBranch = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newBranch = e.target.value;
        setCurrentBranch(newBranch);
        localStorage.setItem('userBranchId', newBranch);
    };

    const translateStatus = (status: string) => {
        switch (status) {
            case 'Open': return 'แจ้งซ่อมใหม่';
            case 'On Process': return 'รับเรื่องแล้ว';
            case 'Repairing': return 'กำลังซ่อม';
            case 'Waiting Parts': return 'รออะไหล่';
            case 'Completed': return 'ซ่อมเรียบร้อย';
            case 'Closed': return 'ปิดงานถาวร';
            default: return status;
        }
    };

    return (
        <main className="container animate-fade-in" style={{ padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>

            {/* ส่วนเลือกสาขา (จำลองการสลับ User เพื่อทดสอบเงื่อนไข) */}
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(59, 130, 246, 0.05)' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>จำลองการล็อกอินสาขา:</span>
                <select
                    value={currentBranch || ''}
                    onChange={handleSwitchBranch}
                    className="input-glass"
                    style={{ padding: '0.4rem', width: 'auto', border: '1px solid var(--accent-primary)' }}
                >
                    {BRANCH_LIST.map(b => (
                        <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                    ))}
                </select>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>* ในระบบจริงจะล็อกตามโปรไฟล์ผู้ใช้</p>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="flex-mobile-col">
                <div>
                    <h1 style={{ color: 'var(--accent-primary)', fontSize: '2.5rem' }}>รายการแจ้งซ่อม {currentBranch}</h1>
                    <p style={{ color: 'var(--text-muted)' }}>ติดตามสถานะเฉพาะรายการของสาขาคุณเท่านั้น</p>
                </div>
                <Link href={`/user/new-ticket?branchId=${currentBranch}`} style={{ textDecoration: 'none' }}>
                    <span className="btn-primary" style={{ display: 'inline-block' }}>+ แจ้งซ่อมรายการใหม่</span>
                </Link>
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'var(--text-muted)' }}>กำลังดึงข้อมูลสาขา {currentBranch}...</p>
                </div>
            ) : (
                <div className="glass-panel responsive-table-container" style={{ padding: '0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(30, 58, 138, 0.05)', borderBottom: '1px solid var(--border-glass)' }}>
                                <th style={{ padding: '1.2rem' }}>รหัส</th>
                                <th style={{ padding: '1.2rem' }}>อุปกรณ์</th>
                                <th style={{ padding: '1.2rem' }}>รายละเอียด</th>
                                <th style={{ padding: '1.2rem' }}>อัปเดต</th>
                                <th style={{ padding: '1.2rem' }}>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>ยังไม่มีรายการแจ้งซ่อมของสาขานี้</td>
                                </tr>
                            ) : (
                                tickets.map(ticket => (
                                    <tr key={ticket.TicketID} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }} className="hover-row">
                                        <td style={{ padding: '1.2rem', fontWeight: '600', color: 'var(--accent-primary)' }}>{ticket.TicketID.substring(0, 8).toUpperCase()}</td>
                                        <td style={{ padding: '1.2rem' }}>{ticket.Product}</td>
                                        <td style={{ padding: '1.2rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{ticket.Description || '-'}</td>
                                        <td style={{ padding: '1.2rem' }}>{new Date(ticket.CreatedAt).toLocaleDateString('th-TH')}</td>
                                        <td style={{ padding: '1.2rem' }}>
                                            <span className="badge">{translateStatus(ticket.CurrentStatus)}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}
