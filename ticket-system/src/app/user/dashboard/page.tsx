"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getBranchTickets, updateTicketStatus, addTicketComment } from '@/app/actions/tickets';
import { getSession, logout } from '@/app/actions/auth';
import { supabase } from '@/lib/supabase';
import { SignatureModal } from '@/components/SignatureModal';

export default function UserTicketList() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

    // Timeline/Chat states
    const [replyMessage, setReplyMessage] = useState('');
    const [replyFile, setReplyFile] = useState<File | null>(null);
    const [isReplying, setIsReplying] = useState(false);
    const [showSignPad, setShowSignPad] = useState(false);
    const [submittingTicketId, setSubmittingTicketId] = useState<string | null>(null);

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
            const data = await getBranchTickets(branchId, Date.now());
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

            // Auto-poll user tickets every 5s
            const interval = setInterval(() => fetchTickets(session.branchId), 5000);
            return () => clearInterval(interval);
        };
        const cleanup = init();
        return () => { cleanup.then(fn => fn && fn()); };
    }, []);

    useEffect(() => {
        const handleOpenTicket = (e: any) => {
            const tkId = e.detail?.ticketId;
            if (tkId) {
                const tk = tickets.find((t: any) => t.TicketID === tkId);
                if (tk) setSelectedTicket(tk);
            }
        };
        window.addEventListener('OPEN_TICKET', handleOpenTicket);
        return () => window.removeEventListener('OPEN_TICKET', handleOpenTicket);
    }, [tickets]);

    // Keep currently opened ticket modal synced with live data
    useEffect(() => {
        if (selectedTicket && tickets.length > 0) {
            const freshTk = tickets.find(t => t.TicketID === selectedTicket.TicketID);
            if (freshTk) {
                if (freshTk.Comments?.length !== selectedTicket.Comments?.length ||
                    freshTk.History?.length !== selectedTicket.History?.length ||
                    freshTk.CurrentStatus !== selectedTicket.CurrentStatus) {
                    setSelectedTicket(freshTk);
                }
            }
        }
    }, [tickets]);

    useEffect(() => {
        if (!selectedTicket) {
            setReplyMessage('');
            setReplyFile(null);
        }
    }, [selectedTicket]);

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
    };

    const handleConfirmSuccess = async (ticketId: string) => {
        if (!confirm('ยืนยันว่าการซ่อมเสร็จสิ้นสมบูรณ์และต้องการปิดงานใช่หรือไม่?')) return;
        setSubmittingTicketId(ticketId);
        setShowSignPad(true);
    };

    const submitConfirmSuccess = async (signatureBase64: string) => {
        if (!submittingTicketId) return;
        setShowSignPad(false);

        // Optimistic UI update
        setTickets(prev => prev.map(t => t.TicketID === submittingTicketId ? {
            ...t,
            CurrentStatus: 'Closed',
            UserSignature: signatureBase64
        } : t));
        setSelectedTicket(null);

        // Background persist
        const result = await updateTicketStatus(submittingTicketId, 'Closed', 'สาขายืนยันปิดงานเรียบร้อย', undefined, undefined, signatureBase64);
        if (!result.success) {
            alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ ลองรีเฟรชหน้าต่างครับ');
        }

        setSubmittingTicketId(null);
    };

    const handleAddComment = async () => {
        if (!replyMessage && !replyFile) return;
        setIsReplying(true);
        try {
            let publicUrl = '';
            if (replyFile) {
                const fileExt = replyFile.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('tickets').upload(fileName, replyFile);
                if (uploadError) throw new Error('Upload failed');
                const { data } = supabase.storage.from('tickets').getPublicUrl(fileName);
                publicUrl = data.publicUrl;
            }
            await addTicketComment(selectedTicket.TicketID, replyMessage, publicUrl, user.userId);
            setReplyMessage('');
            setReplyFile(null);

            if (user) {
                const updatedTickets = await getBranchTickets(user.branchId, Date.now());
                setTickets(updatedTickets);
                const newT = updatedTickets.find(t => t.TicketID === selectedTicket.TicketID);
                if (newT) setSelectedTicket(newT);
            }
        } catch (err) {
            alert('ไม่สามารถส่งข้อความได้');
            console.error(err);
        } finally {
            setIsReplying(false);
        }
    };

    if (!user) return null;

    const combinedTimeline = selectedTicket ? [
        ...(selectedTicket.History || []).map((h: any) => ({ type: 'history', date: h.Timestamp, user: h.UpdatedBy, msg: h.Note, status: h.Status })),
        ...(selectedTicket.Comments || []).map((c: any) => ({ type: 'comment', date: c.Timestamp, user: c.User?.Role === 'Admin' ? 'แอดมิน' : `สาขา ${user.branchId}`, msg: c.Message, img: c.ImageURL }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];

    return (
        <>
            <style jsx global>{`
                @media (max-width: 768px) {
                    .flex-mobile-col { flex-direction: column !important; align-items: stretch !important; text-align: left; }
                    .flex-mobile-col > div { margin-bottom: 1rem; }
                    .table-container { overflow-x: auto !important; width: 100%; -webkit-overflow-scrolling: touch; }
                }
            `}</style>
            <main className="container" style={{ padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
                <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '0.9rem' }}>ออกจากระบบ (Logout)</button>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="flex-mobile-col">
                        <div>
                            <h1 style={{ color: 'var(--accent-primary)', fontSize: '2.2rem', marginBottom: '0.5rem' }}>รายการแจ้งซ่อมสาขา {user.branchId}</h1>
                            <p style={{ color: 'var(--text-muted)' }}>{user.branchName} | ติดตามสถานะเฉพาะของสาขาคุณ</p>
                        </div>
                        <Link href={`/user/new-ticket?branchId=${user.branchId}`} style={{ textDecoration: 'none' }}>
                            <span className="btn-primary" style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '0.8rem', borderRadius: '12px', fontWeight: '800' }}>+ แจ้งซ่อมรายการใหม่</span>
                        </Link>
                    </div>

                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <p style={{ color: 'var(--text-muted)' }}>กำลังดึงข้อมูล...</p>
                        </div>
                    ) : (
                        <div className="glass-panel table-container" style={{ padding: '0', borderRadius: '20px', background: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
                            <div style={{ padding: '1rem', background: '#fef3c7', color: '#92400e', fontSize: '0.85rem', fontWeight: '800', borderRadius: '20px 20px 0 0', textAlign: 'center' }} className="d-block d-md-none">
                                👈 ปัดซ้าย-ขวา เพื่อดูข้อมูลเพิ่มเติม 👉
                            </div>
                            <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>รหัส</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>หมวดหมู่</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>อุปกรณ์</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>อัปเดตล่าสุด</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>สถานะ</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>วันที่สาขาขอ</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>วันที่ช่างเข้าจริง</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>ช่างที่รับผิดชอบ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>ยังไม่มีรายการแจ้งซ่อมในขณะนี้</td>
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
                                                    <td style={{ padding: '1.1rem', color: 'var(--accent-secondary)', fontWeight: '600' }}>{ticket.Product}</td>
                                                    <td style={{ padding: '1.1rem' }}>{new Date(ticket.CreatedAt).toLocaleDateString('th-TH')}</td>
                                                    <td style={{ padding: '1.1rem' }}>
                                                        <span className="badge" style={{
                                                            background: getSLAColor(ticket) || `${statusColor(ticket.CurrentStatus)}15`,
                                                            color: getSLAColor(ticket) ? '#fff' : statusColor(ticket.CurrentStatus),
                                                            border: getSLAColor(ticket) ? 'none' : `1px solid ${statusColor(ticket.CurrentStatus)}30`
                                                        }}>{translateStatus(ticket.CurrentStatus)}</span>
                                                    </td>
                                                    <td style={{ padding: '1.1rem', fontSize: '0.9rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                                                        {ticket.RequestDate ? new Date(ticket.RequestDate).toLocaleDateString('th-TH') : '-'}
                                                    </td>
                                                    <td style={{ padding: '1.1rem', fontSize: '0.9rem', color: 'var(--accent-success)', fontWeight: 'bold' }}>
                                                        {ticket.ActualDate ? new Date(ticket.ActualDate).toLocaleDateString('th-TH') : '-'}
                                                    </td>
                                                    <td style={{ padding: '1.1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                        {ticket.Technician || '-'}
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

            {/* Modal Pop Up ตรงกลางหน้าจอ*/}
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
                        maxWidth: '650px',
                        maxHeight: '90vh',
                        background: '#fff',
                        borderRadius: '28px',
                        padding: '2.5rem',
                        position: 'relative',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '1.6rem' }}>คำขอ #{selectedTicket.TicketID.substring(0, 8).toUpperCase()}</h2>
                                <p style={{ margin: '0.5rem 0 0 0', color: 'var(--accent-secondary)', fontWeight: 'bold' }}>📦 อุปกรณ์: {selectedTicket.Product}</p>
                            </div>
                            <button onClick={() => setSelectedTicket(null)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>&times;</button>
                        </div>

                        <div style={{ marginBottom: '1.5rem', background: 'rgba(30,58,138,0.03)', padding: '1.2rem', borderRadius: '15px' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>หมวดหมู่ปัญหา</label>
                            <p style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 1rem 0' }}>{selectedTicket.Symptom}</p>

                            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span className="badge" style={{ background: statusColor(selectedTicket.CurrentStatus), color: '#fff' }}>{translateStatus(selectedTicket.CurrentStatus)}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(selectedTicket.CreatedAt).toLocaleDateString('th-TH')}</span>
                            </div>

                            {selectedTicket.Technician && (
                                <div style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', fontWeight: 'bold', marginTop: '1rem' }}>
                                    ช่างที่รับผิดชอบ: {selectedTicket.Technician}
                                </div>
                            )}

                            <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fff', borderRadius: '10px', fontSize: '0.9rem', border: '1px solid rgba(0,0,0,0.05)' }}>
                                <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold', marginBottom: '0.3rem' }}>
                                    📅 วันที่ขอเข้างาน: {selectedTicket.RequestDate ? new Date(selectedTicket.RequestDate).toLocaleDateString('th-TH') : 'ไม่ได้ระบุ'}
                                </div>
                                <div style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>
                                    🛠️ วันที่ช่างเข้าจริง: {selectedTicket.ActualDate ? new Date(selectedTicket.ActualDate).toLocaleDateString('th-TH') : 'รอยืนยันจากแอดมิน'}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                            <p style={{ fontWeight: '900', marginBottom: '0.5rem', color: '#475569' }}>รายละเอียดจากผู้แจ้ง:</p>
                            <p style={{ color: '#1e293b', lineHeight: '1.6' }}>{selectedTicket.Description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                            {selectedTicket.ImageURL && (
                                <img src={selectedTicket.ImageURL} alt="Evidence" style={{ width: '100%', borderRadius: '15px', marginTop: '1rem', border: '2px solid #f1f5f9', cursor: 'pointer' }} onClick={() => window.open(selectedTicket.ImageURL, '_blank')} />
                            )}

                            {selectedTicket.AdminSignature && (
                                <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontWeight: '900', fontSize: '0.85rem', color: '#475569', display: 'block', marginBottom: '0.5rem' }}>ลายเซ็นผู้มอบงาน (Admin)</label>
                                    <img src={selectedTicket.AdminSignature} alt="Admin Signature" style={{ maxHeight: '80px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                                </div>
                            )}
                            {selectedTicket.UserSignature && (
                                <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontWeight: '900', fontSize: '0.85rem', color: '#475569', display: 'block', marginBottom: '0.5rem' }}>ลายเซ็นผู้รับมอบงาน (สาขา)</label>
                                    <img src={selectedTicket.UserSignature} alt="Branch Signature" style={{ maxHeight: '80px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                                </div>
                            )}
                        </div>

                        <hr style={{ margin: '2rem 0', borderColor: '#e2e8f0' }} />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', marginBottom: '1rem' }}>💬 ไทม์ไลน์ & แชทโต้ตอบ</h3>

                        {/* Timeline display */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                            {combinedTimeline.length > 0 ? combinedTimeline.map((item, idx) => (
                                <div key={idx} style={{ padding: '1rem', background: item.type === 'history' ? '#f1f5f9' : '#e0e7ff', borderRadius: '15px', borderLeft: `4px solid ${item.type === 'history' ? '#94a3b8' : '#6366f1'}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: '800', color: '#64748b' }}>
                                        <span>{item.type === 'history' ? '🛠️ แอดมินอัปเดตงาน' : '👤 ' + (item.user || '')}</span>
                                        <span>{new Date(item.date).toLocaleString('th-TH')}</span>
                                    </div>
                                    {item.type === 'history' && item.status && (
                                        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#fff', borderRadius: '6px', fontWeight: '800', border: '1px solid #cbd5e1', marginRight: '0.5rem' }}>เปลี่ยนสถานะ: {translateStatus(item.status)}</span>
                                    )}
                                    {item.msg && <p style={{ color: '#1e293b', fontSize: '0.95rem', marginTop: '0.5rem' }}>{item.msg}</p>}
                                    {item.img && <img src={item.img} style={{ maxWidth: '200px', borderRadius: '10px', marginTop: '0.5rem', border: '1px solid #cbd5e1', cursor: 'pointer' }} onClick={() => window.open(item.img, '_blank')} />}
                                </div>
                            )) : (
                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>ยังไม่มีการพูดคุยหรือการอัปเดต</p>
                            )}
                        </div>

                        {/* Reply Input */}
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                            <label style={{ fontWeight: '900', fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem', display: 'block' }}>ตอบกลับแอดมิน</label>
                            <textarea value={replyMessage} onChange={e => setReplyMessage(e.target.value)} placeholder="พิมพ์ข้อความตอบกลับ..." style={{ width: '100%', height: '80px', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', resize: 'none', marginBottom: '1rem', fontFamily: 'inherit' }} />
                            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input type="file" accept="image/*" id="replyImgUser" style={{ display: 'none' }} onChange={e => setReplyFile(e.target.files?.[0] || null)} />
                                <label htmlFor="replyImgUser" style={{ padding: '0.6rem 1rem', background: '#f1f5f9', cursor: 'pointer', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '800' }}>{replyFile ? '📷 ' + replyFile.name : '📷 แนบรูปภาพ'}</label>
                                {replyFile && <button onClick={() => setReplyFile(null)} style={{ border: 'none', background: 'transparent', color: 'red', fontWeight: '800', cursor: 'pointer' }}>✕</button>}
                                <button onClick={handleAddComment} disabled={isReplying || (!replyMessage && !replyFile)} style={{ marginLeft: 'auto', background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}>{isReplying ? 'ส่ง...' : 'ส่งข้อความ'}</button>
                            </div>
                        </div>

                        {/* Closing Logic */}
                        {selectedTicket.CurrentStatus === 'Completed' && (
                            <div style={{ marginTop: '2rem', padding: '1.5rem', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.05)', border: '1px dashed #10b981' }}>
                                <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#065f46', textAlign: 'center', fontWeight: 'bold' }}>
                                    ช่างแจ้งว่าซ่อมเสร็จเรียบร้อยแล้ว <br /> กรุณาตรวจสอบและกดยืนยันเพื่อปิดงาน
                                </p>
                                <button
                                    onClick={() => handleConfirmSuccess(selectedTicket.TicketID)}
                                    className="btn-primary"
                                    style={{ width: '100%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: 'none', padding: '1rem', borderRadius: '12px', fontWeight: '800', color: 'white', cursor: 'pointer' }}
                                >
                                    <span>✅ ยืนยันว่าเสร็จเรียบร้อย (ปิดงานถาวร)</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <SignatureModal
                isOpen={showSignPad}
                title="กรุณาลงลายมือชื่อรับมอบงานซ่อม (สาขา)"
                onClose={() => { setShowSignPad(false); setSubmittingTicketId(null); }}
                onConfirm={submitConfirmSuccess}
            />
        </>
    );
}
