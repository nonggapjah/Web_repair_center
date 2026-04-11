"use client";
import React, { useState, useEffect } from 'react';
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

const getSLAColor = (ticket: any) => {
    if (ticket.CurrentStatus === 'Completed' || ticket.CurrentStatus === 'Closed') {
        return '#10b981';
    }
    const lastUpdate = ticket.History && ticket.History.length > 0
        ? new Date(ticket.History[0].Timestamp)
        : new Date(ticket.CreatedAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));
    if (diffDays > 7) return '#ef4444';
    if (diffDays > 3) return '#f59e0b';
    return null;
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

    const fetchTickets = async () => {
        try {
            const data = await getAllTickets();
            setTickets(data);
            if (selectedTicket) {
                const updated = data.find(t => t.TicketID === selectedTicket.TicketID);
                if (updated) setSelectedTicket(updated);
            }
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
        const headers = ["Ticket ID", "Status", "หมวดหมู่", "สาขา", "ช่างที่รับผิดชอบ", "รายละเอียด", "วันที่แจ้ง"];
        const csvRows = [headers.join(",")];
        tickets.forEach(t => {
            const row = [
                t.TicketID.substring(0, 8).toUpperCase(),
                translateStatus(t.CurrentStatus),
                t.Symptom,
                t.Branch?.BranchName || t.BranchID,
                t.Technician || "-",
                (t.Description || "").replace(/,/g, " ").replace(/\n/g, " "),
                new Date(t.CreatedAt).toLocaleString('th-TH')
            ];
            csvRows.push(row.join(","));
        });
        const csvString = "\uFEFF" + csvRows.join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `repair_tickets_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) return <div style={{ textAlign: 'center', padding: '5rem' }}>กำลังโหลด...</div>;

    // Logic for Pie Chart
    const symptomStats = tickets.reduce((acc: any, t) => {
        acc[t.Symptom] = (acc[t.Symptom] || 0) + 1;
        return acc;
    }, {});
    const totalSymptoms = tickets.length || 1;
    const sortedSymptoms = Object.entries(symptomStats).sort((a: any, b: any) => b[1] - a[1]);
    const chartColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899'];

    let currentAngle = 0;
    const segments = sortedSymptoms.map(([label, count]: any, i) => {
        const percentage = (count / totalSymptoms) * 100;
        const angle = (percentage / 100) * 360;
        const startAngle = currentAngle;
        currentAngle += angle;
        return { label, count, percentage, startAngle, angle, color: chartColors[i % chartColors.length] };
    });

    const conicGradientString = segments.map(s => `${s.color} ${s.startAngle}deg ${s.startAngle + s.angle}deg`).join(', ');

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%' }}>
            <main style={{ padding: '6rem 2rem 2rem', maxWidth: '1800px', width: '100%', margin: '0 auto', flex: 1 }}>
                <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', gap: '1rem' }}>
                        <div>
                            <h1 style={{ fontSize: '2.2rem', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>Dashboard</h1>
                            <p style={{ color: 'var(--text-muted)' }}>สรุปภาพรวมและจัดการระบบแจ้งซ่อม</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                            <button onClick={handleExport} style={{ padding: '0.6rem 1rem', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', background: '#fff', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}>📥 Export</button>
                            <div style={{ background: '#e2e8f0', padding: '0.3rem', borderRadius: '12px', display: 'flex', gap: '0.2rem' }}>
                                <button onClick={() => setViewMode('overview')} style={{ padding: '0.5rem 1.2rem', borderRadius: '10px', border: 'none', cursor: 'pointer', background: viewMode === 'overview' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'overview' ? '#fff' : 'var(--text-secondary)', fontWeight: '600' }}>สรุป</button>
                                <button onClick={() => setViewMode('kanban')} style={{ padding: '0.5rem 1.2rem', borderRadius: '10px', border: 'none', cursor: 'pointer', background: viewMode === 'kanban' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'kanban' ? '#fff' : 'var(--text-secondary)', fontWeight: '600' }}>บอร์ด</button>
                                <button onClick={() => setViewMode('list')} style={{ padding: '0.5rem 1.2rem', borderRadius: '10px', border: 'none', cursor: 'pointer', background: viewMode === 'list' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)', fontWeight: '600' }}>ตาราง</button>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'overview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.2rem' }}>
                                {[
                                    { label: 'งานรวม', count: tickets.length, color: 'var(--accent-primary)', icon: '📋' },
                                    { label: 'รอดำเนินการ', count: tickets.filter(t => ['Open', 'Accepted'].includes(t.CurrentStatus)).length, color: '#f59e0b', icon: '⏳' },
                                    { label: 'กำลังซ่อม', count: tickets.filter(t => ['Repairing', 'On Process'].includes(t.CurrentStatus)).length, color: '#3b82f6', icon: '🛠️' },
                                    { label: 'รออะไหล่', count: tickets.filter(t => t.CurrentStatus === 'Waiting Parts').length, color: '#ef4444', icon: '📦' },
                                    { label: 'สำเร็จ', count: tickets.filter(t => t.CurrentStatus === 'Completed').length, color: '#10b981', icon: '✅' }
                                ].map((card, i) => (
                                    <div key={i} className="glass-panel" style={{ padding: '1.2rem', textAlign: 'center', borderRadius: '20px' }}>
                                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{card.icon}</div>
                                        <div style={{ color: card.color, fontSize: '2rem', fontWeight: '800' }}>{card.count}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '600' }}>{card.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
                                    <h3 style={{ marginBottom: '1.5rem' }}>📈 ภาระงานและผลงานช่าง</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                        {technicians.map(tech => {
                                            const techAll = tickets.filter(t => t.Technician === tech);
                                            const pend = techAll.filter(t => ['Open', 'Accepted'].includes(t.CurrentStatus));
                                            const proc = techAll.filter(t => ['On Process', 'Repairing'].includes(t.CurrentStatus));
                                            const wait = techAll.filter(t => t.CurrentStatus === 'Waiting Parts');
                                            const done = techAll.filter(t => ['Completed', 'Closed'].includes(t.CurrentStatus));
                                            return (
                                                <div key={tech} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.8rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: '800', color: 'var(--accent-primary)', fontSize: '1.1rem' }}>ช่าง {tech}</span>
                                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                            <span style={{ background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700' }}>{techAll.length} เคส</span>
                                                            <span style={{ background: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700', color: '#166534' }}>เสร็จ {done.length}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
                                    <h3 style={{ marginBottom: '1.5rem' }}>🔍 สรุปประเภทปัญหา (Pie Chart)</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                                        <div style={{
                                            width: '200px', height: '200px', borderRadius: '50%',
                                            background: sortedSymptoms.length > 0 ? `conic-gradient(${conicGradientString})` : '#f1f5f9',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                                        }}>
                                            <div style={{ width: '130px', height: '130px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: '800', color: '#64748b' }}>รวม {tickets.length}</div>
                                        </div>
                                        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                            {segments.map(s => (
                                                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: s.color }}></div>
                                                    <span style={{ fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label} ({Math.round(s.percentage)}%)</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {viewMode === 'kanban' && (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <div style={{ display: 'flex', gap: '1.2rem', overflowX: 'auto', paddingBottom: '1rem', minHeight: '70vh' }}>
                                {statuses.map(status => (
                                    <div key={status} style={{ minWidth: '280px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h3 style={{ fontSize: '1.1rem' }}>{translateStatus(status)}</h3>
                                            <span style={{ background: '#e2e8f0', padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem' }}>{tickets.filter(t => t.CurrentStatus === status).length}</span>
                                        </div>
                                        <Droppable droppableId={status}>
                                            {(provided) => (
                                                <div ref={provided.innerRef} {...provided.droppableProps} style={{ flex: 1, background: '#f1f5f9', borderRadius: '16px', padding: '0.8rem' }}>
                                                    {tickets.filter(t => t.CurrentStatus === status).map((ticket, index) => (
                                                        <Draggable key={ticket.TicketID} draggableId={ticket.TicketID} index={index}>
                                                            {(provided) => (
                                                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} onClick={() => setSelectedTicket(ticket)} className="glass-panel" style={{ padding: '1rem', marginBottom: '0.8rem', background: '#fff', borderLeft: getSLAColor(ticket) ? `4px solid ${getSLAColor(ticket)}` : 'none', ...provided.draggableProps.style }}>
                                                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '0.3rem' }}>#{ticket.TicketID.substring(0, 8).toUpperCase()}</div>
                                                                    <h4 style={{ fontSize: '1rem', marginBottom: '0.3rem' }}>{ticket.Symptom}</h4>
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{ticket.Branch?.BranchName || ticket.BranchID}</div>
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
                        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderRadius: '20px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#f8fafc' }}>
                                    <tr>
                                        <th style={{ padding: '1.2rem', textAlign: 'left' }}>สถานะ</th>
                                        <th style={{ padding: '1.2rem', textAlign: 'left' }}>รหัส</th>
                                        <th style={{ padding: '1.2rem', textAlign: 'left' }}>หมวดหมู่</th>
                                        <th style={{ padding: '1.2rem', textAlign: 'left' }}>สาขา</th>
                                        <th style={{ padding: '1.2rem', textAlign: 'left' }}>วันที่แจ้ง</th>
                                        <th style={{ padding: '1.2rem', textAlign: 'left' }}>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.map(t => (
                                        <tr key={t.TicketID} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '1.1rem' }}>
                                                <span className="badge" style={{ background: statusColor(t.CurrentStatus) + '20', color: statusColor(t.CurrentStatus), border: `1px solid ${statusColor(t.CurrentStatus)}50` }}>{translateStatus(t.CurrentStatus)}</span>
                                            </td>
                                            <td style={{ padding: '1.1rem', fontWeight: '700' }}>{t.TicketID.substring(0, 8).toUpperCase()}</td>
                                            <td style={{ padding: '1.1rem' }}>{t.Symptom}</td>
                                            <td style={{ padding: '1.1rem' }}>{t.Branch?.BranchName || t.BranchID}</td>
                                            <td style={{ padding: '1.1rem' }}>{new Date(t.CreatedAt).toLocaleDateString('th-TH')}</td>
                                            <td style={{ padding: '1.1rem' }}><button onClick={() => setSelectedTicket(t)} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>จัดการ</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {selectedTicket && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedTicket(null)}>
                    <div style={{ width: '100%', maxWidth: '850px', maxHeight: '95vh', background: '#fff', borderRadius: '30px', display: 'flex', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ flex: 1.2, padding: '2rem', overflowY: 'auto', borderRight: '1px solid #f1f5f9' }}>
                            <h2 style={{ fontSize: '1.6rem', marginBottom: '1rem' }}>{selectedTicket.Symptom}</h2>
                            <p style={{ color: 'var(--text-muted)' }}>ID: {selectedTicket.TicketID.toUpperCase()}</p>
                            <p style={{ marginTop: '1rem' }}><b>รายละเอียด:</b> {selectedTicket.Description || '-'}</p>
                            {selectedTicket.ImageURL && <img src={selectedTicket.ImageURL} alt="Evidence" style={{ width: '100%', borderRadius: '15px', marginTop: '1rem' }} />}
                        </div>
                        <div style={{ flex: 0.8, background: '#f8fafc', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>ช่างที่รับผิดชอบ:</label>
                                <select className="input-glass" value={selectedTech} onChange={e => setSelectedTech(e.target.value)} style={{ background: '#fff' }}>
                                    <option value="">-- ระบุช่าง --</option>
                                    {technicians.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>บันทึก:</label>
                                <textarea className="input-glass" value={techNote} onChange={e => setTechNote(e.target.value)} style={{ background: '#fff', height: '100px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>เปลี่ยนสถานะ:</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                                    {statuses.map(s => <button key={s} onClick={() => setPendingStatus(s)} style={{ padding: '0.6rem', borderRadius: '10px', border: '1px solid var(--accent-primary)', background: pendingStatus === s ? 'var(--accent-primary)' : 'transparent', color: pendingStatus === s ? '#fff' : 'var(--accent-primary)', cursor: 'pointer' }}>{translateStatus(s)}</button>)}
                                </div>
                            </div>
                            <button onClick={handleSaveUpdate} disabled={isUpdating} className="btn-primary" style={{ marginTop: 'auto', width: '100%', padding: '1rem' }}>{isUpdating ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
