"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getAllTickets, updateTicketStatus } from '@/app/actions/tickets';
import { logout } from '@/app/actions/auth';

const statuses = ["Open", "On Process", "Repairing", "Waiting Parts", "Completed", "Closed"];
const technicians = ["ช่างยศ", "ช่างชา", "ช่างต้น", "ช่างปาด", "ช่างสกล", "ช่างเขียด", "ช่างประวิท", "ช่างเดี่ยว"];

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

// SLA Calculation (7 days = Red, 3 days = Yellow)
// Return string instead of string | null to satisfy TS compiler in inline styles
const getSLAColor = (ticket: any): string => {
    if (ticket.CurrentStatus === 'Completed' || ticket.CurrentStatus === 'Closed') {
        return '#10b981';
    }
    const createdDate = new Date(ticket.CreatedAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays >= 7) return '#ef4444';
    if (diffDays >= 3) return '#f59e0b';
    return 'transparent'; // Use transparent instead of null
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

    // Filter states
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

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

    useEffect(() => {
        fetchTickets();
    }, []);

    useEffect(() => {
        if (selectedTicket) {
            setTechNote(selectedTicket.TechnicianNote || '');
            setSelectedTech(selectedTicket.Technician || '');
            setActualDate(selectedTicket.ActualDate ? new Date(selectedTicket.ActualDate).toISOString().split('T')[0] : '');
            setPendingStatus(selectedTicket.CurrentStatus);
        }
    }, [selectedTicket]);

    // Derived filtered tickets
    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            const ticketDate = new Date(t.CreatedAt);
            ticketDate.setHours(0, 0, 0, 0);
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (ticketDate < start) return false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (ticketDate > end) return false;
            }
            return true;
        });
    }, [tickets, startDate, endDate]);

    const handleSaveUpdate = async () => {
        if (!selectedTicket || !pendingStatus) return;
        setIsUpdating(true);
        try {
            await updateTicketStatus(selectedTicket.TicketID, pendingStatus, techNote, selectedTech, actualDate);
            await fetchTickets();
            setSelectedTicket(null);
            setPendingStatus(null);
            alert('บันทึกข้อมูลเรียบร้อยแล้ว');
        } catch (error) {
            console.error(error);
            alert('เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setIsUpdating(false);
        }
    };

    const onDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;
        if (source.droppableId === destination.droppableId) return;
        if (destination.droppableId === 'Closed') {
            alert("สถานะ 'ปิดงานถาวร' ต้องให้ทางสาขาเป็นผู้กดยืนยันเท่านั้น");
            return;
        }
        const oldTickets = [...tickets];
        setTickets(prev => prev.map(t => t.TicketID === draggableId ? { ...t, CurrentStatus: destination.droppableId } : t));
        const updateResult = await updateTicketStatus(draggableId, destination.droppableId);
        if (!updateResult.success) {
            setTickets(oldTickets);
            alert("ไม่สามารถอัปเดตสถานะได้");
        } else {
            fetchTickets();
        }
    };

    const handleExport = () => {
        const headers = ["Ticket ID", "Status", "หมวดหมู่", "สาขา", "ช่างที่รับผิดชอบ", "รายละเอียด", "วันที่แจ้ง", "วันที่ซ่อมเสร็จ", "หมายเหตุช่าง"];
        const csvRows = [headers.join(",")];
        filteredTickets.forEach(t => {
            const row = [
                t.TicketID.toUpperCase(),
                translateStatus(t.CurrentStatus),
                t.Symptom,
                t.Branch?.BranchName || t.BranchID,
                t.Technician || "-",
                (t.Description || "").replace(/,/g, " ").replace(/\n/g, " "),
                new Date(t.CreatedAt).toLocaleString('th-TH'),
                t.ActualDate ? new Date(t.ActualDate).toLocaleDateString('th-TH') : "-",
                (t.TechnicianNote || "").replace(/,/g, " ").replace(/\n/g, " ")
            ];
            csvRows.push(row.join(","));
        });
        const csvString = "\uFEFF" + csvRows.join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `repair_data_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.click();
    };

    if (isLoading) return <div style={{ textAlign: 'center', padding: '5rem' }}>กำลังโหลด...</div>;

    // Pie Chart Logic
    const symptomStats = filteredTickets.reduce((acc: any, t) => {
        acc[t.Symptom] = (acc[t.Symptom] || 0) + 1;
        return acc;
    }, {});
    const sortedSymptoms = Object.entries(symptomStats).sort((a: any, b: any) => b[1] - a[1]);
    const chartColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899'];
    let currentAngle = 0;
    const segments = sortedSymptoms.map(([label, count]: any, i) => {
        const percentage = (count / (filteredTickets.length || 1)) * 100;
        const angle = (percentage / 100) * 360;
        const startAngle = currentAngle;
        currentAngle += angle;
        return { label, count, percentage, startAngle, angle, color: chartColors[i % chartColors.length] };
    });
    const conicGradientString = segments.map(s => `${s.color} ${s.startAngle}deg ${s.startAngle + s.angle}deg`).join(', ');

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%' }}>
            <main style={{ padding: '6rem 2rem 2rem', maxWidth: '1800px', width: '100%', margin: '0 auto', flex: 1 }}>

                <style jsx global>{`
                    @media (max-width: 1024px) {
                        .grid-layout { grid-template-columns: 1fr !important; }
                    }
                    @media (max-width: 768px) {
                        .stat-cards { grid-template-columns: repeat(2, 1fr) !important; }
                        .header-row { flex-direction: column !important; gap: 1rem !important; }
                        .filter-row { flex-direction: column !important; align-items: stretch !important; }
                        main { padding: 5rem 1rem !important; }
                    }
                `}</style>

                <div className="animate-fade-in">
                    <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                        <div>
                            <h1 style={{ fontSize: '2.4rem', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>Dashboard</h1>
                            <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>สรุปภาพรวมและจัดการระบบแจ้งซ่อมบำรุง</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1.2rem' }}>
                            <div className="glass-panel filter-row" style={{ padding: '0.8rem 1.2rem', display: 'flex', alignItems: 'center', gap: '1rem', borderRadius: '15px', border: '1px solid #e2e8f0', background: '#fff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b' }}>ตั้งแต่วันที่:</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem' }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b' }}>ถึงวันที่:</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem' }} />
                                </div>
                                {(startDate || endDate) && <button onClick={() => { setStartDate(''); setEndDate(''); }} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>ล้าง</button>}
                            </div>

                            <div style={{ display: 'flex', gap: '0.8rem' }}>
                                <button onClick={handleExport} className="glass-panel" style={{ padding: '0.7rem 1.2rem', borderRadius: '12px', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', fontWeight: '700', cursor: 'pointer', background: '#fff' }}>📥 Export ทุกฟิลด์</button>
                                <div style={{ background: '#e2e8f0', padding: '0.3rem', borderRadius: '12px', display: 'flex', gap: '0.2rem' }}>
                                    {['overview', 'kanban', 'list'].map((mode: any) => (
                                        <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', border: 'none', cursor: 'pointer', background: viewMode === mode ? 'var(--accent-primary)' : 'transparent', color: viewMode === mode ? '#fff' : 'var(--text-secondary)', fontWeight: '700' }}>{mode === 'overview' ? 'สรุป' : mode === 'kanban' ? 'บอร์ด' : 'ตาราง'}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'overview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                            <div className="stat-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1.2rem' }}>
                                {[
                                    { label: 'งานรวม', count: filteredTickets.length, color: 'var(--accent-primary)', icon: '📋' },
                                    { label: 'รอดำเนินการ', count: filteredTickets.filter(t => ['Open', 'Accepted'].includes(t.CurrentStatus)).length, color: '#f59e0b', icon: '⏳' },
                                    { label: 'กำลังซ่อม', count: filteredTickets.filter(t => ['On Process', 'Repairing'].includes(t.CurrentStatus)).length, color: '#3b82f6', icon: '🛠️' },
                                    { label: 'รออะไหล่', count: filteredTickets.filter(t => t.CurrentStatus === 'Waiting Parts').length, color: '#ef4444', icon: '📦' },
                                    { label: 'สำเร็จ', count: filteredTickets.filter(t => t.CurrentStatus === 'Completed').length, color: '#10b981', icon: '✅' },
                                    { label: 'งานค้าง 7+ วัน', count: filteredTickets.filter(t => getSLAColor(t) === '#ef4444').length, color: '#ef4444', icon: '🚨' }
                                ].map((card, i) => (
                                    <div key={i} className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>{card.icon}</div>
                                        <div style={{ color: card.color, fontSize: '2.2rem', fontWeight: '900' }}>{card.count}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '800' }}>{card.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                                <div className="glass-panel" style={{ padding: '2rem', borderRadius: '28px' }}>
                                    <h3 style={{ marginBottom: '2rem', fontSize: '1.3rem' }}>📁 ภาระงานและผลงานช่าง (ละเอียด)</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                        {technicians.map(tech => {
                                            const tcks = filteredTickets.filter(t => t.Technician === tech);
                                            const pend = tcks.filter(t => ['Open', 'Accepted'].includes(t.CurrentStatus));
                                            const proc = tcks.filter(t => ['On Process', 'Repairing'].includes(t.CurrentStatus));
                                            const wait = tcks.filter(t => t.CurrentStatus === 'Waiting Parts');
                                            const done = tcks.filter(t => ['Completed', 'Closed'].includes(t.CurrentStatus));
                                            return (
                                                <div key={tech} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                                        <span style={{ fontWeight: '900', color: 'var(--accent-primary)', fontSize: '1.1rem' }}>ช่าง {tech}</span>
                                                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                            <span style={{ background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800' }}>รวม {tcks.length}</span>
                                                            <span style={{ background: '#fef3c7', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', color: '#92400e' }}>รอ {pend.length}</span>
                                                            <span style={{ background: '#dbeafe', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', color: '#1e40af' }}>ทำ {proc.length}</span>
                                                            <span style={{ background: '#fee2e2', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', color: '#991b1b' }}>อะไหล่ {wait.length}</span>
                                                            <span style={{ background: '#dcfce7', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', color: '#166534' }}>เสร็จ {done.length}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="glass-panel" style={{ padding: '2rem', borderRadius: '28px' }}>
                                    <h3 style={{ marginBottom: '2rem', fontSize: '1.3rem' }}>🔍 สรุปประเภทปัญหา</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                                        <div style={{
                                            width: '240px', height: '240px', borderRadius: '50%',
                                            background: sortedSymptoms.length > 0 ? `conic-gradient(${conicGradientString})` : '#f1f5f9',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                                            boxShadow: '0 15px 35px rgba(0,0,0,0.1)'
                                        }}>
                                            <div style={{ width: '160px', height: '160px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '900', color: '#64748b' }}>{filteredTickets.length} เคส</div>
                                        </div>
                                        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            {segments.map(s => (
                                                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                                                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: s.color }}></div>
                                                    <span style={{ fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label} ({Math.round(s.percentage)}%)</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="glass-panel" style={{ gridColumn: 'span 2', padding: '2rem', borderRadius: '28px' }}>
                                    <h3 style={{ marginBottom: '2rem', fontSize: '1.3rem' }}>📊 สรุปเคสที่เหลืออยู่ (ปริมาณงานค้างรายช่าง)</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        {technicians.map(tech => {
                                            const remaining = filteredTickets.filter(t => t.Technician === tech && !['Completed', 'Closed'].includes(t.CurrentStatus)).length;
                                            const maxRem = Math.max(...technicians.map(te => filteredTickets.filter(t => t.Technician === te && !['Completed', 'Closed'].includes(t.CurrentStatus)).length)) || 1;
                                            const width = (remaining / maxRem) * 100;
                                            return (
                                                <div key={tech} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                                    <div style={{ width: '110px', fontWeight: '900', fontSize: '1rem' }}>ช่าง {tech}</div>
                                                    <div style={{ flex: 1, height: '28px', background: '#f1f5f9', borderRadius: '14px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${width}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '15px' }}>
                                                            {remaining > 0 && <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '900' }}>{remaining} เคส</span>}
                                                        </div>
                                                    </div>
                                                    {remaining === 0 && <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '900' }}>สมบูรณ์ ✅</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {viewMode === 'kanban' && (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem', minHeight: '80vh' }}>
                                {statuses.map(status => (
                                    <div key={status} style={{ minWidth: '320px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', padding: '0 0.5rem' }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>{translateStatus(status)}</h3>
                                            <span style={{ background: '#e2e8f0', padding: '0.2rem 0.7rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '700' }}>{filteredTickets.filter(t => t.CurrentStatus === status).length}</span>
                                        </div>
                                        <Droppable droppableId={status}>
                                            {(provided) => (
                                                <div ref={provided.innerRef} {...provided.droppableProps} style={{ flex: 1, background: '#f1f5f9', borderRadius: '22px', padding: '1rem' }}>
                                                    {filteredTickets.filter(t => t.CurrentStatus === status).map((ticket, index) => (
                                                        <Draggable key={ticket.TicketID} draggableId={ticket.TicketID} index={index}>
                                                            {(provided) => (
                                                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} onClick={() => setSelectedTicket(ticket)} className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1rem', background: '#fff', borderLeft: getSLAColor(ticket) !== 'transparent' ? `5px solid ${getSLAColor(ticket)}` : 'none', ...provided.draggableProps.style }}>
                                                                    <div style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--accent-primary)', marginBottom: '0.4rem' }}>#{ticket.TicketID.substring(0, 8).toUpperCase()}</div>
                                                                    <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: '700' }}>{ticket.Symptom}</h4>
                                                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>📍 {ticket.Branch?.BranchName || ticket.BranchID}</div>
                                                                    <div style={{ marginTop: '0.8rem', fontSize: '0.8rem', color: '#64748b' }}>📅 {new Date(ticket.CreatedAt).toLocaleDateString('th-TH')}</div>
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </div>
                                ))}
                            </div>
                        </DragDropContext>
                    )}

                    {viewMode === 'list' && (
                        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderRadius: '24px' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                                    <thead style={{ background: '#f8fafc' }}>
                                        <tr>
                                            <th style={{ padding: '1.5rem', textAlign: 'left', fontSize: '0.9rem' }}>สถานะ</th>
                                            <th style={{ padding: '1.5rem', textAlign: 'left', fontSize: '0.9rem' }}>รายละเอียด/สาขา</th>
                                            <th style={{ padding: '1.5rem', textAlign: 'left', fontSize: '0.9rem' }}>ช่างผู้รับผิดชอบ</th>
                                            <th style={{ padding: '1.5rem', textAlign: 'left', fontSize: '0.9rem' }}>วันที่แจ้ง</th>
                                            <th style={{ padding: '1.5rem', textAlign: 'left', fontSize: '0.9rem' }}>SLA</th>
                                            <th style={{ padding: '1.5rem', textAlign: 'left', fontSize: '0.9rem' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTickets.map(t => {
                                            const slaColor = getSLAColor(t);
                                            return (
                                                <tr key={t.TicketID} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '1.2rem 1.5rem' }}>
                                                        <span className="badge" style={{ background: statusColor(t.CurrentStatus) + '20', color: statusColor(t.CurrentStatus), border: `1px solid ${statusColor(t.CurrentStatus)}50`, fontWeight: '800' }}>{translateStatus(t.CurrentStatus)}</span>
                                                    </td>
                                                    <td style={{ padding: '1.2rem 1.5rem' }}>
                                                        <div style={{ fontWeight: '800', fontSize: '1rem' }}>{t.Symptom}</div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.Branch?.BranchName || t.BranchID}</div>
                                                    </td>
                                                    <td style={{ padding: '1.2rem 1.5rem', fontWeight: '700' }}>{t.Technician || "-"}</td>
                                                    <td style={{ padding: '1.2rem 1.5rem' }}>{new Date(t.CreatedAt).toLocaleDateString('th-TH')}</td>
                                                    <td style={{ padding: '1.2rem 1.5rem' }}>
                                                        {slaColor !== 'transparent' && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: slaColor }}></div>}
                                                    </td>
                                                    <td style={{ padding: '1.2rem 1.5rem' }}><button onClick={() => setSelectedTicket(t)} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>จัดการ</button></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {selectedTicket && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSelectedTicket(null)}>
                    <div style={{ width: '100%', maxWidth: '950px', maxHeight: '95vh', background: '#fff', borderRadius: '35px', display: 'flex', flexWrap: 'wrap', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ flex: '1 1 500px', padding: '2.5rem', overflowY: 'auto', borderRight: '1px solid #f1f5f9', maxHeight: '60vh' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.8rem', fontWeight: '900' }}>{selectedTicket.Symptom}</h2>
                                <button onClick={() => setSelectedTicket(null)} style={{ background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                            <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.5rem' }}>
                                <span className="badge" style={{ background: '#e2e8f0', color: '#1e293b' }}>ID: {selectedTicket.TicketID.toUpperCase()}</span>
                                <span className="badge" style={{ background: statusColor(selectedTicket.CurrentStatus) + '20', color: statusColor(selectedTicket.CurrentStatus) }}>{translateStatus(selectedTicket.CurrentStatus)}</span>
                            </div>
                            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '20px', marginBottom: '1.5rem' }}>
                                <p style={{ fontWeight: '800', marginBottom: '0.5rem' }}>📝 รายละเอียดจากผู้แจ้ง:</p>
                                <p style={{ color: '#475569', lineHeight: '1.6' }}>{selectedTicket.Description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                            </div>
                            {selectedTicket.ImageURL && (
                                <div style={{ borderRadius: '20px', overflow: 'hidden' }}>
                                    <p style={{ fontWeight: '800', marginBottom: '0.8rem' }}>🖼️ รูปภาพหลักฐาน:</p>
                                    <img src={selectedTicket.ImageURL} alt="Evidence" style={{ width: '100%', objectFit: 'cover' }} />
                                </div>
                            )}
                        </div>
                        <div style={{ flex: '1 1 350px', background: '#f8fafc', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: '900', fontSize: '0.9rem' }}>👤 ช่างที่รับผิดชอบ:</label>
                                <select className="input-glass" value={selectedTech} onChange={e => setSelectedTech(e.target.value)} style={{ background: '#fff', fontSize: '1rem', padding: '0.8rem' }}>
                                    <option value="">-- ยังไม่ได้เลือกช่าง --</option>
                                    {technicians.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: '900', fontSize: '0.9rem' }}>📅 วันที่เข้าซ่อม/เสร็จจริง:</label>
                                <input type="date" className="input-glass" value={actualDate} onChange={e => setActualDate(e.target.value)} style={{ background: '#fff', padding: '0.8rem' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: '900', fontSize: '0.9rem' }}>✍️ บันทึกจากช่าง:</label>
                                <textarea className="input-glass" value={techNote} onChange={e => setTechNote(e.target.value)} placeholder="รายละเอียดการซ่อม, ปัญหาที่พบ..." style={{ background: '#fff', height: '120px', padding: '1rem', fontSize: '0.95rem' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: '900', fontSize: '0.9rem' }}>🚦 เปลี่ยนสถานะงาน:</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                                    {statuses.map(s => (
                                        <button key={s} onClick={() => setPendingStatus(s)} style={{ padding: '0.8rem', borderRadius: '12px', border: '2px solid', borderColor: pendingStatus === s ? 'var(--accent-primary)' : 'transparent', background: pendingStatus === s ? 'var(--accent-primary)' : '#fff', color: pendingStatus === s ? '#fff' : '#1e293b', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '800', transition: 'all 0.2s' }}>{translateStatus(s)}</button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleSaveUpdate} disabled={isUpdating} className="btn-primary" style={{ marginTop: '1rem', width: '100%', padding: '1.2rem', fontSize: '1.1rem', fontWeight: '900', borderRadius: '18px' }}>{isUpdating ? 'กำลังบันทึกข้อมูล...' : '💾 อัปเดตข้อมูล'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
