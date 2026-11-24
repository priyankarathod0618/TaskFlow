import {createContext,useContext,useEffect,useState} from 'react';
import {api,getToken} from '../services/api';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(Boolean(getToken()));
 useEffect(()=>{if(!getToken()){setLoading(false);return;}api('/auth/me').then(d=>setUser(d.user)).catch(()=>localStorage.removeItem('tf_token')).finally(()=>setLoading(false));},[]);
 async function signIn(email,password){const d=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});localStorage.setItem('tf_token',d.token);setUser(d.user);}
 async function signUp(name,email,password){const d=await api('/auth/register',{method:'POST',body:JSON.stringify({name,email,password})});localStorage.setItem('tf_token',d.token);setUser(d.user);}
 function signOut(){localStorage.removeItem('tf_token');setUser(null);}
 return <AuthContext.Provider value={{user,loading,signIn,signUp,signOut}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
