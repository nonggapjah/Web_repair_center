"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTechnicianTickets, updateTicketStatus, addTicketComment } from '@/app/actions/tickets';
import { getSession, logout } from '@/app/actions/auth';
import { supabase } from '@/lib/supabase';
import HeicViewerModal from '@/components/HeicViewerModal';

const statuses = ["Open", "On Process", "Repairing", "Waiting Parts", "Completed", "Closed"];
const technicianSelectableStatuses = ["Repairing", "Waiting Parts", "Completed"];

export default function TechnicianTicketList() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

    // Timeline/Chat states
    const [replyMessage, setReplyMessage] = useState('');
    const [replyFiles, setReplyFiles] = useState<File[]>([]);
    const [isReplying, setIsReplying] = useState(false);
    const [heicUrlToView, setHeicUrlToView] = useState<string | null>(null);

    // Tech updates
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [techNote, setTechNote] = useState('');

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

    const getLastUpdateInfo = (ticket: any) => {
        const history = ticket.History?.[0];
        const comment = ticket.Comments?.[0];

        let last: { date: Date, msg: string } | null = null;
        if (history && comment) {
            last = new Date(history.Timestamp) > new Date(comment.Timestamp) 
                ? { date: new Date(history.Timestamp), msg: history.Note || `อัปเดตสถานะ: ${translateStatus(history.Status)}` } 
                : { date: new Date(comment.Timestamp), msg: comment.Message || 'แนบรูปภาพ' };
        } else if (history) {
            last = { date: new Date(history.Timestamp), msg: history.Note || `อัปเดตสถานะ: ${translateStatus(history.Status)}` };
        } else if (comment) {
            last = { date: new Date(comment.Timestamp), msg: comment.Message || 'แนบรูปภาพ' };
        }
        return last;
    };

    const fetchTickets = async (technicianName: string, isInitial = false) => {
        if (isInitial) setIsLoading(true);
        try {
            const data = await getTechnicianTickets(technicianName, Date.now());
            setTickets(data);
        } catch (error) {
            console.error("Fetch tickets error:", error);
        } finally {
            if (isInitial) setIsLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            const session = await getSession();
            if (!session || session.role !== 'Technician') {
                window.location.href = '/login';
                return;
            }
            setUser(session);
            fetchTickets(session.displayName || session.username, true);

            // Auto-poll user tickets every 5s
            const interval = setInterval(() => fetchTickets(session.displayName || session.username, false), 5000);
            return () => clearInterval(interval);
        };
        const cleanup = init();
        return () => { cleanup.then(fn => fn && fn()); };
    }, []);

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
        if (selectedTicket) {
            setPendingStatus(selectedTicket.CurrentStatus);
            setTechNote('');
        } else {
            setReplyMessage('');
            setReplyFiles([]);
        }
    }, [selectedTicket]);

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
    };

    const handleAddComment = async () => {
        if (!replyMessage && replyFiles.length === 0) return;
        setIsReplying(true);
        try {
            let publicUrls: string[] = [];
            for (const file of replyFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('tickets').upload(fileName, file);
                if (uploadError) throw new Error('Upload failed');
                const { data } = supabase.storage.from('tickets').getPublicUrl(fileName);
                publicUrls.push(data.publicUrl);
            }
            const finalImageUrl = publicUrls.join(',');
            await addTicketComment(selectedTicket.TicketID, replyMessage, finalImageUrl, user.userId);
            setReplyMessage('');
            setReplyFiles([]);

            if (user) {
                const updatedTickets = await getTechnicianTickets(user.displayName || user.username, Date.now());
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

    const handleSaveUpdate = async () => {
        if (!selectedTicket || !pendingStatus) return;

        setIsUpdating(true);
        
        const previousTicket = selectedTicket;
        const currentPendingStatus = pendingStatus;
        const currentTechNote = techNote;

        // Optimistic update
        setTickets(prev => prev.map(t => t.TicketID === previousTicket.TicketID ? {
            ...t,
            CurrentStatus: currentPendingStatus,
        } : t));
        setSelectedTicket(null);

        try {
            await updateTicketStatus(previousTicket.TicketID, currentPendingStatus, currentTechNote, user.displayName || user.username, previousTicket.ActualDate, previousTicket.AdminSignature);
        } catch (err) { 
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
            fetchTickets(user.displayName || user.username); // Revert on failure
        } finally { 
            setIsUpdating(false); 
        }
    };

    const handleReplyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setReplyFiles(prev => [...prev, ...processedFiles]);
    };

    if (!user) return null;

    const combinedTimeline = selectedTicket ? [
        ...(selectedTicket.History || []).map((h: any) => ({ type: 'history', date: h.Timestamp, user: h.UpdatedBy, msg: h.Note, status: h.Status })),
        ...(selectedTicket.Comments || []).map((c: any) => ({ type: 'comment', date: c.Timestamp, user: c.User?.Role === 'Admin' ? 'แอดมิน' : `ผู้ใช้/สาขา`, msg: c.Message, img: c.ImageURL }))
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
                            <h1 style={{ color: 'var(--accent-primary)', fontSize: '2.2rem', marginBottom: '0.5rem' }}>กระดานงานช่าง ({user.displayName || user.username})</h1>
                            <p style={{ color: 'var(--text-muted)' }}>รายการแจ้งซ่อมที่ได้รับมอบหมาย</p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', fontWeight: '800' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></span>
                                <span style={{ color: '#475569' }}>เขียว: งานเสร็จสิ้น</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span>
                                <span style={{ color: '#475569' }}>เหลือง: ไม่ขยับเกิน 3 วัน</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
                                <span style={{ color: '#475569' }}>แดง: ไม่ขยับเกิน 7 วัน</span>
                            </div>
                        </div>
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
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>สาขา</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>หมวดหมู่</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>อุปกรณ์</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>สถานะ</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>อัปเดตล่าสุด</th>
                                        <th style={{ padding: '1.2rem', color: '#475569', width: '200px' }}>ข้อความล่าสุด</th>
                                        <th style={{ padding: '1.2rem', color: '#475569' }}>วันที่รับมอบหมาย</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>ยังไม่มีรายการแจ้งซ่อมที่ได้รับมอบหมาย</td>
                                        </tr>
                                    ) : (
                                        tickets.map(ticket => {
                                            return (
                                                <tr
                                                    key={ticket.TicketID}
                                                    style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer' }}
                                                    className="hover-row"
                                                    onClick={() => setSelectedTicket(ticket)}
                                                >
                                                    <td style={{ padding: '1.2rem', fontWeight: '600', color: 'var(--accent-primary)' }}>{ticket.TicketID.substring(0, 8).toUpperCase()}</td>
                                                    <td style={{ padding: '1.1rem', fontWeight: 'bold' }}>{ticket.Branch?.BranchName || ticket.BranchID}</td>
                                                    <td style={{ padding: '1.1rem' }}>{ticket.Symptom}</td>
                                                    <td style={{ padding: '1.1rem', color: 'var(--accent-secondary)', fontWeight: '600' }}>{ticket.Product}</td>
                                                    <td style={{ padding: '1.1rem' }}>
                                                        <span className="badge" style={{
                                                            background: getSLAColor(ticket) || `${statusColor(ticket.CurrentStatus)}15`,
                                                            color: getSLAColor(ticket) ? '#fff' : statusColor(ticket.CurrentStatus),
                                                            border: getSLAColor(ticket) ? 'none' : `1px solid ${statusColor(ticket.CurrentStatus)}30`
                                                        }}>{translateStatus(ticket.CurrentStatus)}</span>
                                                    </td>
                                                    <td style={{ padding: '1.1rem', fontSize: '0.85rem', color: '#64748b' }}>
                                                        {getLastUpdateInfo(ticket) ? getLastUpdateInfo(ticket)?.date.toLocaleString('th-TH', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : "-"}
                                                    </td>
                                                    <td style={{ padding: '1.1rem', fontSize: '0.85rem', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {getLastUpdateInfo(ticket)?.msg || "-"}
                                                    </td>
                                                    <td style={{ padding: '1.1rem' }}>{new Date(ticket.CreatedAt).toLocaleDateString('th-TH')}</td>
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
                        maxWidth: '900px',
                        maxHeight: '90vh',
                        background: '#fff',
                        borderRadius: '28px',
                        display: 'flex',
                        flexDirection: 'row',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        overflow: 'hidden'
                    }} onClick={e => e.stopPropagation()}>
                        
                        <div style={{ flex: 1.2, padding: '2.5rem', overflowY: 'auto', borderRight: '1px solid #f1f5f9', background: '#fafafa' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2 style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '1.6rem' }}>คำขอ #{selectedTicket.TicketID.substring(0, 8).toUpperCase()}</h2>
                                    <p style={{ margin: '0.5rem 0 0 0', color: 'var(--accent-secondary)', fontWeight: 'bold' }}>📦 อุปกรณ์: {selectedTicket.Product}</p>
                                    <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>📍 สาขา: {selectedTicket.Branch?.BranchName || selectedTicket.BranchID}</p>
                                </div>
                                <button onClick={() => setSelectedTicket(null)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }} className="d-md-none">&times;</button>
                            </div>

                            <div style={{ marginBottom: '1.5rem', background: 'rgba(30,58,138,0.03)', padding: '1.2rem', borderRadius: '15px' }}>
                                <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>หมวดหมู่ปัญหา</label>
                                <p style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 1rem 0' }}>{selectedTicket.Symptom}</p>

                                <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span className="badge" style={{ background: statusColor(selectedTicket.CurrentStatus), color: '#fff' }}>{translateStatus(selectedTicket.CurrentStatus)}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(selectedTicket.CreatedAt).toLocaleDateString('th-TH')}</span>
                                </div>
                            </div>

                            <div style={{ marginTop: '1rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                                <p style={{ fontWeight: '900', marginBottom: '0.5rem', color: '#475569' }}>รายละเอียดจากผู้แจ้ง:</p>
                                <p style={{ color: '#1e293b', lineHeight: '1.6' }}>{selectedTicket.Description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                                {selectedTicket.ImageURL && selectedTicket.ImageURL.split(',').map((url: string, idx: number) => {
                                    const isVideo = url.match(/\.(mp4|webm|mov|ogg)$/i);
                                    const isHeic = url.match(/\.(heic|heif)$/i);
                                    return (
                                        <div key={idx} style={{ marginTop: '1rem' }}>
                                            {isVideo ? (
                                                <div style={{ position: 'relative' }}>
                                                    <video src={url} controls style={{ width: '100%', borderRadius: '15px', border: '2px solid #f1f5f9', background: '#0f172a' }} />
                                                    {url.match(/\.(mov)$/i) && (
                                                        <div style={{ padding: '0.8rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                            <span style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: '800' }}>⚠️ วิดีโอ iPhone (.mov) อาจมีแต่เสียง ให้กดดาวน์โหลดเพื่อดูภาพครับ</span>
                                                            <button onClick={() => window.open(url, '_blank')} style={{ padding: '0.4rem 0.8rem', background: '#ef4444', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.75rem' }}>ดาวน์โหลด</button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : isHeic ? (
                                                <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '15px', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: '800' }}>🖼️ รูปภาพ (HEIC จาก iPhone)</span>
                                                    <button onClick={() => setHeicUrlToView(url)} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800' }}>แปลงไฟล์ / เปิดดู</button>
                                                </div>
                                            ) : (
                                                <img src={url} alt={`Evidence ${idx}`} loading="lazy" style={{ width: '100%', borderRadius: '15px', border: '2px solid #f1f5f9', cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <hr style={{ margin: '2rem 0', borderColor: '#e2e8f0' }} />
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', marginBottom: '1rem' }}>💬 ไทม์ไลน์ & แชทโต้ตอบ</h3>

                            {/* Timeline display */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                                {combinedTimeline.length > 0 ? combinedTimeline.map((item, idx) => (
                                    <div key={idx} style={{ padding: '1rem', background: item.type === 'history' ? '#f1f5f9' : '#e0e7ff', borderRadius: '15px', borderLeft: `4px solid ${item.type === 'history' ? '#94a3b8' : '#6366f1'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: '800', color: '#64748b' }}>
                                            <span>{item.type === 'history' ? '🛠️ อัปเดตงาน' : '👤 ' + (item.user || '')}</span>
                                            <span>{new Date(item.date).toLocaleString('th-TH')}</span>
                                        </div>
                                        {item.type === 'history' && item.status && (
                                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#fff', borderRadius: '6px', fontWeight: '800', border: '1px solid #cbd5e1', marginRight: '0.5rem' }}>เปลี่ยนสถานะ: {translateStatus(item.status)}</span>
                                        )}
                                        {item.msg && <p style={{ color: '#1e293b', fontSize: '0.95rem', marginTop: '0.5rem' }}>{item.msg}</p>}
                                        {item.img && (
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                                {item.img.split(',').map((url: string, idx: number) => {
                                                    const isVideo = url.match(/\.(mp4|webm|mov|ogg)$/i);
                                                    const isHeic = url.match(/\.(heic|heif)$/i);
                                                    return isVideo ? (
                                                        <div key={idx} style={{ position: 'relative', maxWidth: '250px' }}>
                                                            <video src={url} controls style={{ width: '100%', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#0f172a' }} />
                                                            {url.match(/\.(mov)$/i) && (
                                                                <button onClick={() => window.open(url, '_blank')} style={{ width: '100%', padding: '0.5rem', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: '800', fontSize: '0.7rem', marginTop: '0.3rem' }}>⚠️ โหลดวิดีโอ (.mov)</button>
                                                            )}
                                                        </div>
                                                    ) : isHeic ? (
                                                        <button key={idx} onClick={() => setHeicUrlToView(url)} style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', borderRadius: '10px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem' }}>🖼️ ดูรูป HEIC</button>
                                                    ) : (
                                                        <img key={idx} src={url} loading="lazy" style={{ maxWidth: '200px', borderRadius: '10px', border: '1px solid #cbd5e1', cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )) : (
                                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>ยังไม่มีการพูดคุยหรือการอัปเดต</p>
                                )}
                            </div>

                            {/* Reply Input */}
                            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                <label style={{ fontWeight: '900', fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem', display: 'block' }}>ส่งข้อความ</label>
                                <textarea value={replyMessage} onChange={e => setReplyMessage(e.target.value)} placeholder="พิมพ์ข้อความ..." style={{ width: '100%', height: '80px', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', resize: 'none', marginBottom: '1rem', fontFamily: 'inherit' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        {replyFiles.map((file, idx) => (
                                            <div key={idx} style={{ padding: '0.4rem 0.8rem', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                📎 {file.name}
                                                <button onClick={() => setReplyFiles(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', color: 'red', fontWeight: '800', cursor: 'pointer', padding: '0' }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input type="file" accept="image/*,video/*" multiple id="replyImgUser" style={{ display: 'none' }} onChange={handleReplyFileChange} />
                                        <label htmlFor="replyImgUser" style={{ padding: '0.6rem 1rem', background: '#f1f5f9', cursor: 'pointer', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '800' }}>📎 แนบรูปภาพ/วิดีโอ</label>
                                        <button onClick={handleAddComment} disabled={isReplying || (!replyMessage && replyFiles.length === 0)} style={{ marginLeft: 'auto', background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}>{isReplying ? 'ส่ง...' : 'ส่งข้อความ'}</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ flex: 0.8, background: '#fff', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
                            <button onClick={() => setSelectedTicket(null)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(0,0,0,0.05)', border: 'none', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#475569' }} className="d-none d-md-flex">&times;</button>
                            
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', marginBottom: '1rem', marginTop: '1.5rem' }}>⚙️ อัปเดตสถานะงานซ่อม</h3>

                            <div>
                                <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.8rem', color: '#475569' }}>เปลี่ยนสถานะงาน</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {technicianSelectableStatuses.map(s => (
                                        <button key={s} onClick={() => setPendingStatus(s)} style={{ padding: '0.8rem', borderRadius: '12px', border: '2px solid', borderColor: pendingStatus === s ? '#10b981' : '#e2e8f0', background: pendingStatus === s ? '#10b981' : '#fff', color: pendingStatus === s ? '#fff' : '#475569', fontSize: '0.9rem', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s', boxShadow: pendingStatus === s ? '0 4px 6px rgba(16, 185, 129, 0.2)' : 'none' }}>{translateStatus(s)}</button>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.8rem', fontWeight: '800' }}>* สถานะ "ปิดงานถาวร" สาขา/แอดมิน จะเป็นผู้กดเพื่อยืนยันหลังซ่อมเสร็จ</p>
                            </div>

                            <div>
                                <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: '#475569' }}>บันทึกภายในสำหรับช่าง</label>
                                <textarea value={techNote} onChange={e => setTechNote(e.target.value)} placeholder="บันทึกข้อความหรือสถานะการเข้าซ่อม..." style={{ width: '100%', height: '100px', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', resize: 'none' }} />
                                <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.3rem' }}>* บันทึกนี้จะลงในประวัติไทม์ไลน์</p>
                            </div>

                            <button onClick={handleSaveUpdate} disabled={isUpdating || pendingStatus === selectedTicket.CurrentStatus} style={{ marginTop: 'auto', width: '100%', padding: '1.2rem', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1rem', cursor: (isUpdating || pendingStatus === selectedTicket.CurrentStatus) ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', opacity: (isUpdating || pendingStatus === selectedTicket.CurrentStatus) ? 0.6 : 1 }}>
                                {isUpdating ? 'กำลังบันทึก...' : '💾 บันทึกและอัปเดตสถานะ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {heicUrlToView && (
                <HeicViewerModal url={heicUrlToView} onClose={() => setHeicUrlToView(null)} />
            )}
        </>
    );
}
