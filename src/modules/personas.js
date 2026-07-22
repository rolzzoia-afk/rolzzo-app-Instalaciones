import { saveAll } from './bootstrap.js';
import { __set_personas, personas, session } from './core-data.js';
import { diasRestantes, openPermModal, toggleNuevoPersona } from './evaluaciones.js';
import { g, populateForms } from './form-helpers.js';
import { showToast } from './registro-adjuntos.js';

/* ===== PERSONAS ===== */
export function renderPersonas(){
  const el=g('personas-list');
  const listaOrdenada=personas.slice().sort((a,b)=>{
    if(a.rol!==b.rol)return a.rol==='admin'?-1:1;
    return (a.nombre||'').localeCompare(b.nombre||'');
  });
  el.innerHTML=listaOrdenada.map(p=>{
    const dr=p.esNuevo?diasRestantes(p):null;
    const trialTag=(p.esNuevo&&dr>0)?`<span class="role-badge trial-badge">${dr} días</span>`:'';
    return `
<div class="persona-card">
  <div class="persona-info">
    <span class="persona-code">${p.codigo}</span>
    <span class="persona-name">${p.nombre}${trialTag}</span>
    ${p.rut?`<span style="font-size:11px;color:var(--text-muted)">${p.rut}</span>`:''}
    <span class="role-badge ${p.rol}">${p.rol==='admin'?'Admin':'Operario'}</span>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    <button class="btn-sec btn-sm" onclick="editarPersonaModal('${p.codigo}')"><i class="ti ti-pencil" aria-hidden="true"></i>Editar</button>
    ${p.rol==='operario'?`<button class="btn-sec btn-sm" onclick="openPermModal('${p.codigo}')"><i class="ti ti-adjustments" aria-hidden="true"></i>Permisos<span class="perm-count">${(p.permisos||['regnew','regrep','dash','unireg','unimant','unirep']).length}</span></button>`:''}
    <button class="btn-sec btn-sm" onclick="toggleNuevoPersona('${p.codigo}')">${p.esNuevo?'Quitar "nuevo"':'Marcar "nuevo"'}</button>
    <button class="btn-del" onclick="removePersona('${p.codigo}')" title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button>
  </div>
</div>`;
  }).join('')||'<p style="font-size:12px;color:var(--text-muted)">Sin personas registradas.</p>';
}
export async function addPersona(){
  const nombres=g('np-nombres').value.trim();
  const apellidos=g('np-apellidos').value.trim();
  const nombre=(nombres+' '+apellidos).trim();
  const rut=g('np-rut').value.trim();
  const codigo=g('np-codigo').value.trim();
  const rol=g('np-rol').value;
  const esNuevo=g('np-nuevo').checked;
  const diasStr=g('np-dias').value;
  if(!nombres||!apellidos){alert('Ingresa nombres y apellidos.');return;}
  if(!/^\d{4}$/.test(codigo)){alert('El código debe ser de exactamente 4 dígitos.');return;}
  if(personas.some(p=>p.codigo===codigo)){alert('Ese código ya está en uso.');return;}
  if(esNuevo&&(!diasStr||isNaN(diasStr)||parseInt(diasStr)<=0)){alert('Ingresa los días de prueba (un número mayor a 0).');return;}
  const persona={nombre,rut,codigo,rol,esNuevo,diasPrueba:esNuevo?parseInt(diasStr):null,fechaIngreso:esNuevo?new Date().toISOString().slice(0,10):null};
  personas.push(persona);
  const ok=await saveAll();
  if(!ok){
    __set_personas(personas.filter(p=>p.codigo!==codigo));
    return;
  }
  g('np-nombres').value='';g('np-apellidos').value='';g('np-rut').value='';g('np-codigo').value='';g('np-rol').value='operario';g('np-nuevo').checked=false;g('np-dias').value='';g('np-dias').disabled=true;
  renderPersonas();populateForms();showToast('toast-per');
}
export function removePersona(codigo){
  if(codigo===session.codigo){alert('No puedes eliminar tu propio usuario mientras tienes la sesión abierta.');return;}
  if(!confirm('¿Quitar el acceso de esta persona?'))return;
  __set_personas(personas.filter(p=>p.codigo!==codigo));
  saveAll();renderPersonas();populateForms();
}
export let editPersonaCodigoOriginal=null;
export function editarPersonaModal(codigo){
  const p=personas.find(x=>x.codigo===codigo);if(!p)return;
  editPersonaCodigoOriginal=codigo;
  g('pe-nombre').value=p.nombre||'';
  g('pe-rut').value=p.rut||'';
  g('pe-codigo').value=p.codigo||'';
  g('pe-rol').value=p.rol||'operario';
  g('persona-edit-modal').style.display='flex';
}
export function closePersonaEditModal(){g('persona-edit-modal').style.display='none';editPersonaCodigoOriginal=null;}
export function savePersonaEdit(){
  const p=personas.find(x=>x.codigo===editPersonaCodigoOriginal);if(!p)return;
  const nuevoNombre=g('pe-nombre').value.trim();
  const nuevoRut=g('pe-rut').value.trim();
  const nuevoCodigo=g('pe-codigo').value.trim();
  const nuevoRol=g('pe-rol').value;
  if(!nuevoNombre){alert('El nombre no puede quedar vacío.');return;}
  if(!/^\d{4}$/.test(nuevoCodigo)){alert('El código debe ser de exactamente 4 dígitos.');return;}
  if(nuevoCodigo!==editPersonaCodigoOriginal&&personas.some(x=>x.codigo===nuevoCodigo)){alert('Ese código ya está en uso por otra persona.');return;}
  const eraPropio=session&&session.codigo===editPersonaCodigoOriginal;
  p.nombre=nuevoNombre;
  p.rut=nuevoRut;
  p.codigo=nuevoCodigo;
  p.rol=nuevoRol;
  if(eraPropio){
    session.codigo=nuevoCodigo;
    session.nombre=nuevoNombre;
    session.rol=nuevoRol;
    try{localStorage.setItem('rolzzo_session',JSON.stringify(session));}catch(e){}
  }
  saveAll();
  closePersonaEditModal();
  renderPersonas();
  populateForms();
}
