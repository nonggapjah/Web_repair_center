"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getBranchTickets } from '@/app/actions/tickets';
import { getSession, logout } from '@/app/actions/auth';

export default function UserTicketList() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

    const translateStatus = (status: string) => {
        switch (status) {
            case 'Open': return 'แจ้งซ่อมใหม่';
            case 'On Process': return 'รับเรื่องแล้ว';
            case 'Repairing': return 'กำลังเข้าซ่อม';
            case 'Waiting Parts': return 'รออะไหล่';
            case 'Completed': return 'ซ่อมเรียบร้อย';
            case 'Closed': return 'ปิดงานถาวร';
            default: return status;
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'Open': return '#3b82f6';
            case 'On Process': return '#8b5cf6';
            case 'Repairing': return '#f59e0b';
            case 'Waiting Parts': return '#ef4444';
            case 'Completed': return '#10b981';
            case 'Closed': return '#64748b';
            default: return '#64748b';
        }
    };

    const getSLAColor = (ticket: any) => {
        if (ticket.CurrentStatus === 'Completed' || ticket.CurrentStatus === 'Closed') {
            return '#10b981'; // Green
        }

        const lastUpdate = ticket.History && ticket.History.length > 0
            ? new Date(ticket.History[0].Timestamp)
            : new Date(ticket.CreatedAt);

        const now = new Date();
        const diffDays = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));

        if (diffDays > 7) return '#ef4444'; // Red
        if (diffDays > 3) return '#f59e0b'; // Yellow
        return null; // None
    };

    const fetchTickets = async (branchId: string) => {
        try {
            const data = await getBranchTickets(branchId);
            setTickets(data);
        } catch (error) {
            console.error("Fetch tickets error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            const session = await getSession();
            if (!session) {
                window.location.href = '/login';
                return;
            }
            setUser(session);
            fetchTickets(session.branchId);
        };
        init();
    }, []);

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
    };

    if (!user) return null;

    return (
        <>
            <main className="container" style={{ padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
                <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '0.9rem' }}>ออกจากระบบ (Logout)</button>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="flex-mobile-col">
                        <div>
                            <h1 style={{ color: 'var(--accent-primary)', fontSize: '2.5rem' }}>รายการแจ้งซ่อมสาขา {user.branchId}</h1>
                            <p style={{ color: 'var(--text-muted)' }}>{user.branchName} | ติดตามสถานะเฉพาะของสาขาคุณ</p>
                        </div>
                        <Link href={`/user/new-ticket?branchId=${user.branchId}`} style={{ textDecoration: 'none' }}>
                            <span className="btn-primary" style={{ display: 'inline-block' }}>+ แจ้งซ่อมรายการใหม่</span>
                        </Link>
                    </div>

                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <p style={{ color: 'var(--text-muted)' }}>กำลังดึงข้อมูล...</p>
                        </div>
                    ) : (
                        <div className="glass-panel responsive-table-container" style={{ padding: '0', overflow: 'hidden' }}>
                            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(30, 58, 138, 0.05)' }}>
                                        <th style={{ padding: '1.2rem' }}>รหัส</th>
                                        <th style={{ padding: '1.2rem' }}>หมวดหมู่</th>
                                        <th style={{ padding: '1.2rem' }}>อัปเดตล่าสุด</th>
                                        <th style={{ padding: '1.2rem' }}>สถานะ</th>
                                        <th style={{ padding: '1.2rem' }}>ช่างที่รับผิดชอบ</th>
                                        <th style={{ padding: '1.2rem' }}>ข้อความล่าสุด</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>ยังไม่มีรายการแจ้งซ่อมในขณะนี้</td>
                                        </tr>
                                    ) : (
                                        tickets.map(ticket => {
                                            const latestHistory = ticket.History && ticket.History.length > 0 ? ticket.History[0] : null;
                                            return (
                                                <tr
                                                    key={ticket.TicketID}
                                                    style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer' }}
                                                    className="hover-row"
                                                    onClick={() => setSelectedTicket(ticket)}
                                                >
                                                    <td style={{ padding: '1.2rem', fontWeight: '600', color: 'var(--accent-primary)' }}>{ticket.TicketID.substring(0, 8).toUpperCase()}</td>
                                                    <td style={{ padding: '1.1rem' }}>{ticket.Symptom}</td>
                                                    <td style={{ padding: '1.1rem' }}>{new Date(ticket.CreatedAt).toLocaleDateString('th-TH')}</td>
                                                    <td style={{ padding: '1.1rem' }}>
                                                        <span className="badge" style={{
                                                            background: getSLAColor(ticket) || `${statusColor(ticket.CurrentStatus)}15`,
                                                            color: getSLAColor(ticket) ? '#fff' : statusColor(ticket.CurrentStatus),
                                                            border: getSLAColor(ticket) ? 'none' : `1px solid ${statusColor(ticket.CurrentStatus)}30`
                                                        }}>{translateStatus(ticket.CurrentStatus)}</span>
                                                    </td>
                                                    <td style={{ padding: '1.1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                        {ticket.Technician || '-'}
                                                    </td>
                                                    <td style={{ padding: '1.1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                        {latestHistory?.Note ? `💬 ${latestHistory.Note}` : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal Pop Up ตรงกลางหน้าจอ - ย้ายมานอก main ที่มีการทำ animation stack เพื่อไม่ให้โดน navbar บัง */}
            {selectedTicket && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.7)',
                    backdropFilter: 'blur(12px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }} onClick={() => setSelectedTicket(null)}>
                    <div style={{
                        width: '100%',
                        maxWidth: '550px',
                        maxHeight: '90vh',
                        background: '#fff',
                        borderRadius: '28px',
                        padding: '2rem',
                        position: 'relative',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '1.5rem' }}>คำขอ #{selectedTicket.TicketID.substring(0, 8).toUpperCase()}</h2>
                            <button onClick={() => setSelectedTicket(null)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
                        </div>

                        <div style={{ marginBottom: '1.5rem', background: 'rgba(30,58,138,0.03)', padding: '1.2rem', borderRadius: '15px' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>หมวดหมู่ปัญหา</label>
                            <p style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>{selectedTicket.Symptom}</p>
                            {selectedTicket.Technician && (
                                <div style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                    ช่างที่รับผิดชอบ: {selectedTicket.Technician}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                                <span className="badge" style={{ background: statusColor(selectedTicket.CurrentStatus), color: '#fff' }}>{translateStatus(selectedTicket.CurrentStatus)}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(selectedTicket.CreatedAt).toLocaleDateString('th-TH')}</span>
                            </div>
                        </div>

                        <div>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.8rem' }}>Timeline ความคืบหน้า</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                {selectedTicket.History?.map((h: any, idx: number) => (
                                    <div key={h.HistoryID} style={{ position: 'relative', paddingLeft: '1.5rem', borderLeft: '2px solid rgba(0,0,0,0.05)' }}>
                                        <div style={{ position: 'absolute', left: '-6px', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: idx === 0 ? statusColor(h.Status) : 'rgba(0,0,0,0.1)' }} />
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(h.Timestamp).toLocaleString('th-TH')}</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{translateStatus(h.Status)}</div>
                                        {h.Note && <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.8rem', borderRadius: '8px', fontSize: '0.9rem', marginTop: '0.3rem' }}>{h.Note}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
