import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, FileCheck2, Plus, Send, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { shortDate } from '../../utils/format';

const startOfWeek = (value) => { const d = new Date(value); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d; };
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const weekDays = start => Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d;});

export function TimeLogsPage({ onCreate }) {
  const [week,setWeek]=useState(()=>startOfWeek(new Date()));
  const [entries,setEntries]=useState([]); const [error,setError]=useState(''); const [loading,setLoading]=useState(true);
  const days=useMemo(()=>weekDays(week),[week]);
  async function load(){setLoading(true);setError('');try{const from=isoDay(days[0]),to=isoDay(days[6]);const data=await api(`/time-entries?from=${from}&to=${to}`);setEntries(data.entries||[]);}catch(e){setError(e.message);}finally{setLoading(false);}}
  useEffect(()=>{load();},[week]);
  const total=entries.reduce((s,e)=>s+Number(e.hours||0),0);
  const dayTotal=d=>entries.filter(e=>isoDay(new Date(e.date))===isoDay(d)).reduce((s,e)=>s+Number(e.hours||0),0);
  return <><div className="page-heading"><div><p className="eyebrow">EFFORT TRACKING</p><h1>Time Logs</h1><p className="muted">Review your work week and keep project effort accurate.</p></div><button className="btn btn-primary" onClick={onCreate}><Plus size={16}/> Add Time Log</button></div>
    <section className="panel" style={{padding:20,marginBottom:18}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><div style={{fontWeight:700}}>My Time Logs</div><div className="muted" style={{fontSize:13}}>Weekly view · {shortDate(days[0])} – {shortDate(days[6])}</div></div><div style={{display:'flex',alignItems:'center',gap:8}}><button className="icon-btn" aria-label="Previous week" onClick={()=>setWeek(d=>{const n=new Date(d);n.setDate(n.getDate()-7);return n;})}><ArrowLeft size={17}/></button><button className="btn btn-ghost" onClick={()=>setWeek(startOfWeek(new Date()))}>This week</button><button className="icon-btn" aria-label="Next week" onClick={()=>setWeek(d=>{const n=new Date(d);n.setDate(n.getDate()+7);return n;})}><ArrowRight size={17}/></button></div></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(70px,1fr))',gap:8,marginTop:22}}>{days.map((d,i)=><div key={isoDay(d)} style={{background:'#171b27',border:'1px solid #292f40',borderRadius:10,padding:'12px 8px',textAlign:'center'}}><div className="muted" style={{fontSize:11}}>{d.toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()}</div><div style={{fontSize:18,fontWeight:700,margin:'5px 0'}}>{d.getDate()}</div><div style={{color:'#78a0ff',fontWeight:700,fontSize:13}}>{dayTotal(d).toFixed(1)}h</div></div>)}</div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:18,paddingTop:16,borderTop:'1px solid #292f40'}}><span className="muted">Total logged this week</span><strong style={{fontSize:20}}>{total.toFixed(1)} hours</strong></div>
    </section>
    {error&&<div className="error-banner">{error}</div>}
    <section className="panel table-panel"><div className="panel-head"><div><h2>Time entries</h2><p>{entries.length} entries this week</p></div></div>{loading?<div className="empty-state">Loading time entries…</div>:entries.length?<div style={{overflowX:'auto'}}><table><thead><tr><th>Date</th><th>Project</th><th>Task</th><th>Work note</th><th>Hours</th><th>Type</th></tr></thead><tbody>{entries.map(e=><tr key={e._id}><td>{shortDate(e.date)}</td><td>{e.project?.name||'—'}</td><td>{e.task?.title||'—'}</td><td>{e.note||'—'}</td><td><b>{Number(e.hours).toFixed(1)}h</b></td><td>{e.billable?'Billable':'Non-billable'}</td></tr>)}</tbody></table></div>:<div className="empty-state"><Clock3 size={28}/><b>No time logged for this week</b><p>Add an entry to track work against a project.</p><button className="btn btn-primary" onClick={onCreate}>Log your first entry</button></div>}</section>
  </>;
}

export function TimesheetsPage({ approvals=false }) {
  const [items,setItems]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState({});
  async function load(){try{const d=await api(`/timesheets${approvals?'?status=Submitted':''}`);setItems(d.timesheets||[]);}catch(e){setError(e.message);}}
  useEffect(()=>{load();},[approvals]);
  async function submit(){setBusy(true);setError('');try{await api('/timesheets/submit',{method:'POST',body:JSON.stringify({weekStart:isoDay(startOfWeek(new Date()))})});await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function review(id,decision){setBusy(true);setError('');try{await api(`/timesheets/${id}/review`,{method:'PATCH',body:JSON.stringify({decision,note:note[id]||''})});await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <><div className="page-heading"><div><p className="eyebrow">{approvals?'GOVERNANCE':'EFFORT REVIEW'}</p><h1>{approvals?'My Approvals':'Timesheets'}</h1><p className="muted">{approvals?'Review submitted weekly timesheets and record decisions.':'Submit weekly time logs for manager review and track their status.'}</p></div>{!approvals&&<button className="btn btn-primary" onClick={submit} disabled={busy}><Send size={16}/> Submit this week</button>}</div>{error&&<div className="error-banner">{error}</div>}
    <section className="panel table-panel"><div className="panel-head"><div><h2>{approvals?'Pending review':'Timesheet history'}</h2><p>{items.length} timesheets</p></div></div>{items.length?<div style={{overflowX:'auto'}}><table><thead><tr><th>Team member</th><th>Week</th><th>Total hours</th><th>Status</th><th>Submitted</th>{approvals&&<th>Review</th>}</tr></thead><tbody>{items.map(t=><tr key={t._id}><td><b>{t.user?.name||'Member'}</b><div className="muted" style={{fontSize:12}}>{t.user?.email}</div></td><td>{shortDate(t.weekStart)} – {shortDate(t.weekEnd)}</td><td><b>{Number(t.totalHours).toFixed(1)}h</b></td><td><span className="status-pill">{t.status}</span>{t.reviewNote&&<div className="muted" style={{fontSize:12}}>{t.reviewNote}</div>}</td><td>{shortDate(t.submittedAt)}</td>{approvals&&<td>{t.status==='Submitted'?<div style={{minWidth:190}}><input aria-label="Review note" placeholder="Optional note" value={note[t._id]||''} onChange={e=>setNote(n=>({...n,[t._id]:e.target.value}))}/><div style={{display:'flex',gap:6,marginTop:7}}><button className="btn btn-primary" disabled={busy} onClick={()=>review(t._id,'Approved')}><CheckCircle2 size={14}/> Approve</button><button className="btn btn-ghost" disabled={busy} onClick={()=>review(t._id,'Rejected')}><XCircle size={14}/> Reject</button></div></div>:<span className="muted">Reviewed</span>}</td>}</tr>)}</tbody></table></div>:<div className="empty-state"><FileCheck2 size={28}/><b>{approvals?'No timesheets awaiting approval':'No timesheets submitted yet'}</b><p>{approvals?'Submitted team timesheets will appear here.':'Log your hours, then submit the week for review.'}</p></div>}</section>
  </>;
}
