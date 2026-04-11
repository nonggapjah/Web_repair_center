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

    if (isLoading) return <div style={{ textAlign: 'center', padding: '5rem' }}><p>กำลังโหลด...</p></div>;

    const completedCount = tickets.filter(t => t.CurrentStatus === 'Completed').length;
    const progressPercent = Math.round((completedCount / (tickets.length || 1)) * 100);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%', background: '#f8fafc' }}>
            <main style={{ padding: '6rem 2rem 2rem', maxWidth: '1800px', width: '100%', margin: '0 auto', flex: 1 }}>
                <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                        <div>
                            <h1 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.3rem' }}>แดชบอร์ดแอดมิน</h1>
                            <p style={{ color: '#64748b' }}>ติดตามและจัดการงานซ่อมทั้งหมดในระบบ</p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <button onClick={handleExport} style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', background: '#fff', border: '1px solid #e2e8f0', fontWeight: '600', cursor: 'pointer' }}>ส่งออกข้อมูล</button>
                            <div style={{ background: '#f1f5f9', padding: '0.3rem', borderRadius: '12px', display: 'flex', gap: '0.2rem' }}>
                                {[
                                    { id: 'overview', label: 'สรุปผล' },
                                    { id: 'kanban', label: 'บอร์ดงาน' },
                                    { id: 'list', label: 'รายการ' }
                                ].map((mode) => (
                                    <button
                                        key={mode.id}
                                        onClick={() => setViewMode(mode.id as any)}
                                        style={{
                                            padding: '0.5rem 1.2rem', border: 'none', borderRadius: '10px', cursor: 'pointer',
                                            background: viewMode === mode.id ? '#7c3aed' : 'transparent',
                                            color: viewMode === mode.id ? '#fff' : '#64748b',
                                            fontWeight: '600'
                                        }}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {viewMode === 'overview' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>
                            {/* Summary Cards */}
                            <div style={{ gridColumn: 'span 3' }}>
                                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: '#fff', border: '1px solid #f1f5f9' }}>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600' }}>งานทั้งหมด</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0.8rem 0', color: '#0f172a' }}>{tickets.length}</div>
                                    <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '700' }}>↗ รายการทั้งหมด</div>
                                </div>
                            </div>
                            <div style={{ gridColumn: 'span 3' }}>
                                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: '#fff', border: '1px solid #f1f5f9' }}>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600' }}>ซ่อมเสร็จแล้ว</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0.8rem 0', color: '#0f172a' }}>{completedCount}</div>
                                    <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '700' }}>↗ {progressPercent}% ของงานทั้งหมด</div>
                                </div>
                            </div>
                            <div style={{ gridColumn: 'span 3' }}>
                                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: '#fff', border: '1px solid #f1f5f9' }}>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600' }}>กำลังดำเนินการ</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0.8rem 0', color: '#0f172a' }}>{tickets.filter(t => ['Repairing', 'On Process'].includes(t.CurrentStatus)).length}</div>
                                    <div style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: '700' }}>กำลังดำเนินการ</div>
                                </div>
                            </div>
                            <div style={{ gridColumn: 'span 3' }}>
                                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: '#fff', border: '1px solid #f1f5f9' }}>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600' }}>รอดำเนินการ</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0.8rem 0', color: '#0f172a' }}>{tickets.filter(t => t.CurrentStatus === 'Open').length}</div>
                                    <div style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: '700' }}>รอการจัดการ</div>
                                </div>
                            </div>

                            {/* Mid Section */}
                            <div style={{ gridColumn: 'span 7', marginTop: '1.5rem' }}>
                                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: '#fff', border: '1px solid #f1f5f9' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.5rem' }}>ภาระงานช่าง</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                        {technicians.slice(0, 5).map((tech, idx) => {
                                            const techTickets = tickets.filter(t => t.Technician === tech);
                                            const isComplete = techTickets.length > 0 && techTickets.every(t => ['Completed', 'Closed'].includes(t.CurrentStatus));
                                            return (
                                                <div key={tech} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>👤</div>
                                                        <div>
                                                            <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{tech}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{techTickets.length} งานในมือ</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', background: isComplete ? '#ecfdf5' : '#fef3c7', color: isComplete ? '#059669' : '#92400e' }}>
                                                        {isComplete ? 'ว่าง / งานเสร็จ' : 'กำลังดำเนินการ'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div style={{ gridColumn: 'span 5', marginTop: '1.5rem' }}>
                                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: '#fff', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.5rem', textAlign: 'left' }}>ความคืบหน้ารวม</h3>
                                    <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
                                        <div style={{
                                            width: '180px', height: '180px', borderRadius: '50%',
                                            background: `conic-gradient(#7c3aed ${progressPercent}%, #f1f5f9 0)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <div style={{ width: '130px', height: '130px', background: '#fff', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ fontSize: '2.5rem', fontWeight: '800' }}>{progressPercent}%</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>สำเร็จ</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {viewMode === 'kanban' && (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <div style={{ display: 'flex', gap: '1.2rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                                {statuses.map(status => (
                                    <div key={status} style={{ minWidth: '280px', flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <h3 style={{ fontWeight: '700', fontSize: '1rem' }}>{translateStatus(status)}</h3>
                                            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{tickets.filter(t => t.CurrentStatus === status).length}</span>
                                        </div>
                                        <Droppable droppableId={status}>
                                            {(provided) => (
                                                <div ref={provided.innerRef} {...provided.droppableProps} style={{ background: '#f1f5f9', borderRadius: '16px', padding: '0.8rem', minHeight: '500px' }}>
                                                    {tickets.filter(t => t.CurrentStatus === status).map((ticket, index) => (
                                                        <Draggable key={ticket.TicketID} draggableId={ticket.TicketID} index={index}>
                                                            {(provided) => (
                                                                <div
                                                                    ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                                                    onClick={() => setSelectedTicket(ticket)}
                                                                    style={{ padding: '1rem', background: '#fff', borderRadius: '12px', marginBottom: '0.8rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', ...provided.draggableProps.style }}
                                                                >
                                                                    <div style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: '800', marginBottom: '0.3rem' }}>#{ticket.TicketID.substring(0, 8)}</div>
                                                                    <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{ticket.Symptom}</div>
                                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.4rem' }}>{ticket.Branch?.BranchName}</div>
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
                        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>รหัสงาน</th>
                                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>สถานะ</th>
                                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>อาการเสีย</th>
                                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>สาขา</th>
                                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.map(t => (
                                        <tr key={t.TicketID} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '1rem 1.5rem', fontWeight: '700', color: '#7c3aed' }}>#{t.TicketID.substring(0, 8)}</td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <span style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', background: statusColor(t.CurrentStatus) + '15', color: statusColor(t.CurrentStatus) }}>{translateStatus(t.CurrentStatus)}</span>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>{t.Symptom}</td>
                                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>{t.Branch?.BranchName}</td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <button onClick={() => setSelectedTicket(t)} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: '#f1f5f9', border: 'none', fontWeight: '700', cursor: 'pointer' }}>จัดการ</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {selectedTicket && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSelectedTicket(null)}>
                    <div style={{ width: '100%', maxWidth: '800px', background: '#fff', borderRadius: '24px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>จัดการงานซ่อม</h2>
                            <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>อาการเสีย/ปัญหา</label>
                                <p style={{ fontSize: '1.1rem', fontWeight: '700', marginTop: '0.3rem' }}>{selectedTicket.Symptom}</p>

                                <div style={{ marginTop: '1.5rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>ปรับสถานะ</label>
                                    <select style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }} value={pendingStatus || ''} onChange={e => setPendingStatus(e.target.value)}>
                                        {statuses.map(s => <option key={s} value={s}>{translateStatus(s)}</option>)}
                                    </select>
                                </div>

                                <div style={{ marginTop: '1.5rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>ช่างที่รับผิดชอบ</label>
                                    <select style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }} value={selectedTech} onChange={e => setSelectedTech(e.target.value)}>
                                        <option value="">-- เลือกช่าง --</option>
                                        {technicians.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>บันทึกจากช่าง</label>
                                <textarea style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.5rem', height: '120px' }} value={techNote} onChange={e => setTechNote(e.target.value)} placeholder="บันทึกรายละเอียดการซ่อม..." />

                                <button
                                    onClick={handleSaveUpdate} disabled={isUpdating}
                                    style={{ width: '100%', padding: '1rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', marginTop: '1.5rem', cursor: 'pointer' }}
                                >
                                    {isUpdating ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
