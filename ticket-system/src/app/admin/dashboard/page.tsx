"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getAllTickets, updateTicketStatus } from '@/app/actions/tickets';

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
            setTechNote(lastNote || '');
            setSelectedTech(selectedTicket.Technician || '');
            setActualDate(selectedTicket.ActualDate ? new Date(selectedTicket.ActualDate).toISOString().split('T')[0] : '');
            setPendingStatus(selectedTicket.CurrentStatus);
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
            await fetchTickets();
            setSelectedTicket(null);
            alert('บันทึกสำเร็จ');
        } catch (err) { alert('ผิดพลาด'); } finally { setIsUpdating(false); }
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

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '6rem 2rem 2rem' }}>
            <style jsx global>{`
                .filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
                @media (max-width: 768px) { .filter-grid { grid-template-columns: 1fr; } }
            `}</style>

            <main style={{ maxWidth: '1600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#1e293b' }}>Admin Dashboard</h1>
                        <p style={{ color: '#64748b' }}>ระบบจัดการงานซ่อมบำรุง</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                        <button onClick={handleExport} className="glass-panel" style={{ padding: '0.6rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: '700' }}>📥 Export</button>
                        <div style={{ background: '#e2e8f0', padding: '0.3rem', borderRadius: '12px', display: 'flex', gap: '0.2rem' }}>
                            {['overview', 'kanban', 'list'].map((m: any) => (
                                <button key={m} onClick={() => setViewMode(m)} style={{ padding: '0.5rem 1rem', borderRadius: '10px', border: 'none', background: viewMode === m ? '#1e293b' : 'transparent', color: viewMode === m ? '#fff' : '#475569', fontWeight: '700', cursor: 'pointer' }}>{m === 'overview' ? 'สรุป' : m === 'kanban' ? 'บอร์ด' : 'ตาราง'}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Filters Section */}
                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', background: '#fff', marginBottom: '2.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
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
                            <button onClick={() => { setStartDate(''); setEndDate(''); setFilterStatus(''); setFilterSymptom(''); setFilterBranch(''); setFilterTechnician(''); setSearchQuery(''); }} style={{ background: '#f1f5f9', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', width: '100%' }}>ล้างตัวกรองทั้งหมด</button>
                        </div>
                    </div>
                </div>

                {viewMode === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                            {[
                                { l: 'รวม', c: filteredTickets.length, cl: '#1e293b' },
                                { l: 'รอดำเนินการ', c: filteredTickets.filter(t => ['Open', 'Accepted'].includes(t.CurrentStatus)).length, cl: '#f59e0b' },
                                { l: 'กำลังซ่อม', c: filteredTickets.filter(t => ['Repairing', 'On Process'].includes(t.CurrentStatus)).length, cl: '#3b82f6' },
                                { l: 'รออะไหล่', c: filteredTickets.filter(t => t.CurrentStatus === 'Waiting Parts').length, cl: '#ef4444' },
                                { l: 'เสร็จสิ้น', c: filteredTickets.filter(t => t.CurrentStatus === 'Completed').length, cl: '#10b981' }
                            ].map((s, i) => (
                                <div key={i} className="glass-panel" style={{ padding: '1.2rem', textAlign: 'center', background: '#fff', borderRadius: '20px' }}>
                                    <h4 style={{ fontSize: '2rem', fontWeight: '900', color: s.cl }}>{s.c}</h4>
                                    <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b' }}>{s.l}</p>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', background: '#fff' }}>
                                <h3 style={{ marginBottom: '1.5rem' }}>📊 ภาระงานรายช่าง</h3>
                                {technicians.map(tech => {
                                    const tks = filteredTickets.filter(t => t.Technician === tech);
                                    if (tks.length === 0 && !filterTechnician) return null;
                                    return (
                                        <div key={tech} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <span style={{ fontWeight: '800' }}>ช่าง {tech}</span>
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                <span style={{ background: '#f1f5f9', padding: '0.1rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800' }}>รวม {tks.length}</span>
                                                <span style={{ background: '#dcfce7', padding: '0.1rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800', color: '#166534' }}>เสร็จ {tks.filter(t => ['Completed', 'Closed'].includes(t.CurrentStatus)).length}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <h3 style={{ marginBottom: '1.5rem', width: '100%' }}>🧩 สัดส่วนประเภทปัญหา</h3>
                                <div style={{ width: '200px', height: '200px', borderRadius: '50%', background: filteredTickets.length > 0 ? `conic-gradient(${conicGradient})` : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ width: '120px', height: '120px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#64748b' }}>{filteredTickets.length}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'list' && (
                    <div className="glass-panel" style={{ padding: '0', borderRadius: '24px', background: '#fff', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
                                <thead style={{ background: '#f8fafc' }}>
                                    <tr>
                                        <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900' }}>สถานะ</th>
                                        <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900' }}>อุปกรณ์</th>
                                        <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900' }}>หมวดหมู่</th>
                                        <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900' }}>สาขา</th>
                                        <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900' }}>ช่าง</th>
                                        <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900' }}>วันที่แจ้ง</th>
                                        <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900' }}>วันที่เข้าจริง</th>
                                        <th style={{ padding: '1.2rem' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTickets.map(t => (
                                        <tr key={t.TicketID} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '1rem 1.2rem' }}>
                                                <span className="badge" style={{ background: statusColor(t.CurrentStatus) + '20', color: statusColor(t.CurrentStatus), border: `1px solid ${statusColor(t.CurrentStatus)}` }}>{translateStatus(t.CurrentStatus)}</span>
                                            </td>
                                            <td style={{ padding: '1rem 1.2rem', fontWeight: '800' }}>{t.Product || "-"}</td>
                                            <td style={{ padding: '1rem 1.2rem' }}>{t.Symptom}</td>
                                            <td style={{ padding: '1rem 1.2rem', color: '#475569' }}>{t.Branch?.BranchName || t.BranchID}</td>
                                            <td style={{ padding: '1rem 1.2rem', fontWeight: '700' }}>{t.Technician || "-"}</td>
                                            <td style={{ padding: '1rem 1.2rem' }}>{new Date(t.CreatedAt).toLocaleDateString('th-TH')}</td>
                                            <td style={{ padding: '1rem 1.2rem', fontWeight: '800', color: '#3b82f6' }}>{t.ActualDate ? new Date(t.ActualDate).toLocaleDateString('th-TH') : "-"}</td>
                                            <td style={{ padding: '1rem 1.2rem' }}><button onClick={() => setSelectedTicket(t)} style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>จัดการ</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {viewMode === 'kanban' && (
                    <DragDropContext onDragEnd={() => { }}>
                        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                            {statuses.map(s => (
                                <div key={s} style={{ minWidth: '300px', flex: 1, background: '#f1f5f9', borderRadius: '20px', padding: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <h4 style={{ fontWeight: '900' }}>{translateStatus(s)}</h4>
                                        <span style={{ background: '#fff', padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem' }}>{filteredTickets.filter(t => t.CurrentStatus === s).length}</span>
                                    </div>
                                    <div style={{ minHeight: '500px' }}>
                                        {filteredTickets.filter(t => t.CurrentStatus === s).map(t => (
                                            <div key={t.TicketID} onClick={() => setSelectedTicket(t)} style={{ background: '#fff', padding: '1rem', borderRadius: '15px', marginBottom: '0.8rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: '900', color: '#6366f1' }}>#{t.TicketID.substring(0, 8).toUpperCase()}</div>
                                                <div style={{ fontWeight: '800', margin: '0.2rem 0' }}>{t.Product || 'ไม่ระบุอุปกรณ์'}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{t.Branch?.BranchName || t.BranchID}</div>
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
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }} onClick={() => setSelectedTicket(null)}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '900px', borderRadius: '25px', display: 'flex', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ flex: 1.2, padding: '2rem', overflowY: 'auto', maxHeight: '80vh', borderRight: '1px solid #f1f5f9' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '900' }}>{selectedTicket.Product || 'ไม่ระบุอุปกรณ์'}</h2>
                            <p style={{ color: '#6366f1', fontWeight: '800' }}>หมวดหมู่: {selectedTicket.Symptom}</p>
                            <p style={{ marginTop: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '15px' }}>{selectedTicket.Description || '-'}</p>
                            {selectedTicket.ImageURL && <img src={selectedTicket.ImageURL} style={{ width: '100%', marginTop: '1rem', borderRadius: '15px' }} />}
                        </div>
                        <div style={{ flex: 0.8, background: '#f1f5f9', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <div>
                                <label style={{ fontWeight: '900', fontSize: '0.8rem' }}>ช่างผู้รับผิดชอบ</label>
                                <select value={selectedTech} onChange={e => setSelectedTech(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px' }}>
                                    <option value="">-- เลือกช่าง --</option>
                                    {technicians.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontWeight: '900', fontSize: '0.8rem' }}>วันที่เข้าซ่อมจริง</label>
                                <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px' }} />
                            </div>
                            <div>
                                <label style={{ fontWeight: '900', fontSize: '0.8rem' }}>บันทึกอาการ/การแก้ไข</label>
                                <textarea value={techNote} onChange={e => setTechNote(e.target.value)} style={{ width: '100%', height: '100px', padding: '0.8rem', borderRadius: '10px' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                                {statuses.map(s => <button key={s} onClick={() => setPendingStatus(s)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #6366f1', background: pendingStatus === s ? '#6366f1' : '#fff', color: pendingStatus === s ? '#fff' : '#6366f1', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}>{translateStatus(s)}</button>)}
                            </div>
                            <button onClick={handleSaveUpdate} disabled={isUpdating} style={{ width: '100%', padding: '1rem', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', cursor: 'pointer' }}>{isUpdating ? 'บันทึก...' : '💾 บันทึกการอัปเดต'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
