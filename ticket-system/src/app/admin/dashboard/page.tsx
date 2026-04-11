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

    if (isLoading) return <div style={{ textAlign: 'center', padding: '5rem' }}>กำลังโหลด...</div>;

    const completed = tickets.filter(t => t.CurrentStatus === 'Completed').length;
    const progress = Math.round((completed / (tickets.length || 1)) * 100);

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem' }}>
            <main style={{ maxWidth: '1600px', margin: '0 auto', paddingTop: '4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.2rem' }}>Dashboard</h1>
                        <p style={{ color: '#64748b' }}>Monitor all of your projects and tasks here</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                        <div style={{ background: '#f1f5f9', padding: '0.3rem', borderRadius: '12px', display: 'flex', gap: '0.2rem' }}>
                            {['overview', 'kanban', 'list'].map((m) => (
                                <button key={m} onClick={() => setViewMode(m as any)} style={{ padding: '0.5rem 1.2rem', borderRadius: '10px', border: 'none', cursor: 'pointer', background: viewMode === m ? '#7c3aed' : 'transparent', color: viewMode === m ? '#fff' : '#64748b', fontWeight: '600' }}>
                                    {m === 'overview' ? 'สรุป' : m === 'kanban' ? 'บอร์ด' : 'ตาราง'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {viewMode === 'overview' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>
                        {/* Summary Group 1 */}
                        <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>Total Project</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: '700', margin: '0.5rem 0' }}>{tickets.length}</div>
                                <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '600' }}>↗ 5% Increased from last month</div>
                            </div>
                            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>Running Project</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: '700', margin: '0.5rem 0' }}>{tickets.filter(t => ['Repairing', 'On Process'].includes(t.CurrentStatus)).length}</div>
                                <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '600' }}>↗ 10% Increased from last month</div>
                            </div>
                        </div>

                        {/* Summary Group 2 */}
                        <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>Completed Projects</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: '700', margin: '0.5rem 0' }}>{completed}</div>
                                <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '600' }}>↗ 8% Increased from last month</div>
                            </div>
                            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>Pending projects</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: '700', margin: '0.5rem 0' }}>{tickets.filter(t => t.CurrentStatus === 'Open').length}</div>
                                <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '600' }}>↗ 6% Increased from last month</div>
                            </div>
                        </div>

                        {/* Chart (Placeholder for Project Analytics in style) */}
                        <div style={{ gridColumn: 'span 6', background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '2rem' }}>Project Analytics</h3>
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', paddingBottom: '20px' }}>
                                {[40, 75, 45, 60, 50, 20, 55, 35, 45, 50, 30, 48].map((h, i) => (
                                    <div key={i} style={{ width: '6%', background: i === 1 ? '#c7d2fe' : '#e0e7ff', height: `${h}%`, borderRadius: '4px', position: 'relative' }}>
                                        {i === 1 && <div style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', background: '#ecfdf5', color: '#059669', fontSize: '0.6rem', padding: '2px 5px', borderRadius: '4px', fontWeight: '700' }}>Top</div>}
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.65rem', marginTop: '10px' }}>
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => <span key={m}>{m}</span>)}
                            </div>
                        </div>

                        {/* Team Collaboration */}
                        <div style={{ gridColumn: 'span 6', background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Team Collaboration</h3>
                                <button style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}>+</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                {technicians.slice(0, 5).map((tech, idx) => {
                                    const techTickets = tickets.filter(t => t.Technician === tech);
                                    const procCount = techTickets.filter(t => !['Completed', 'Closed'].includes(t.CurrentStatus)).length;
                                    const status = procCount === 0 ? 'Complete' : 'In progress';
                                    return (
                                        <div key={tech} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: idx % 2 === 0 ? '#fbbf24' : idx % 3 === 0 ? '#f472b6' : '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700' }}>{tech[0]}</div>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>ช่าง {tech}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{tech}@{tech}.com</div>
                                                </div>
                                            </div>
                                            <div style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', background: status === 'Complete' ? '#ecfdf5' : '#fffbeb', color: status === 'Complete' ? '#059669' : '#d97706' }}>{status}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Project Progress (Donut Chart) */}
                        <div style={{ gridColumn: 'span 6', background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', textAlign: 'left' }}>Project Progress</h3>
                                <button style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}>+</button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
                                <div style={{
                                    width: '180px', height: '180px', borderRadius: '50%',
                                    background: `conic-gradient(#7c3aed ${progress}%, #f1f5f9 0)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
                                }}>
                                    <div style={{ width: '130px', height: '130px', background: '#fff', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.05)' }}>
                                        <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a' }}>{progress}%</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Progress</div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#0f172a' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#7c3aed' }}></div> Complete
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#0f172a' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#c7d2fe' }}></div> Project Progress
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#0f172a' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f1f5f9' }}></div> In complete
                                </div>
                            </div>
                        </div>

                        {/* Recent Service Table (Bottom Section like in the screen) */}
                        <div style={{ gridColumn: 'span 12', background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f1f5f9', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>🚀 รายการล่าสุด</h3>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input type="text" placeholder="Search..." style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }} />
                                    <button style={{ padding: '0.5rem 1rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}>Export</button>
                                </div>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>TICKET ID</th>
                                        <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>SYMPTOM</th>
                                        <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>BRANCH</th>
                                        <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>STATUS</th>
                                        <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.slice(0, 10).map(t => (
                                        <tr key={t.TicketID} style={{ borderBottom: '1px solid #f8fafc' }}>
                                            <td style={{ padding: '1rem', fontWeight: '700', fontSize: '0.85rem', color: '#7c3aed' }}>#{t.TicketID.substring(0, 8)}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{t.Symptom}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{t.Branch?.BranchName || t.BranchID}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700', background: statusColor(t.CurrentStatus) + '15', color: statusColor(t.CurrentStatus) }}>{translateStatus(t.CurrentStatus)}</span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <button onClick={() => setSelectedTicket(t)} style={{ padding: '0.4rem 0.7rem', background: '#f1f5f9', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }}>View</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>Ticket ID</th>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>Symptom</th>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>Branch</th>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>Action</th>
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
                                            <button onClick={() => setSelectedTicket(t)} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: '#f1f5f9', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Manage</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {selectedTicket && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSelectedTicket(null)}>
                    <div style={{ width: '100%', maxWidth: '800px', background: '#fff', borderRadius: '24px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Manage Ticket</h2>
                            <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>SYMPTOM</label>
                                <p style={{ fontSize: '1.1rem', fontWeight: '700', marginTop: '0.3rem' }}>{selectedTicket.Symptom}</p>
                                <div style={{ marginTop: '1.5rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>STATUS</label>
                                    <select style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }} value={pendingStatus || ''} onChange={e => setPendingStatus(e.target.value)}>
                                        {statuses.map(s => <option key={s} value={s}>{translateStatus(s)}</option>)}
                                    </select>
                                </div>
                                <div style={{ marginTop: '1.5rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>TECHNICIAN</label>
                                    <select style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }} value={selectedTech} onChange={e => setSelectedTech(e.target.value)}>
                                        <option value="">-- Assign --</option>
                                        {technicians.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>NOTE</label>
                                <textarea style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.5rem', height: '120px' }} value={techNote} onChange={e => setTechNote(e.target.value)} />
                                <button onClick={handleSaveUpdate} disabled={isUpdating} style={{ width: '100%', padding: '1rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', marginTop: '1.5rem', cursor: 'pointer' }}>
                                    {isUpdating ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
