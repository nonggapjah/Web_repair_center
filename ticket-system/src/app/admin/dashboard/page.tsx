"use client";
import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

// สถานะการซ่อมบำรุง (ภาษาไทยสำหรับการแสดงผล)
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

// ข้อมูลเริ่มต้น (ภาษาไทย)
const initialTickets = [
    { id: "M-1001", product: "ตู้แช่เหล้า (Chiller #04)", branch: "สาขาพรมพงษ์", status: "Open", priority: "High", sla: "Red", desc: "คอมเพรสเซอร์เสียงดังมาก อุณหภูมิพุ่งสูง", time: "10 นาทีที่แล้ว" },
    { id: "M-1002", product: "ฝ้าเพดาน (ทางเข้า)", branch: "สาขาทองหล่อ", status: "Open", priority: "Medium", sla: "Yellow", desc: "แผ่นฝ้าห้อยตัวลงมา เสี่ยงต่อการตกลงมาใส่ลูกค้า", time: "1 ชม. ที่แล้ว" },
    { id: "M-1003", product: "แผงควบคุมไฟฟ้าหลัก", branch: "สาขาพรมพงษ์", status: "On Process", priority: "Low", sla: "Green", desc: "ตรวจสอบประจำเดือนและซ่อมบำรุงตามรอบ", time: "25 นาทีที่แล้ว" },
    { id: "M-1004", product: "ท่อประปาห้องน้ำหญิง", branch: "สาขาหลังสวน", status: "Repairing", priority: "Medium", sla: "Yellow", desc: "ท่อแตกหลังอ่างล้างมือ มีน้ำเจิ่งนอง", time: "2 ชม. ที่แล้ว" },
    { id: "M-1005", product: "เครื่องปรับอากาศ Unit 08", branch: "สาขาพรมพงษ์", status: "Waiting Parts", priority: "High", sla: "Red", desc: "มอเตอร์พัดลมคอยล์เย็นไหม้ กำลังรอสั่งอะไหล่ใหม่", time: "4 ชม. ที่แล้ว" }
];

export default function AdminDashboard() {
    const [tickets, setTickets] = useState(initialTickets);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [selectedTicket, setSelectedTicket] = useState<typeof initialTickets[0] | null>(null);
    const [techNote, setTechNote] = useState('');

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;
        if (source.droppableId === destination.droppableId) return;

        setTickets(prev => prev.map(t => {
            if (t.id === draggableId) {
                return { ...t, status: destination.droppableId };
            }
            return t;
        }));
    };

    const updateTicketStatus = (id: string, newStatus: string) => {
        setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
        setSelectedTicket(null);
        setTechNote('');
        alert(`อัปเดตสถานะตั๋ว ${id} เป็น '${translateStatus(newStatus)}' เรียบร้อยแล้ว`);
    };

    const columns = statuses.map(status => ({
        status,
        items: tickets.filter(t => t.status === status)
    }));

    return (
        <main className="container animate-fade-in" style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>

            {/* Header ส่วนหัว */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ color: 'var(--accent-primary)', fontSize: '2.2rem', marginBottom: '0.2rem' }}>จัดการงานซ่อมบำรุง</h1>
                    <p style={{ color: 'var(--text-muted)' }}>ติดตามและมอบหมายงานให้ทีมช่าง สำหรับทุกสาขาของ วิลล่า มาร์เก็ท</p>
                </div>
                <div className="glass-panel" style={{ padding: '0.4rem', borderRadius: '12px', display: 'flex', gap: '0.2rem' }}>
                    <button
                        onClick={() => setViewMode('kanban')}
                        style={{
                            padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
                            background: viewMode === 'kanban' ? 'var(--accent-primary)' : 'transparent',
                            color: viewMode === 'kanban' ? '#fff' : 'var(--text-secondary)',
                            fontWeight: '600', transition: '0.2s'
                        }}
                    >
                        มุมมองบอร์ด
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        style={{
                            padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
                            background: viewMode === 'list' ? 'var(--accent-primary)' : 'transparent',
                            color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
                            fontWeight: '600', transition: '0.2s'
                        }}
                    >
                        มุมมองตาราง
                    </button>
                </div>
            </div>

            {/* Quick Stats สถิติแบบรวดเร็ว */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {[
                    { label: 'แจ้งซ่อมใหม่', value: tickets.filter(t => t.status === 'Open').length, color: 'var(--accent-secondary)' },
                    { label: 'กำลังซ่อม', value: tickets.filter(t => ['On Process', 'Repairing'].includes(t.status)).length, color: 'var(--accent-primary)' },
                    { label: 'รออะไหล่', value: tickets.filter(t => t.status === 'Waiting Parts').length, color: 'var(--accent-warning)' },
                    { label: 'เกินเวลา (SLA)', value: tickets.filter(t => t.sla === 'Red').length, color: 'var(--accent-danger)' },
                ].map(stat => (
                    <div key={stat.label} className="glass-panel" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${stat.color}` }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>{stat.label}</span>
                        <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {viewMode === 'kanban' ? (
                <DragDropContext onDragEnd={onDragEnd}>
                    <div style={{ display: 'flex', gap: '1.2rem', overflowX: 'auto', paddingBottom: '1rem', minHeight: '70vh' }}>
                        {columns.map(col => (
                            <div key={col.status} style={{ minWidth: '300px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>{translateStatus(col.status)}</h3>
                                    <span style={{ background: 'rgba(30, 58, 138, 0.1)', color: 'var(--accent-primary)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '700' }}>
                                        {col.items.length}
                                    </span>
                                </div>
                                <Droppable droppableId={col.status}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            style={{
                                                flex: 1,
                                                background: snapshot.isDraggingOver ? 'rgba(30, 58, 138, 0.03)' : 'rgba(0,0,0,0.02)',
                                                borderRadius: '16px',
                                                padding: '0.8rem',
                                                border: '1px dashed rgba(30, 58, 138, 0.1)',
                                                transition: '0.2s'
                                            }}
                                        >
                                            {col.items.map((ticket, index) => (
                                                <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            onClick={() => setSelectedTicket(ticket)}
                                                            className="glass-panel"
                                                            style={{
                                                                padding: '1rem',
                                                                marginBottom: '0.8rem',
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                borderLeft: `4px solid ${ticket.sla === 'Red' ? 'var(--accent-danger)' : ticket.sla === 'Yellow' ? 'var(--accent-warning)' : 'var(--accent-success)'}`,
                                                                boxShadow: snapshot.isDragging ? '0 10px 25px rgba(30, 58, 138, 0.15)' : 'var(--shadow-sm)',
                                                                background: '#fff',
                                                                ...provided.draggableProps.style
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-primary)' }}>#{ticket.id}</span>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ticket.time}</span>
                                                            </div>
                                                            <h4 style={{ fontSize: '1rem', marginBottom: '0.3rem', color: 'var(--text-primary)' }}>{ticket.product}</h4>
                                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.8rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                                {ticket.desc}
                                                            </p>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                                                    {ticket.branch}
                                                                </span>
                                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ticket.sla === 'Red' ? 'var(--accent-danger)' : 'var(--accent-success)' }}></div>
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
                <div className="glass-panel" style={{ padding: '0', background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'rgba(30, 58, 138, 0.05)' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>สถานะ</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>รหัสงาน</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>อุปกรณ์</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>สาขา</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>ความเร่งด่วน</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.map(t => (
                                <tr key={t.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <span className={`badge badge-${t.status.toLowerCase().replace(' ', '')}`}>
                                            {translateStatus(t.status)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: '700' }}>{t.id}</td>
                                    <td style={{ padding: '1rem' }}>{t.product}</td>
                                    <td style={{ padding: '1rem' }}>{t.branch}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ color: t.priority === 'High' ? 'var(--accent-danger)' : 'inherit' }}>
                                            {t.priority === 'High' ? 'สูง' : t.priority === 'Medium' ? 'กลาง' : 'ต่ำ'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <button
                                            onClick={() => setSelectedTicket(t)}
                                            className="btn-primary"
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                        >
                                            จัดการงาน
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* แถบด้านข้างสำหรับจัดการงานซ่อม */}
            {selectedTicket && (
                <div style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end'
                }} onClick={() => setSelectedTicket(null)}>
                    <div
                        style={{ width: '500px', background: '#fff', height: '100%', padding: '2rem', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}
                        className="animate-fade-in"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h2 style={{ margin: 0 }}>ดำเนินการงานซ่อม #{selectedTicket.id}</h2>
                            <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold' }}>ชื่ออุปกรณ์ / จุดที่เสีย</label>
                            <p style={{ fontSize: '1.2rem', fontWeight: '600', margin: '0.2rem 0' }}>{selectedTicket.product}</p>
                            <span className="badge" style={{ background: 'rgba(30, 58, 138, 0.05)', marginTop: '0.2rem' }}>{selectedTicket.branch}</span>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold' }}>รายละเอียดจากสาขา</label>
                            <div className="glass-panel" style={{ background: '#f8fafc', padding: '1rem', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                {selectedTicket.desc}
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold' }}>บันทึกจากช่าง (Technician Note)</label>
                            <textarea
                                className="input-glass"
                                style={{ marginTop: '0.5rem', minHeight: '120px', background: '#fff' }}
                                placeholder="ระบุการดำเนินการ เช่น ตรวจเช็คแล้วมอเตอร์เสีย, เปลี่ยนอะไหล่เรียบร้อย..."
                                value={techNote}
                                onChange={e => setTechNote(e.target.value)}
                            />
                        </div>

                        <div style={{ marginTop: 'auto' }}>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>อัปเดตสถานะเป็น:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                                {statuses.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => updateTicketStatus(selectedTicket.id, s)}
                                        className="badge"
                                        style={{
                                            justifyContent: 'center', padding: '1rem', cursor: 'pointer',
                                            background: selectedTicket.status === s ? 'var(--accent-primary)' : 'rgba(30, 58, 138, 0.05)',
                                            color: selectedTicket.status === s ? '#fff' : 'var(--accent-primary)',
                                            border: `1px solid ${selectedTicket.status === s ? 'var(--accent-primary)' : 'rgba(30, 58, 138, 0.1)'}`,
                                            fontWeight: '600'
                                        }}
                                    >
                                        {translateStatus(s)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

