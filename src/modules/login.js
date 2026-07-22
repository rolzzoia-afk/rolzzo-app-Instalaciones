import { sb } from './bootstrap.js';
import { renderColorPopover } from './color-sistema.js';
import { __set_editMode, __set_session, editMode, personas, session } from './core-data.js';
import { g } from './form-helpers.js';
import { buildNav, firstAccessibleTab, sw } from './nav.js';
import { restoreRegDraft } from './registro-adjuntos.js';

/* ===== LOGIN ===== */
export const pinInputs=[...document.querySelectorAll('.pin-box')];
pinInputs.forEach((inp,idx)=>{
  inp.addEventListener('input',()=>{
    inp.value=inp.value.replace(/[^0-9]/g,'');
    inp.classList.remove('err');
    if(inp.value&&idx<3)pinInputs[idx+1].focus();
    checkPin();
  });
  inp.addEventListener('keydown',e=>{
    if(e.key==='Backspace'&&!inp.value&&idx>0)pinInputs[idx-1].focus();
  });
});
export function checkPin(){
  const code=pinInputs.map(i=>i.value).join('');
  const prev=document.getElementById('pin-preview');
  if(code.length<4){prev.textContent='\u00a0';prev.className='pin-preview';return;}
  const p=personas.find(p=>p.codigo===code);
  if(p){
    prev.textContent=`${p.nombre} · ${p.rol==='admin'?'Administrador':'Operario'}`;
    prev.className='pin-preview ok';
    doLogin(p);
  }else{
    prev.textContent='Código no reconocido, intenta de nuevo';
    prev.className='pin-preview bad';
    pinInputs.forEach(i=>i.classList.add('err'));
    setTimeout(()=>{
      pinInputs.forEach(i=>{i.value='';i.classList.remove('err');});
      prev.textContent='\u00a0';
      prev.className='pin-preview';
      pinInputs[0].focus();
    },450);
  }
}
/* Tiempo máximo de inactividad antes de exigir un nuevo login (en minutos).
   Si la persona no toca la app por más de este tiempo, aunque la pestaña
   siga abierta o se recargue, se le pide el PIN de nuevo por seguridad. */
export const SESION_INACTIVIDAD_MIN=30;
export function tocarActividadSesion(){
  if(!session)return;
  try{localStorage.setItem('rolzzo_session_actividad',String(Date.now()));}catch(e){}
}
export function doLogin(p){
  __set_session({nombre:p.nombre,codigo:p.codigo,rol:p.rol});
  try{
    localStorage.setItem('rolzzo_session',JSON.stringify(session));
    localStorage.setItem('rolzzo_session_actividad',String(Date.now()));
  }catch(e){}
  document.getElementById('login-screen').style.display='none';
  document.getElementById('shell').style.display='flex';
  document.getElementById('sb-avatar').textContent=p.nombre.split(' ').map(w=>w[0]).slice(0,2).join('');
  document.getElementById('sb-user-name').textContent=p.nombre;
  document.getElementById('sb-user-role').textContent=p.rol==='admin'?'Administrador':'Operario';
  document.getElementById('edit-toggle-btn').style.display='flex';
  document.getElementById('color-toggle-btn').style.display='flex';
  renderColorPopover();
  buildNav();
  sw(firstAccessibleTab());
  restoreRegDraft();
}
/* Intenta restaurar una sesión guardada (recarga de página o cierre accidental
   de la pestaña). Si la persona ya no existe en el sistema (fue eliminada),
   o si estuvo inactiva por más de SESION_INACTIVIDAD_MIN minutos, se ignora
   la sesión guardada y se pide iniciar sesión de nuevo. */
export function tryRestoreSession(){
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem('rolzzo_session')||'null');}catch(e){}
  if(!saved||!saved.codigo)return false;
  let ultimaActividad=0;
  try{ultimaActividad=parseInt(localStorage.getItem('rolzzo_session_actividad')||'0')||0;}catch(e){}
  const minutosInactivo=(Date.now()-ultimaActividad)/60000;
  if(!ultimaActividad||minutosInactivo>SESION_INACTIVIDAD_MIN){
    try{
      localStorage.removeItem('rolzzo_session');
      localStorage.removeItem('rolzzo_session_actividad');
    }catch(e){}
    return false;
  }
  const p=personas.find(x=>x.codigo===saved.codigo);
  if(!p){
    try{
      localStorage.removeItem('rolzzo_session');
      localStorage.removeItem('rolzzo_session_actividad');
    }catch(e){}
    return false;
  }
  doLogin(p);
  return true;
}
export function logout(){
  __set_session(null);__set_editMode(false);document.body.classList.remove('edit-on');
  try{
    localStorage.removeItem('rolzzo_session');
    localStorage.removeItem('rolzzo_session_actividad');
  }catch(e){}
  pinInputs.forEach(i=>i.value='');
  document.getElementById('pin-preview').textContent='\u00a0';
  document.getElementById('pin-preview').className='pin-preview';
  document.getElementById('shell').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  pinInputs[0].focus();
}
export function confirmLogout(){
  if(confirm('¿Cerrar sesión? Vas a salir del sistema.')){
    logout();
  }
}
export function toggleEdit(){
  __set_editMode(!editMode);
  document.body.classList.toggle('edit-on',editMode);
  document.getElementById('edit-toggle-btn').classList.toggle('on',editMode);
}
export function toggleColorPopover(e){
  e.stopPropagation();
  const pop=document.getElementById('color-popover');
  const willShow=pop.style.display==='none';
  pop.style.display=willShow?'block':'none';
  if(willShow)renderColorPopover();
}
document.addEventListener('click',e=>{
  const pop=document.getElementById('color-popover');
  const btn=document.getElementById('color-toggle-btn');
  if(pop && pop.style.display!=='none' && !pop.contains(e.target) && e.target!==btn && !btn.contains(e.target)){
    pop.style.display='none';
  }
});
