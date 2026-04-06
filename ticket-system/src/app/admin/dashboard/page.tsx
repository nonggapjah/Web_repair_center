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
        return '#10b981'; // Green (จบงาน)
    }

    const lastUpdate = ticket.History && ticket.History.length > 0
        ? new Date(ticket.History[0].Timestamp)
        : new Date(ticket.CreatedAt);

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));

    if (diffDays > 7) return '#ef4444'; // Red (> 7 วัน)
    if (diffDays > 3) return '#f59e0b'; // Yellow (> 3 วัน)
    return null; // No color (<= 3 วัน)
};

export default function AdminDashboard() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [techNote, setTechNote] = useState('');
    const [selectedTech, setSelectedTech] = useState('');
    const [adminActualDate, setAdminActualDate] = useState('');

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
            setSelectedTech(selectedTicket.Technician || '');
            setAdminActualDate(selectedTicket.ActualDate ? new Date(selectedTicket.ActualDate).toISOString().split('T')[0] : '');
        }
    }, [selectedTicket]);

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
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
        setTickets(prev => prev.map(t => {
            if (t.TicketID === draggableId) {
                return { ...t, CurrentStatus: destination.droppableId };
            }
            return t;
        }));

        const updateResult = await updateTicketStatus(draggableId, destination.droppableId);
        if (!updateResult.success) {
            setTickets(oldTickets);
            alert("ไม่สามารถอัปเดตสถานะได้");
        } else {
            fetchTickets();
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        const result = await updateTicketStatus(id, newStatus, techNote, selectedTech, adminActualDate);
        if (result.success) {
            setTechNote('');
            setAdminActualDate('');
            await fetchTickets();
        } else {
            alert("เกิดข้อผิดพลาดในการอัปเดต");
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

    const columns = statuses.map(status => ({
        status,
        items: tickets.filter(t => t.CurrentStatus === status)
    }));

    if (isLoading) return (
        <div style={{ textAlign: 'center', padding: '5rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>กำลังโหลดข้อมูลแอดมิน...</p>
        </div>
    );

    return (
        <>
            <main className="container" style={{ padding: '2rem 1rem', maxWidth: '1600px', margin: '0 auto' }}>
                <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '0.9rem' }}>Logout</button>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="flex-mobile-col">
                        <div>
                            <h1 style={{ color: 'var(--accent-primary)', fontSize: '2.2rem' }}>จัดการงานซ่อมบำรุง (Admin)</h1>
                            <p style={{ color: 'var(--text-muted)' }}>รวมรายการแจ้งซ่อมจากทุกสาขา</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                            <button onClick={handleExport} className="btn-secondary" style={{
                                padding: '0.6rem 1.2rem',
                                border: '1px solid var(--accent-primary)',
                                color: 'var(--accent-primary)',
                                background: 'transparent',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}>
                                <span>📥 Export CSV</span>
                            </button>
                            <div className="glass-panel" style={{ padding: '0.4rem', borderRadius: '12px', display: 'flex', gap: '0.2rem' }}>
                                <button onClick={() => setViewMode('kanban')} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', cursor: 'pointer', background: viewMode === 'kanban' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'kanban' ? '#fff' : 'var(--text-secondary)', fontWeight: '600' }}>บอร์ด</button>
                                <button onClick={() => setViewMode('list')} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', cursor: 'pointer', background: viewMode === 'list' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)', fontWeight: '600' }}>ตาราง</button>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'kanban' ? (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <div className="responsive-table-container" style={{ display: 'flex', gap: '1.2rem', overflowX: 'auto', paddingBottom: '1rem', minHeight: '70vh' }}>
                                {columns.map(col => (
                                    <div key={col.status} style={{ minWidth: '280px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 0.5rem' }}>
                                            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{translateStatus(col.status)}</h3>
                                            <span style={{ background: 'rgba(30,58,138,0.1)', color: 'var(--accent-primary)', padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem' }}>{col.items.length}</span>
                                        </div>
                                        <Droppable droppableId={col.status}>
                                            {(provided, snapshot) => (
                                                <div ref={provided.innerRef} {...provided.droppableProps} style={{ flex: 1, background: snapshot.isDraggingOver ? 'rgba(30,58,138,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: '16px', padding: '0.8rem' }}>
                                                    {col.items.map((ticket, index) => (
                                                        <Draggable key={ticket.TicketID} draggableId={ticket.TicketID} index={index}>
                                                            {(provided, snapshot) => (
                                                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} onClick={() => setSelectedTicket(ticket)} className="glass-panel" style={{
                                                                    padding: '1rem',
                                                                    marginBottom: '0.8rem',
                                                                    background: '#fff',
                                                                    boxShadow: snapshot.isDragging ? '0 10px 25px rgba(0,0,0,0.1)' : 'var(--shadow-sm)',
                                                                    borderLeft: getSLAColor(ticket) ? `4px solid ${getSLAColor(ticket)}` : 'none',
                                                                    ...provided.draggableProps.style
                                                                }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-primary)' }}>#{ticket.TicketID.substring(0, 8).toUpperCase()}</span>
                                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(ticket.CreatedAt).toLocaleDateString('th-TH')}</span>
                                                                    </div>
                                                                    <h4 style={{ fontSize: '1rem', marginBottom: '0.3rem' }}>{ticket.Symptom}</h4>
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                                        {ticket.Branch?.BranchName || ticket.BranchID}
                                                                        {ticket.Technician && <span style={{ marginLeft: '0.5rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>• {ticket.Technician}</span>}
                                                                    </div>
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
                    ) : (
                        <div className="glass-panel responsive-table-container" style={{ padding: '0', overflow: 'hidden' }}>
                            <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(30,58,138,0.05)' }}>
                                        <th style={{ padding: '1.2rem' }}>สถานะ</th>
                                        <th style={{ padding: '1.2rem' }}>รหัส</th>
                                        <th style={{ padding: '1.2rem' }}>หมวดหมู่</th>
                                        <th style={{ padding: '1.2rem' }}>สาขา</th>
                                        <th style={{ padding: '1.2rem' }}>วันที่แจ้ง</th>
                                        <th style={{ padding: '1.2rem' }}>วันที่สาขาขอ</th>
                                        <th style={{ padding: '1.2rem' }}>วันที่ช่างเข้าจริง</th>
                                        <th style={{ padding: '1.2rem' }}>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.map(t => (
                                        <tr key={t.TicketID} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }} className="hover-row">
                                            <td style={{ padding: '1.1rem' }}>
                                                <span className="badge" style={{
                                                    background: getSLAColor(t) || `${statusColor(t.CurrentStatus)}15`,
                                                    color: getSLAColor(t) ? '#fff' : statusColor(t.CurrentStatus),
                                                    border: getSLAColor(t) ? 'none' : `1px solid ${statusColor(t.CurrentStatus)}30`
                                                }}>{translateStatus(t.CurrentStatus)}</span>
                                            </td>
                                            <td style={{ padding: '1.1rem', fontWeight: '700' }}>{t.TicketID.substring(0, 8).toUpperCase()}</td>
                                            <td style={{ padding: '1.1rem' }}>{t.Symptom}</td>
                                            <td style={{ padding: '1.1rem' }}>{t.Branch?.BranchName || t.BranchID}</td>
                                            <td style={{ padding: '1.1rem' }}>{new Date(t.CreatedAt).toLocaleDateString('th-TH')}</td>
                                            <td style={{ padding: '1.1rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                                                {t.RequestDate ? new Date(t.RequestDate).toLocaleDateString('th-TH') : '-'}
                                            </td>
                                            <td style={{ padding: '1.1rem', color: 'var(--accent-success)', fontWeight: 'bold' }}>
                                                {t.ActualDate ? new Date(t.ActualDate).toLocaleDateString('th-TH') : '-'}
                                            </td>
                                            <td style={{ padding: '1.1rem' }}>
                                                <button onClick={() => setSelectedTicket(t)} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>จัดการงาน</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal Pop Up ตรงกลางหน้าจอ (Admin) - ย้ายมานอก main stack */}
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
                        maxWidth: '850px',
                        maxHeight: '90vh',
                        background: '#fff',
                        borderRadius: '30px',
                        padding: '0',
                        display: 'flex',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        overflow: 'hidden'
                    }} onClick={e => e.stopPropagation()}>

                        {/* Detail Left */}
                        <div style={{ flex: 1.2, padding: '2rem', overflowY: 'auto', borderRight: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div>
                                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '0.8rem' }}>ID: {selectedTicket.TicketID.toUpperCase()}</span>
                                    <h2 style={{ fontSize: '1.6rem', margin: '0.3rem 0' }}>{selectedTicket.Symptom}</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>สาขา: {selectedTicket.Branch?.BranchName}</p>
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                        <p style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                                            📅 วันที่สาขาแจ้ง: {selectedTicket.RequestDate ? new Date(selectedTicket.RequestDate).toLocaleDateString('th-TH') : 'ไม่ได้ระบุ'}
                                        </p>
                                        <p style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>
                                            🛠️ วันที่ช่างเข้าจริง: {selectedTicket.ActualDate ? new Date(selectedTicket.ActualDate).toLocaleDateString('th-TH') : 'ยังไม่ระบุ'}
                                        </p>
                                    </div>
                                </div>
                                <span className="badge" style={{ background: statusColor(selectedTicket.CurrentStatus), color: '#fff' }}>{translateStatus(selectedTicket.CurrentStatus)}</span>
                            </div>

                            {selectedTicket.ImageURL && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-muted)' }}>รูปภาพประกอบ:</label>
                                    <img
                                        src={selectedTicket.ImageURL}
                                        alt="Evidence"
                                        style={{ width: '100%', borderRadius: '15px', marginTop: '0.5rem', maxHeight: '300px', objectFit: 'cover', cursor: 'pointer' }}
                                        onClick={() => window.open(selectedTicket.ImageURL, '_blank')}
                                    />
                                </div>
                            )}

                            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1.2rem', borderRadius: '15px', marginBottom: '1.5rem' }}>
                                <label style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-muted)' }}>รายละเอียดปัญหา:</label>
                                <p style={{ marginTop: '0.4rem', fontSize: '0.95rem' }}>{selectedTicket.Description || '-'}</p>
                            </div>

                            <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.8rem' }}>ประวัติการอัปเดต</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                {selectedTicket.History?.map((h: any, i: number) => (
                                    <div key={h.HistoryID} style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === 0 ? 'var(--accent-primary)' : '#e2e8f0' }}></div>
                                            {i < selectedTicket.History.length - 1 && <div style={{ width: '2px', flex: 1, background: '#f1f5f9', margin: '0.3rem 0' }}></div>}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(h.Timestamp).toLocaleString('th-TH')}</div>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{translateStatus(h.Status)}</div>
                                            {h.Note && <div style={{ background: 'rgba(0,0,0,0.02)', padding: '0.6rem', borderRadius: '8px', fontSize: '0.85rem', marginTop: '0.2rem' }}>{h.Note}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Control Right */}
                        <div style={{ flex: 0.8, background: '#f8fafc', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>ดำเนินการ</h3>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>ส่งข้อความถึงสาขา:</label>
                                <textarea className="input-glass" style={{ background: '#fff', height: '100px', fontSize: '0.9rem' }} placeholder="ระบุความบันทึก..." value={techNote} onChange={e => setTechNote(e.target.value)} />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>ช่างที่รับผิดชอบ:</label>
                                <select className="input-glass" style={{ background: '#fff' }} value={selectedTech} onChange={e => setSelectedTech(e.target.value)}>
                                    <option value="">-- ยังไม่ได้ระบุช่าง --</option>
                                    {technicians.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>ระบุวันที่ช่างเข้าจริง:</label>
                                <input
                                    type="date"
                                    className="input-glass"
                                    style={{ background: '#fff' }}
                                    value={adminActualDate}
                                    onChange={e => setAdminActualDate(e.target.value)}
                                />
                            </div>

                            <label style={{ display: 'block', marginBottom: '0.8rem', fontWeight: 'bold', fontSize: '0.8rem' }}>เปลี่ยนสถานะ:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                {statuses.filter(s => s !== 'Closed').map(s => (
                                    <button
                                        key={s}
                                        onClick={() => handleUpdateStatus(selectedTicket.TicketID, s)}
                                        style={{
                                            padding: '0.7rem',
                                            borderRadius: '10px',
                                            border: '1px solid var(--accent-primary)',
                                            background: selectedTicket.CurrentStatus === s ? 'var(--accent-primary)' : '#fff',
                                            color: selectedTicket.CurrentStatus === s ? '#fff' : 'var(--accent-primary)',
                                            fontWeight: 'bold',
                                            fontSize: '0.75rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {translateStatus(s)}
                                    </button>
                                ))}
                            </div>

                            <button onClick={() => setSelectedTicket(null)} style={{ marginTop: 'auto', padding: '1rem', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}>ปิด</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
