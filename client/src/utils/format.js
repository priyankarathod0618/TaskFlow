export const initials=name=>(name||'U').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
export const shortDate=value=>value?new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'No date';
export const percent=(a,b)=>b?Math.round(a/b*100):0;
