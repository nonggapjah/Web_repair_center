"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getAllTickets, updateTicketStatus, addTicketComment } from '@/app/actions/tickets';
import { supabase } from '@/lib/supabase';

const statuses = ["Open", "On Process", "Repairing", "Waiting Parts", "Completed", "Closed"];
const adminSelectableStatuses = ["Open", "On Process", "Repairing", "Waiting Parts", "Completed"]; // No 'Closed'
const technicians = ["ช่างยศ", "ช่างชา", "ช่างต้น", "ช่างปาด", "ช่างสกล", "ช่างเขียด", "ช่างประวิท", "ช่างเดี่ยว", "ทีมช่างรับเหมา"];

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

export default function AdminDashboard() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'overview'>('overview');
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [techNote, setTechNote] = useState('');
    const [selectedTech, setSelectedTech] = useState('');
    const [actualDate, setActualDate] = useState('');
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Timeline/Chat states
    const [replyMessage, setReplyMessage] = useState('');
    const [replyFile, setReplyFile] = useState<File | null>(null);
    const [isReplying, setIsReplying] = useState(false);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterSymptom, setFilterSymptom] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [filterTechnician, setFilterTechnician] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchTickets = async () => {
        try {
            const data = await getAllTickets();
            setTickets(data);
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchTickets(); }, []);

    useEffect(() => {
        if (selectedTicket) {
            const lastNote = selectedTicket.History && selectedTicket.History.length > 0 ? selectedTicket.History[0].Note : '';
            // setTechNote(lastNote || ''); // Option: do not prefill tech notes so it's only active notes
            setTechNote('');
            setSelectedTech(selectedTicket.Technician || '');
            setActualDate(selectedTicket.ActualDate ? new Date(selectedTicket.ActualDate).toISOString().split('T')[0] : '');
            setPendingStatus(selectedTicket.CurrentStatus);
        } else {
            setReplyMessage('');
            setReplyFile(null);
        }
    }, [selectedTicket]);

    // Unique values for filters
    const branches = useMemo(() => Array.from(new Set(tickets.map(t => t.Branch?.BranchName || t.BranchID))).filter(Boolean).sort(), [tickets]);
    const symptoms = useMemo(() => Array.from(new Set(tickets.map(t => t.Symptom))).filter(Boolean).sort(), [tickets]);

    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            const ticketTime = new Date(t.CreatedAt).getTime();
            if (startDate && ticketTime < new Date(startDate).setHours(0, 0, 0, 0)) return false;
            if (endDate && ticketTime > new Date(endDate).setHours(23, 59, 59, 999)) return false;
            if (filterStatus && t.CurrentStatus !== filterStatus) return false;
            if (filterSymptom && t.Symptom !== filterSymptom) return false;
            if (filterBranch && (t.Branch?.BranchName || t.BranchID) !== filterBranch) return false;
            if (filterTechnician && t.Technician !== filterTechnician) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return t.TicketID.toLowerCase().includes(q) || (t.Product || '').toLowerCase().includes(q) || (t.Description || '').toLowerCase().includes(q);
            }
            return true;
        });
    }, [tickets, startDate, endDate, filterStatus, filterSymptom, filterBranch, filterTechnician, searchQuery]);

    const handleSaveUpdate = async () => {
        if (!selectedTicket || !pendingStatus) return;
        setIsUpdating(true);
        try {
            await updateTicketStatus(selectedTicket.TicketID, pendingStatus, techNote, selectedTech, actualDate);
            const refresh = await getAllTickets();
            setTickets(refresh);
            setSelectedTicket(null);
            alert('บันทึกสำเร็จ');
        } catch (err) { alert('ผิดพลาด'); } finally { setIsUpdating(false); }
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
            await addTicketComment(selectedTicket.TicketID, replyMessage, publicUrl);
            setReplyMessage('');
            setReplyFile(null);

            const updatedTickets = await getAllTickets();
            setTickets(updatedTickets);
            const newT = updatedTickets.find(t => t.TicketID === selectedTicket.TicketID);
            if (newT) setSelectedTicket(newT);

        } catch (err) {
            alert('ไม่สามารถส่งข้อความได้');
            console.error(err);
        } finally {
            setIsReplying(false);
        }
    };

    const handleExport = () => {
        const headers = ["TicketID", "Status", "Product", "Category", "Branch", "Tech", "Created", "ActualDate"];
        const csv = ["\uFEFF" + headers.join(",")];
        filteredTickets.forEach(t => csv.push([
            t.TicketID.toUpperCase(),
            translateStatus(t.CurrentStatus),
            (t.Product || "-").replace(/,/g, " "),
            t.Symptom,
            t.Branch?.BranchName || t.BranchID,
            t.Technician || "-",
            new Date(t.CreatedAt).toLocaleString('th-TH'),
            t.ActualDate ? new Date(t.ActualDate).toLocaleDateString('th-TH') : "-"
        ].join(",")));
        const blob = new Blob([csv.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // Chart Data
    const symptomStats = filteredTickets.reduce((acc: any, t) => { acc[t.Symptom] = (acc[t.Symptom] || 0) + 1; return acc; }, {});
    const sortedSymptoms = Object.entries(symptomStats).sort((a: any, b: any) => b[1] - a[1]);
    const chartColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];
    let curAngle = 0;
    const conicGradient = sortedSymptoms.map(([_, count]: any, i) => {
        const angle = (count / (filteredTickets.length || 1)) * 360;
        const res = `${chartColors[i % chartColors.length]} ${curAngle}deg ${curAngle + angle}deg`;
        curAngle += angle;
        return res;
    }).join(', ');

    const combinedTimeline = selectedTicket ? [
        ...(selectedTicket.History || []).map((h: any) => ({ type: 'history', date: h.Timestamp, user: h.UpdatedBy, msg: h.Note, status: h.Status })),
        ...(selectedTicket.Comments || []).map((c: any) => ({ type: 'comment', date: c.Timestamp, user: c.User?.Role === 'Admin' ? 'แอดมิน' : 'สาขา', msg: c.Message, img: c.ImageURL }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '6rem 2rem 2rem' }} className="mobile-padded">
            <style jsx global>{`
                .filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
                .modal-wrapper { display: flex; flex-direction: row; }
                .header-actions { display: flex; gap: 0.8rem; }
                
                @media (max-width: 768px) { 
                    .mobile-padded { padding: 4.5rem 0.5rem 1rem !important; }
                    .filter-grid { grid-template-columns: 1fr; } 
                    
                    .table-container { 
                        overflow-x: auto !important; 
                        width: 100%; 
                        -webkit-overflow-scrolling: touch; 
                    }
                    
                    .modal-wrapper { 
                        flex-direction: column !important; 
                        overflow-y: auto !important; 
                        max-height: 90vh !important; 
                    }
                    .modal-col-left { 
                        border-right: none !important; 
                        border-bottom: 1px solid #e2e8f0; 
                        flex: none !important; 
                        max-height: none !important; 
                        padding: 1.5rem !important; 
                    }
                    .modal-col-right { 
                        flex: none !important; 
                        padding: 1.5rem !important; 
                    }
                    
                    .header-actions { flex-direction: column; width: 100%; }
                    .header-actions > button, .header-actions > div { width: 100%; justify-content: center; }
                    .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
                    .stats-overall { grid-template-columns: 1fr !important; }
                }
            `}</style>

            <main style={{ maxWidth: '1600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#1e293b' }}>Admin Dashboard</h1>
                        <p style={{ color: '#64748b' }}>ระบบจัดการงานซ่อมบำรุง</p>
                    </div>
                    <div className="header-actions">
                        <button onClick={handleExport} style={{ padding: '0.6rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: '700' }}>📥 Export</button>
                        <div style={{ background: '#e2e8f0', padding: '0.3rem', borderRadius: '12px', display: 'flex', gap: '0.2rem' }}>
                            {['overview', 'kanban', 'list'].map((m: any) => (
                                <button key={m} onClick={() => setViewMode(m)} style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '10px', border: 'none', background: viewMode === m ? '#1e293b' : 'transparent', color: viewMode === m ? '#fff' : '#475569', fontWeight: '700', cursor: 'pointer' }}>{m === 'overview' ? 'สรุป' : m === 'kanban' ? 'บอร์ด' : 'ตาราง'}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', borderRadius: '20px', background: '#fff', marginBottom: '2.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                    <div className="filter-grid">
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>ค้นหา (ID/อุปกรณ์)</label>
                            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ระบุคำค้นหา..." style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>สถานะ</label>
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                <option value="">ทั้งหมด</option>
                                {statuses.map(s => <option key={s} value={s}>{translateStatus(s)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>หมวดหมู่</label>
                            <select value={filterSymptom} onChange={e => setFilterSymptom(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                <option value="">ทั้งหมด</option>
                                {symptoms.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>สาขา</label>
                            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                <option value="">ทั้งหมด</option>
                                {branches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>ช่าง</label>
                            <select value={filterTechnician} onChange={e => setFilterTechnician(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                <option value="">ทั้งหมด</option>
                                {technicians.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>จากวันที่แจ้ง</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button onClick={() => { setStartDate(''); setEndDate(''); setFilterStatus(''); setFilterSymptom(''); setFilterBranch(''); setFilterTechnician(''); setSearchQuery(''); }} style={{ background: '#f1f5f9', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', width: '100%', color: '#64748b' }}>ล้างตัวกรองทั้งหมด</button>
                        </div>
                    </div>
                </div>

                {viewMode === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                            {[
                                { l: 'รวม', c: filteredTickets.length, cl: '#1e293b' },
                                { l: 'รอดำเนินการ', c: filteredTickets.filter(t => ['Open', 'Accepted'].includes(t.CurrentStatus)).length, cl: '#f59e0b' },
                                { l: 'กำลังซ่อม', c: filteredTickets.filter(t => ['Repairing', 'On Process'].includes(t.CurrentStatus)).length, cl: '#3b82f6' },
                                { l: 'รออะไหล่', c: filteredTickets.filter(t => t.CurrentStatus === 'Waiting Parts').length, cl: '#ef4444' },
                                { l: 'เสร็จสิ้น', c: filteredTickets.filter(t => t.CurrentStatus === 'Completed').length, cl: '#10b981' }
                            ].map((s, i) => (
                                <div key={i} style={{ padding: '1.2rem', textAlign: 'center', background: '#fff', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                    <h4 style={{ fontSize: '2rem', fontWeight: '900', color: s.cl }}>{s.c}</h4>
                                    <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b' }}>{s.l}</p>
                                </div>
                            ))}
                        </div>

                        <div className="stats-overall" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                            <div style={{ padding: '2rem', borderRadius: '24px', background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>📊 ภาระงานรายช่าง</h3>
                                {technicians.map(tech => {
                                    const tks = filteredTickets.filter(t => t.Technician === tech);
                                    if (tks.length === 0 && !filterTechnician) return null;
                                    return (
                                        <div key={tech} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <span style={{ fontWeight: '800' }}>ช่าง {tech}</span>
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                <span style={{ background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800' }}>รวม {tks.length}</span>
                                                <span style={{ background: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', color: '#166534' }}>เสร็จ {tks.filter(t => ['Completed', 'Closed'].includes(t.CurrentStatus)).length}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ padding: '2rem', borderRadius: '24px', background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <h3 style={{ marginBottom: '1.5rem', width: '100%', color: '#1e293b' }}>🧩 สัดส่วนประเภทปัญหา</h3>
                                <div style={{ width: '220px', height: '220px', borderRadius: '50%', background: filteredTickets.length > 0 ? `conic-gradient(${conicGradient})` : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ width: '140px', height: '140px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#64748b', fontSize: '1.2rem' }}>{filteredTickets.length}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'list' && (
                    <div className="table-container" style={{ borderRadius: '20px', background: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
                        <div style={{ padding: '1rem', background: '#fef3c7', color: '#92400e', fontSize: '0.85rem', fontWeight: '800', borderRadius: '20px 20px 0 0', textAlign: 'center' }} className="d-block d-md-none">
                            👈 ปัดซ้าย-ขวา เพื่อดูข้อมูลเพิ่มเติม 👉
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                            <thead style={{ background: '#f8fafc' }}>
                                <tr>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>สถานะ</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>อุปกรณ์</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>หมวดหมู่</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>สาขา</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>ช่าง</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>วันที่แจ้ง</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>วันที่เข้าจริง</th>
                                    <th style={{ padding: '1.2rem' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTickets.map(t => (
                                    <tr key={t.TicketID} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => setSelectedTicket(t)}>
                                        <td style={{ padding: '1rem 1.2rem' }}>
                                            <span style={{ display: 'inline-block', whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '800', background: statusColor(t.CurrentStatus) + '20', color: statusColor(t.CurrentStatus), border: `1px solid ${statusColor(t.CurrentStatus)}` }}>{translateStatus(t.CurrentStatus)}</span>
                                        </td>
                                        <td style={{ padding: '1rem 1.2rem', fontWeight: '800', color: '#1e293b' }}>{t.Product || "-"}</td>
                                        <td style={{ padding: '1rem 1.2rem' }}>{t.Symptom}</td>
                                        <td style={{ padding: '1rem 1.2rem', color: '#475569', fontSize: '0.9rem' }}>{t.Branch?.BranchName || t.BranchID}</td>
                                        <td style={{ padding: '1rem 1.2rem', fontWeight: '700' }}>{t.Technician || "-"}</td>
                                        <td style={{ padding: '1rem 1.2rem', fontSize: '0.9rem' }}>{new Date(t.CreatedAt).toLocaleDateString('th-TH')}</td>
                                        <td style={{ padding: '1rem 1.2rem', fontWeight: '800', color: '#3b82f6', fontSize: '0.9rem' }}>{t.ActualDate ? new Date(t.ActualDate).toLocaleDateString('th-TH') : "-"}</td>
                                        <td style={{ padding: '1rem 1.2rem' }}>
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedTicket(t); }} style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800' }}>จัดการ</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {viewMode === 'kanban' && (
                    <DragDropContext onDragEnd={() => { }}>
                        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                            {statuses.map(s => (
                                <div key={s} style={{ minWidth: '300px', flex: 1, background: '#f1f5f9', borderRadius: '20px', padding: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <h4 style={{ fontWeight: '900', color: '#1e293b' }}>{translateStatus(s)}</h4>
                                        <span style={{ background: '#fff', padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '800' }}>{filteredTickets.filter(t => t.CurrentStatus === s).length}</span>
                                    </div>
                                    <div style={{ minHeight: '500px' }}>
                                        {filteredTickets.filter(t => t.CurrentStatus === s).map(t => (
                                            <div key={t.TicketID} onClick={() => setSelectedTicket(t)} style={{ background: '#fff', padding: '1.2rem', borderRadius: '15px', marginBottom: '0.8rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: '900', color: '#6366f1' }}>#{t.TicketID.substring(0, 8).toUpperCase()}</div>
                                                <div style={{ fontWeight: '800', margin: '0.4rem 0', color: '#1e293b' }}>{t.Product || 'ไม่ระบุอุปกรณ์'}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{t.Branch?.BranchName || t.BranchID}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DragDropContext>
                )}
            </main>

            {/* Modal */}
            {selectedTicket && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }} onClick={() => setSelectedTicket(null)}>
                    <div className="modal-wrapper" style={{ background: '#fff', width: '100%', maxWidth: '1100px', borderRadius: '25px', display: 'flex', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>

                        <div className="modal-col-left" style={{ flex: 1.2, padding: '2.5rem', overflowY: 'auto', maxHeight: '85vh', borderRight: '1px solid #f1f5f9', background: '#fafafa' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#1e293b' }}>{selectedTicket.Product || 'ไม่ระบุอุปกรณ์'}</h2>
                                    <p style={{ color: '#6366f1', fontWeight: '800', marginTop: '0.4rem' }}>หมวดหมู่: {selectedTicket.Symptom}</p>
                                </div>
                                <button onClick={() => setSelectedTicket(null)} style={{ background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>×</button>
                            </div>

                            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                                <span style={{ padding: '0.4rem 0.8rem', background: '#e2e8f0', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '800' }}>#{selectedTicket.TicketID.substring(0, 8).toUpperCase()}</span>
                                <span style={{ display: 'inline-block', whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '800', background: statusColor(selectedTicket.CurrentStatus) + '20', color: statusColor(selectedTicket.CurrentStatus) }}>{translateStatus(selectedTicket.CurrentStatus)}</span>
                            </div>

                            <div style={{ marginTop: '1rem', background: '#fff', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                <p style={{ fontWeight: '900', marginBottom: '0.5rem', color: '#475569' }}>รายละเอียดจากผู้แจ้ง:</p>
                                <p style={{ color: '#1e293b', lineHeight: '1.6' }}>{selectedTicket.Description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                                {selectedTicket.ImageURL && (
                                    <img src={selectedTicket.ImageURL} alt="Evidence" style={{ width: '100%', borderRadius: '15px', marginTop: '1rem', border: '2px solid #f1f5f9' }} />
                                )}
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
                                        {item.img && <img src={item.img} style={{ maxWidth: '200px', borderRadius: '10px', marginTop: '0.5rem', border: '1px solid #cbd5e1' }} />}
                                    </div>
                                )) : (
                                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>ยังไม่มีการพูดคุยหรือการอัปเดต</p>
                                )}
                            </div>

                            {/* Reply Input */}
                            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                <label style={{ fontWeight: '900', fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem', display: 'block' }}>ส่งข้อความ / ตอบกลับ</label>
                                <textarea value={replyMessage} onChange={e => setReplyMessage(e.target.value)} placeholder="พิมพ์ข้อความตอบกลับสาขา..." style={{ width: '100%', height: '80px', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', resize: 'none', marginBottom: '1rem' }} />
                                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                                    <input type="file" accept="image/*" id="replyImg" style={{ display: 'none' }} onChange={e => setReplyFile(e.target.files?.[0] || null)} />
                                    <label htmlFor="replyImg" style={{ padding: '0.6rem 1rem', background: '#f1f5f9', cursor: 'pointer', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '800' }}>{replyFile ? '📷 ' + replyFile.name : '📷 แนบรูปภาพ'}</label>
                                    {replyFile && <button onClick={() => setReplyFile(null)} style={{ border: 'none', background: 'transparent', color: 'red', fontWeight: '800', cursor: 'pointer' }}>✕</button>}
                                    <button onClick={handleAddComment} disabled={isReplying || (!replyMessage && !replyFile)} style={{ marginLeft: 'auto', background: '#6366f1', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}>{isReplying ? 'ส่ง...' : 'ส่งข้อความ'}</button>
                                </div>
                            </div>
                        </div>

                        <div className="modal-col-right" style={{ flex: 0.8, background: '#fff', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', marginBottom: '1.5rem' }}>⚙️ จัดการงานแจ้งซ่อม</h3>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: '#475569' }}>ช่างผู้รับผิดชอบ</label>
                                    <select value={selectedTech} onChange={e => setSelectedTech(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700' }}>
                                        <option value="">-- ระบุช่าง --</option>
                                        {technicians.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: '#475569' }}>วันที่เข้าซ่อมจริง</label>
                                    <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.8rem', color: '#475569' }}>เปลี่ยนสถานะงาน</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                                    {adminSelectableStatuses.map(s => (
                                        <button key={s} onClick={() => setPendingStatus(s)} style={{ padding: '0.8rem', borderRadius: '12px', border: '2px solid', borderColor: pendingStatus === s ? '#10b981' : '#e2e8f0', background: pendingStatus === s ? '#10b981' : '#fff', color: pendingStatus === s ? '#fff' : '#475569', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s', boxShadow: pendingStatus === s ? '0 4px 6px rgba(16, 185, 129, 0.2)' : 'none' }}>{translateStatus(s)}</button>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.8rem', fontWeight: '800' }}>* สถานะ "ปิดงานถาวร" สาขาจะเป็นผู้กดเพื่อประเมินผลช่าง</p>
                            </div>

                            <div>
                                <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: '#475569' }}>บันทึกภายในสำหรับแอดมิน</label>
                                <textarea value={techNote} onChange={e => setTechNote(e.target.value)} placeholder="บันทึกข้อความภายในเมื่ออัปเดต..." style={{ width: '100%', height: '80px', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', resize: 'none' }} />
                                <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.3rem' }}>* บันทึกนี้จะลงในประวัติไทม์ไลน์</p>
                            </div>

                            <button onClick={handleSaveUpdate} disabled={isUpdating} style={{ marginTop: 'auto', width: '100%', padding: '1.2rem', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                                {isUpdating ? 'กำลังบันทึก...' : '💾 อัปเดตงานแจ้งซ่อม'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
