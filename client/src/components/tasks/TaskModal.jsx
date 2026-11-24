import {useEffect,useState} from 'react';
import {api} from '../../services/api';
import Modal from '../common/Modal';
export default function TaskModal({onClose,onSave,task}){
 const [projects,setProjects]=useState([]),[members,setMembers]=useState([]),[allTasks,setAllTasks]=useState([]);
 const [comment,setComment]=useState(''),[comments,setComments]=useState(task?.comments||[]),[commentError,setCommentError]=useState('');
 const [form,setForm]=useState({title:task?.title||'',description:task?.description||'',project:task?.project?._id||task?.project||'',status:task?.status||'To do',priority:task?.priority||'Medium',dueDate:task?.dueDate?.slice(0,10)||'',startDate:task?.startDate?.slice(0,10)||'',estimateHours:task?.estimateHours||2,assignee:task?.assignee?._id||task?.assignee||'',labels:(task?.labels||[]).join(', '),dependencies:(task?.dependencies||[]).map(x=>x?._id||x)});
 useEffect(()=>{Promise.all([api('/projects'),api('/members'),api('/tasks')]).then(([p,m,t])=>{setProjects(p.projects||[]);setMembers(m.members||[]);setAllTasks((t.tasks||[]).filter(x=>x._id!==task?._id));if(!form.project&&p.projects?.[0])setForm(f=>({...f,project:p.projects[0]._id}));}).catch(()=>{});},[]);
 const change=e=>setForm({...form,[e.target.name]:e.target.value});
 async function submit(e){e.preventDefault();await onSave({...form,estimateHours:Number(form.estimateHours),labels:form.labels.split(',').map(x=>x.trim()).filter(Boolean),dependencies:form.dependencies});}
 async function addComment(e){e.preventDefault();setCommentError('');try{const d=await api(`/tasks/${task._id}/comments`,{method:'POST',body:JSON.stringify({body:comment})});setComments(d.task.comments||[]);setComment('');}catch(e){setCommentError(e.message);}}
 return <Modal title={task?'Update task':'Create a task'} onClose={onClose}><form className="form-stack" onSubmit={submit}>
 <label>Task title<input name="title" value={form.title} onChange={change} required maxLength="200"/></label>
 <label>Project<select name="project" value={form.project} onChange={change} required>{projects.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}</select></label>
 <label>Description<textarea name="description" value={form.description} onChange={change} rows="3"/></label>
 <div className="form-row"><label>Status<select name="status" value={form.status} onChange={change}>{['Backlog','To do','In progress','In review','Done'].map(x=><option key={x}>{x}</option>)}</select></label><label>Priority<select name="priority" value={form.priority} onChange={change}>{['Low','Medium','High','Urgent'].map(x=><option key={x}>{x}</option>)}</select></label></div>
 <div className="form-row"><label>Assignee<select name="assignee" value={form.assignee} onChange={change}><option value="">Unassigned</option>{members.map(m=><option key={m._id||m.user?._id} value={m._id||m.user?._id}>{m.name||m.user?.name} · {m.role}</option>)}</select></label><label>Estimate (hours)<input type="number" min="0" step=".5" name="estimateHours" value={form.estimateHours} onChange={change}/></label></div>
 <div className="form-row"><label>Start date<input type="date" name="startDate" value={form.startDate} onChange={change}/></label><label>Due date<input type="date" name="dueDate" value={form.dueDate} onChange={change}/></label></div>
 <label>Labels (comma separated)<input name="labels" value={form.labels} onChange={change} placeholder="frontend, urgent, design"/></label>
 <label>Dependencies<select multiple name="dependencies" value={form.dependencies} onChange={e=>setForm({...form,dependencies:[...e.target.selectedOptions].map(o=>o.value)})}>{allTasks.filter(t=>(t.project?._id||t.project)===form.project).map(t=><option key={t._id} value={t._id}>{t.title}</option>)}</select><small className="muted">Hold Ctrl (Windows) to select multiple prerequisite tasks.</small></label>
 <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary">{task?'Save changes':'Create task'}</button></div></form>
 {task&&<section className="form-stack" style={{marginTop:20}}><h3>Discussion</h3>{comments.map(c=><div className="panel" key={c._id}><b>{c.author?.name||'Team member'}</b><p>{c.body}</p><small className="muted">{new Date(c.createdAt).toLocaleString()}</small></div>)}<form onSubmit={addComment}><label>Add a comment<textarea value={comment} onChange={e=>setComment(e.target.value)} required maxLength="5000"/></label>{commentError&&<p className="error-banner">{commentError}</p>}<button className="btn btn-secondary">Post comment</button></form></section>}
 </Modal>;
}
