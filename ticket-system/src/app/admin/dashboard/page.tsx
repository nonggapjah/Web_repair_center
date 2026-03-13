"use client";
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getAllTickets, updateTicketStatus } from '@/app/actions/tickets';

// สถานะการซ่อมบำรุง
const statuses = ["Open", "On Process", "Repairing", "Waiting Parts", "Completed", "Closed"];

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

export default function AdminDashboard() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [techNote, setTechNote] = useState('');

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

    const onDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;
        if (source.droppableId === destination.droppableId) return;

        // Optimistic Update
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
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        const result = await updateTicketStatus(id, newStatus, techNote);
        if (result.success) {
            setSelectedTicket(null);
            setTechNote('');
            fetchTickets();
        } else {
            alert("เกิดข้อผิดพลาดในการอัปเดต");
        }
    };

    const columns = statuses.map(status => ({
        status,
        items: tickets.filter(t => t.CurrentStatus === status)
    }));

    if (isLoading) return (
        <div style={{ textAlign: 'center', padding: '5rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>กำลังโหลดข้อมูลทั้งหมด (Admin Mode)...</p>
        </div>
    );

    return (
        <main className="container animate-fade-in" style={{ padding: '2rem 1rem', maxWidth: '1600px', margin: '0 auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="flex-mobile-col">
                <div>
                    <h1 style={{ color: 'var(--accent-primary)', fontSize: '2.2rem', marginBottom: '0.2rem' }}>จัดการงานซ่อมบำรุง (Admin)</h1>
                    <p style={{ color: 'var(--text-muted)' }}>แอดมินสามารถดูและจัดการรายการแจ้งซ่อมได้จากทุกสาขา</p>
                </div>
                <div className="glass-panel" style={{ padding: '0.4rem', borderRadius: '12px', display: 'flex', gap: '0.2rem' }}>
                    <button onClick={() => setViewMode('kanban')} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', cursor: 'pointer', background: viewMode === 'kanban' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'kanban' ? '#fff' : 'var(--text-secondary)', fontWeight: '600' }}>มุมมองบอร์ด</button>
                    <button onClick={() => setViewMode('list')} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', cursor: 'pointer', background: viewMode === 'list' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)', fontWeight: '600' }}>มุมมองตาราง</button>
                </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {[
                    { label: 'แจ้งซ่อมใหม่', value: tickets.filter(t => t.CurrentStatus === 'Open').length, color: 'var(--accent-secondary)' },
                    { label: 'กำลังซ่อม', value: tickets.filter(t => ['On Process', 'Repairing'].includes(t.CurrentStatus)).length, color: 'var(--accent-primary)' },
                    { label: 'รออะไหล่', value: tickets.filter(t => t.CurrentStatus === 'Waiting Parts').length, color: 'var(--accent-warning)' },
                    { label: 'รวมทั้งหมด', value: tickets.length, color: 'var(--text-muted)' },
                ].map(stat => (
                    <div key={stat.label} className="glass-panel" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${stat.color}` }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>{stat.label}</span>
                        <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {viewMode === 'kanban' ? (
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="responsive-table-container" style={{ display: 'flex', gap: '1.2rem', overflowX: 'auto', paddingBottom: '1rem', minHeight: '70vh' }}>
                        {columns.map(col => (
                            <div key={col.status} style={{ minWidth: '280px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>{translateStatus(col.status)}</h3>
                                    <span style={{ background: 'rgba(30, 58, 138, 0.1)', color: 'var(--accent-primary)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '700' }}>
                                        {col.items.length}
                                    </span>
                                </div>
                                <Droppable droppableId={col.status}>
                                    {(provided, snapshot) => (
                                        <div ref={provided.innerRef} {...provided.droppableProps} style={{ flex: 1, background: snapshot.isDraggingOver ? 'rgba(30, 58, 138, 0.03)' : 'rgba(0,0,0,0.02)', borderRadius: '16px', padding: '0.8rem', border: '1px dashed rgba(30, 58, 138, 0.1)' }}>
                                            {col.items.map((ticket, index) => (
                                                <Draggable key={ticket.TicketID} draggableId={ticket.TicketID} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} onClick={() => setSelectedTicket(ticket)} className="glass-panel" style={{ padding: '1rem', marginBottom: '0.8rem', background: '#fff', boxShadow: snapshot.isDragging ? '0 10px 25px rgba(0,0,0,0.1)' : 'var(--shadow-sm)', ...provided.draggableProps.style }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-primary)' }}>#{ticket.TicketID.substring(0, 8).toUpperCase()}</span>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(ticket.CreatedAt).toLocaleDateString('th-TH')}</span>
                                                            </div>
                                                            <h4 style={{ fontSize: '1rem', marginBottom: '0.3rem' }}>{ticket.Product}</h4>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(30, 58, 138, 0.05)', borderRadius: '4px' }}>
                                                                    {ticket.Branch?.BranchName || ticket.BranchID}
                                                                </span>
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
                <div className="glass-panel responsive-table-container" style={{ padding: '0', background: '#fff' }}>
                    <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'rgba(30, 58, 138, 0.05)' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>สถานะ</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>รหัสงาน</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>อุปกรณ์</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>สาขา</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.map(t => (
                                <tr key={t.TicketID} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <span className={`badge`}>{translateStatus(t.CurrentStatus)}</span>
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: '700' }}>{t.TicketID.substring(0, 8).toUpperCase()}</td>
                                    <td style={{ padding: '1rem' }}>{t.Product}</td>
                                    <td style={{ padding: '1rem' }}>{t.Branch?.BranchName || t.BranchID}</td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <button onClick={() => setSelectedTicket(t)} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>จัดการงาน</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Sidebar Drawer */}
            {selectedTicket && (
                <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelectedTicket(null)}>
                    <div style={{ width: 'min(500px, 100%)', background: '#fff', height: '100%', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()} className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h2 style={{ margin: 0 }}>ดำเนินการงาน #{selectedTicket.TicketID.substring(0, 8).toUpperCase()}</h2>
                            <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold' }}>อุปกรณ์ / สาขา</label>
                            <p style={{ fontSize: '1.2rem', fontWeight: '600', margin: '0.2rem 0' }}>{selectedTicket.Product}</p>
                            <span className="badge">{selectedTicket.Branch?.BranchName || selectedTicket.BranchID}</span>
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold' }}>บันทึกจากช่าง</label>
                            <textarea className="input-glass" style={{ marginTop: '0.5rem', minHeight: '120px', background: '#fff' }} placeholder="ระบุการดำเนินการ..." value={techNote} onChange={e => setTechNote(e.target.value)} />
                        </div>
                        <div style={{ marginTop: 'auto' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>อัปเดตสถานะ:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                                {statuses.map(s => (
                                    <button key={s} onClick={() => handleUpdateStatus(selectedTicket.TicketID, s)} className="badge" style={{ justifyContent: 'center', padding: '1rem', cursor: 'pointer', background: selectedTicket.CurrentStatus === s ? 'var(--accent-primary)' : 'rgba(30, 58, 138, 0.05)', color: selectedTicket.CurrentStatus === s ? '#fff' : 'var(--accent-primary)', border: '1px solid rgba(0,0,0,0.1)' }}>{translateStatus(s)}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
