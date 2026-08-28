import { loadPersonas, validarPinServidor } from './bootstrap.js';
import { renderColorPopover } from './color-sistema.js';
import { __set_editMode, __set_session, editMode, session } from './core-data.js';
import { g, populateForms } from './form-helpers.js';
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
/* checkPin ya NO compara el código contra una copia local de personas: lo
   valida contra la Edge Function "validar-pin" (usa service_role del lado
   servidor). Así, el PIN de todo el personal nunca se descarga al navegador
   antes de un login exitoso. */
let pinChecking=false;
export async function checkPin(){
  const code=pinInputs.map(i=>i.value).join('');
  const prev=document.getElementById('pin-preview');
  if(code.length<4){prev.textContent='\u00a0';prev.className='pin-preview';return;}
  if(pinChecking)return;
  pinChecking=true;
  const r=await validarPinServidor(code);
  pinChecking=false;
  if(r.ok){
    const p=r.persona;
    prev.textContent=`${p.nombre} · ${p.rol==='admin'?'Administrador':'Operario'}`;
    prev.className='pin-preview ok';
    await doLogin(p);
  }else if(r.network){
    prev.textContent='No se pudo verificar el código. Revisa tu conexión e intenta de nuevo.';
    prev.className='pin-preview bad';
    pinInputs.forEach(i=>i.classList.add('err'));
    setTimeout(()=>{
      pinInputs.forEach(i=>{i.value='';i.classList.remove('err');});
      prev.textContent=' ';
      prev.className='pin-preview';
      pinInputs[0].focus();
    },450);
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
   siga abierta o se recargue, se le pide el PIN de nuevo por seguridad.
   8 horas = un turno completo: una OT que se empieza en la mañana debe
   poder retomarse aunque pasen varias horas sin usar la app (viaje,
   almuerzo, corte de señal en terreno, etc). */
export const SESION_INACTIVIDAD_MIN=8*60;
export function tocarActividadSesion(){
  if(!session)return;
  try{localStorage.setItem('rolzzo_session_actividad',String(Date.now()));}catch(e){}
}
export async function doLogin(p){
  __set_session({nombre:p.nombre,codigo:p.codigo,rol:p.rol});
  try{
    localStorage.setItem('rolzzo_session',JSON.stringify(session));
    localStorage.setItem('rolzzo_session_actividad',String(Date.now()));
  }catch(e){}
  await loadPersonas();
  populateForms();
  document.getElementById('login-screen').style.display='none';
  document.getElementById('shell').style.display='flex';
  document.getElementById('sb-avatar').textContent=p.nombre.split(' ').map(w=>w[0]).slice(0,2).join('');
  document.getElementById('sb-user-name').textContent=p.nombre;
  document.getElementById('sb-user-role').textContent=p.rol==='admin'?'Administrador':'Operario';
  document.getElementById('topbar-user-name').textContent=p.nombre;
  document.getElementById('topbar-user-role').textContent=p.rol==='admin'?'Administrador':'Operario';
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
export async function tryRestoreSession(){
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
  const r=await validarPinServidor(saved.codigo);
  if(r.ok){
    await doLogin(r.persona);
    return true;
  }
  if(r.network){
    // Sin internet no se puede revalidar el PIN contra el servidor, pero
    // esta sesión ya se validó antes y sigue dentro de la ventana de
    // inactividad permitida: se confía en los datos guardados localmente
    // para no dejar a la persona bloqueada sin poder retomar su OT en
    // terreno. No se borra la sesión guardada: se reintenta la próxima vez
    // que haya señal.
    await doLogin(saved);
    return true;
  }
  // El código genuinamente ya no existe (persona eliminada o código
  // cambiado por un admin): ahí sí se limpia y se pide PIN de nuevo.
  try{
    localStorage.removeItem('rolzzo_session');
    localStorage.removeItem('rolzzo_session_actividad');
  }catch(e){}
  return false;
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
