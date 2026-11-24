import {useEffect,useState} from 'react';
import {AuthProvider,useAuth} from './context/AuthContext';
import MarketingLayout from './components/layout/MarketingLayout';
import WorkspaceLayout from './components/layout/WorkspaceLayout';
import AuthPage from './pages/auth/AuthPage';
import DashboardPage from './pages/workspace/DashboardPage';
import ProjectsPage from './pages/workspace/ProjectsPage';
import TasksPage from './pages/workspace/TasksPage';
import ProjectDetailPage from './pages/workspace/ProjectDetailPage';
import GenericPages from './pages/workspace/GenericPages';
import { TimeLogsPage, TimesheetsPage } from './pages/workspace/TimeTrackingPages';
import Modal from './components/common/Modal';
import TaskModal from './components/tasks/TaskModal';
import {api} from './services/api';
function AppInner(){
 const {user,loading,signIn,signUp,signOut}=useAuth();
 const [screen,setScreen]=useState('marketing'),[authMode,setAuthMode]=useState('login'),[page,setPage]=useState('Overview'),[project,setProject]=useState(null),[task,setTask]=useState(null),[taskModal,setTaskModal]=useState(false),[projectModal,setProjectModal]=useState(false),[resourceModal,setResourceModal]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submitAuth(form){setBusy(true);setError('');try{authMode==='signup'?await signUp(form.name,form.email,form.password):await signIn(form.email,form.password);setScreen('workspace');setPage('Overview');}catch(e){setError(e.message);}finally{setBusy(false);}}
 function enterAuth(mode){setAuthMode(mode);setError('');setScreen('auth');}
 function leave(){signOut();setProject(null);setScreen('marketing');}
 async function saveTask(form){if(task)await api(`/tasks/${task._id}`,{method:'PATCH',body:JSON.stringify(form)});else await api('/tasks',{method:'POST',body:JSON.stringify(form)});setTaskModal(false);setTask(null);setPage('Tasks');}
 async function saveProject(form){await api('/projects',{method:'POST',body:JSON.stringify(form)});setProjectModal(false);setPage('Projects');}
 async function saveResource(form){const path=resourceModal==='Issues'?'/issues':resourceModal==='Milestones'?'/milestones':'/time-entries';await api(path,{method:'POST',body:JSON.stringify(form)});setResourceModal('');}
 if(loading)return <div className="loading-screen">Loading TaskFlow Pro…</div>;
 if(!user&&screen==='marketing')return <MarketingLayout onSignIn={()=>enterAuth('login')} onSignUp={()=>enterAuth('signup')}/>;
 if(!user&&screen==='auth')return <AuthPage mode={authMode} onMode={m=>{setAuthMode(m);setError('');}} onSubmit={submitAuth} onBack={()=>setScreen('marketing')} error={error} busy={busy}/>;
 if(!user)return <MarketingLayout onSignIn={()=>enterAuth('login')} onSignUp={()=>enterAuth('signup')}/>;
 const createTask=()=>{setTask(null);setTaskModal(true);};
 let content;
 if(project)content=<ProjectDetailPage project={project} onBack={()=>setProject(null)} onCreateTask={createTask} onEditTask={t=>{setTask(t);setTaskModal(true);}}/>;
 else if(page==='Overview')content=<DashboardPage setPage={setPage} onCreateProject={()=>setProjectModal(true)} onCreateTask={createTask}/>;
 else if(page==='Projects')content=<ProjectsPage onCreate={()=>setProjectModal(true)} onOpen={setProject}/>;
 else if(page==='Tasks')content=<TasksPage onCreate={createTask} onEdit={t=>{setTask(t);setTaskModal(true);}}/>;
 else if(page==='Time logs')content=<TimeLogsPage onCreate={()=>setResourceModal('Time logs')}/>;
 else if(page==='Timesheets')content=<TimesheetsPage/>;
 else if(page==='Approvals')content=<TimesheetsPage approvals/>;
 else content=<GenericPages page={page} onCreate={()=>setResourceModal(page)}/>;
 return <WorkspaceLayout user={user} page={project?project.name:page} setPage={p=>{setProject(null);setPage(p);}} onSignOut={leave} onCreateProject={()=>setProjectModal(true)}>{content}
 {taskModal&&<TaskModal projects={[]} task={task} onClose={()=>{setTaskModal(false);setTask(null);}} onSave={saveTask}/>}
 {projectModal&&<ProjectForm onClose={()=>setProjectModal(false)} onSave={saveProject}/>}
 {resourceModal&&<ResourceForm type={resourceModal} onClose={()=>setResourceModal('')} onSave={saveResource}/>}
 </WorkspaceLayout>;
}
function ProjectForm({onClose,onSave}){const [f,setF]=useState({name:'',code:'',description:'',priority:'Medium',dueDate:'',status:'Active',color:'#6574df'});const ch=e=>setF({...f,[e.target.name]:e.target.value});return <Modal title="Create a project" onClose={onClose}><form className="form-stack" onSubmit={e=>{e.preventDefault();onSave(f);}}><label>Project name<input name="name" value={f.name} onChange={ch} required placeholder="e.g. Website redesign"/></label><label>Project code<input name="code" value={f.code} onChange={ch} placeholder="e.g. WEB-24"/></label><label>Description<textarea name="description" value={f.description} onChange={ch} rows="3"/></label><div className="form-row"><label>Priority<select name="priority" value={f.priority} onChange={ch}>{['Low','Medium','High','Critical'].map(x=><option>{x}</option>)}</select></label><label>Target date<input type="date" name="dueDate" value={f.dueDate} onChange={ch}/></label></div><div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary">Create project</button></div></form></Modal>}
function ResourceForm({type,onClose,onSave}){const [f,setF]=useState({title:'',name:'',description:'',severity:'Medium',status:type==='Issues'?'Open':'Upcoming',hours:1,note:'',project:''});const [projects,setProjects]=useState([]);useEffect(()=>{api('/projects').then(d=>setProjects(d.projects)).catch(()=>{});},[]);const ch=e=>setF({...f,[e.target.name]:e.target.value});return <Modal title={type==='Time logs'?'Log time':`Create ${type==='Issues'?'issue':'milestone'}`} onClose={onClose}><form className="form-stack" onSubmit={e=>{e.preventDefault();const body=type==='Issues'?{...f,title:f.title}:type==='Milestones'?{...f,name:f.name}:{...f,hours:Number(f.hours)};onSave(body);}}>{type!=='Time logs'?<label>{type==='Issues'?'Issue title':'Milestone name'}<input name={type==='Issues'?'title':'name'} value={type==='Issues'?f.title:f.name} onChange={ch} required/></label>:<label>Work note<input name="note" value={f.note} onChange={ch} placeholder="What did you work on?"/></label>}<label>Project<select name="project" value={f.project} onChange={ch} required><option value="">Select project</option>{projects.map(p=><option value={p._id}>{p.name}</option>)}</select></label>{type==='Time logs'?<label>Hours<input name="hours" type="number" min=".1" max="24" step=".1" value={f.hours} onChange={ch}/></label>:<><label>Description<textarea name="description" value={f.description} onChange={ch}/></label><label>{type==='Issues'?'Severity':'Due date'}{type==='Issues'?<select name="severity" value={f.severity} onChange={ch}>{['Low','Medium','High','Critical'].map(x=><option>{x}</option>)}</select>:<input type="date" name="dueDate" value={f.dueDate||''} onChange={ch}/>}</label></>}<div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary">Save</button></div></form></Modal>}
export default function App(){return <AuthProvider><AppInner/></AuthProvider>}
