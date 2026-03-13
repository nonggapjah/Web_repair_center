"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getBranchTickets } from '@/app/actions/tickets';
import { getSession, logout } from '@/app/actions/auth';

export default function UserTicketList() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const init = async () => {
            const session = await getSession();
            if (!session) {
                window.location.href = '/login';
                return;
            }
            setUser(session);

            try {
                const data = await getBranchTickets(session.branchId);
                setTickets(data);
            } catch (error) {
                console.error("Fetch tickets error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        const storedBranch = localStorage.getItem('userBranchId');
        init();
    }, []);

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
    };

    if (!user) return null;

    return (
        <main className="container animate-fade-in" style={{ padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>

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
                    <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(30, 58, 138, 0.05)' }}>
                                <th style={{ padding: '1.2rem' }}>รหัส</th>
                                <th style={{ padding: '1.2rem' }}>อุปกรณ์</th>
                                <th style={{ padding: '1.2rem' }}>รายละเอียด</th>
                                <th style={{ padding: '1.2rem' }}>อัปเดตงาน</th>
                                <th style={{ padding: '1.2rem' }}>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>ยังไม่มีรายการแจ้งซ่อมในขณะนี้</td>
                                </tr>
                            ) : (
                                tickets.map(ticket => (
                                    <tr key={ticket.TicketID} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }} className="hover-row">
                                        <td style={{ padding: '1.2rem', fontWeight: '600', color: 'var(--accent-primary)' }}>{ticket.TicketID.substring(0, 8).toUpperCase()}</td>
                                        <td style={{ padding: '1.1rem' }}>{ticket.Product}</td>
                                        <td style={{ padding: '1.1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{ticket.Description || '-'}</td>
                                        <td style={{ padding: '1.1rem' }}>{new Date(ticket.CreatedAt).toLocaleDateString('th-TH')}</td>
                                        <td style={{ padding: '1.1rem' }}>
                                            <span className="badge">{ticket.CurrentStatus}</span>
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
