import { dbUpsertRegistro } from './bootstrap.js';
import { __set_otContext, currentTab, lists, otContext, personas, registros } from './core-data.js';
import { renderDash } from './dashboard-kpis.js';
import { escapeHtml, evalFotosOT, evaluacionesFotos, formatFecha, isAdminUser, mesFromFecha } from './evaluaciones.js';
import { __set_efAcordeonOtAbierta, __set_segResenaOtActiva, renderEvalFotos, renderEvalFotosAcordeon, renderSegResenas } from './evaluaciones-extra.js';
import { fillSel, g, tecnicosList } from './form-helpers.js';
import { renderRegReportes } from './periodo-helpers.js';

/* ===== BUSCADOR GLOBAL DE OT ===== */
export function buscarOTGlobal(){
  const val=g('ot-global-input').value.trim();
  if(!val){alert('Ingresa un número de OT.');return;}
  const reg=registros.find(r=>(r.ot||'').toLowerCase()===val.toLowerCase());
  if(!reg){alert(`No se encontró la OT "${val}" en los registros.`);return;}
  __set_otContext({ot:reg.ot,registro:reg});
  renderOTContextBar();
  if(currentTab==='seg_fotos'){__set_efAcordeonOtAbierta(String(reg.ot));renderEvalFotosAcordeon();}
  if(currentTab==='seg_resenas'){__set_segResenaOtActiva(String(reg.ot));renderSegResenas();}
  if(currentTab==='dash')renderDash();
  const bar=g('ot-context-bar');
  if(bar&&typeof bar.scrollIntoView==='function')bar.scrollIntoView({behavior:'smooth',block:'start'});
}
export function clearOTContext(){
  __set_otContext(null);
  g('ot-global-input').value='';
  renderOTContextBar();
  if(currentTab==='dash')renderDash();
}
export function renderOTContextBar(){
  const bar=g('ot-context-bar');
  const editBtn=g('ot-global-edit-btn');
  if(!otContext){bar.style.display='none';editBtn.style.display='none';return;}
  editBtn.style.display='flex';
  const r=otContext.registro;
  const tecs=[r.tec1,r.tec2,r.tec3,r.tec4].filter(Boolean).join(', ')||'—';
  const direccion=[r.calle,r.numero].filter(Boolean).join(' ')||'—';
  const comunaRegion=[r.comuna,r.region].filter(Boolean).join(', ');
  const metaEstado=evalFotosOT[r.ot];
  const estado=(metaEstado&&metaEstado.googleReview)?{label:'Reseña obtenida',cls:'b-ok'}:{label:'En seguimiento',cls:'badge-pendiente'};
  bar.style.display='block';
  bar.innerHTML=`
  <div class="ot-hero">
    <div class="ot-hero-head">
      <span class="ot-hero-ot"><i class="ti ti-clipboard-list" aria-hidden="true"></i>OT ${escapeHtml(String(r.ot))}</span>
      <span class="badge ${estado.cls}">${estado.label}</span>
      <button class="ot-context-close" onclick="clearOTContext()" title="Quitar filtro OT"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>
    <div class="ot-hero-grid">
      <div class="ot-hero-cell"><label><i class="ti ti-user" aria-hidden="true"></i>Cliente</label><span>${escapeHtml(r.cliente||'—')}</span></div>
      <div class="ot-hero-cell"><label><i class="ti ti-phone" aria-hidden="true"></i>Teléfono</label><span>${escapeHtml(r.telefono||'No registrado')}</span></div>
      <div class="ot-hero-cell"><label><i class="ti ti-map-pin" aria-hidden="true"></i>Dirección / Comuna</label><span>${escapeHtml(direccion)}${comunaRegion?' · '+escapeHtml(comunaRegion):''}</span></div>
      <div class="ot-hero-cell"><label><i class="ti ti-tool" aria-hidden="true"></i>Tipo de trabajo</label><span>${escapeHtml(r.tipo||'—')}</span></div>
      <div class="ot-hero-cell"><label><i class="ti ti-users" aria-hidden="true"></i>Técnico asignado</label><span>${escapeHtml(tecs)}</span></div>
      <div class="ot-hero-cell"><label><i class="ti ti-calendar-week" aria-hidden="true"></i>Fecha</label><span>${r.fecha?formatFecha(r.fecha):'—'}</span></div>
    </div>
  </div>`;
}
export function pedirClaveEditarOT(){
  if(!otContext)return;
  const pin=prompt('¿Está seguro que quiere editar esta OT?\n\nIngrese la clave de administrador (4 dígitos) para continuar:');
  if(pin===null)return;
  const admin=personas.find(p=>p.rol==='admin'&&p.codigo===pin);
  if(!admin){alert('Clave incorrecta o no corresponde a un administrador.');return;}
  abrirEditarOTModal();
}
export function abrirEditarOTModal(){
  if(!isAdminUser()){
    alert('Solo un administrador puede editar una OT ya registrada.');
    return;
  }
  const r=otContext.registro;
  g('eot-ot').value=r.ot||'';
  g('eot-cliente').value=r.cliente||'';
  g('eot-fecha').value=r.fecha||'';
  fillSel('eot-tec1',tecnicosList(),'');g('eot-tec1').value=r.tec1||'';
  fillSel('eot-tec2',tecnicosList(),'— Ninguno —');g('eot-tec2').value=r.tec2||'';
  fillSel('eot-tcortina',lists.tiposCortina,'');g('eot-tcortina').value=r.tipoCortina||'';
  g('eot-cantidad').value=r.cantidad||'';
  g('eot-comentario').value=r.comentario||'';
  g('editot-modal').style.display='flex';
}
export function closeEditOTModal(){g('editot-modal').style.display='none';}
export async function saveEditOT(){
  const r=otContext.registro;
  const nuevaOT=g('eot-ot').value.trim();
  const otAnterior=r.ot;
  if(!nuevaOT){alert('El N° de OT no puede quedar vacío.');return;}
  if(nuevaOT!==otAnterior&&registros.some(x=>x.ot===nuevaOT&&x!==r)){
    alert('Ya existe otra visita registrada con ese N° de OT. Elige un número distinto.');
    return;
  }
  const prevSnapshot={...r};
  r.ot=nuevaOT;
  r.cliente=g('eot-cliente').value;
  r.fecha=g('eot-fecha').value;
  r.mes=mesFromFecha(r.fecha);
  r.tec1=g('eot-tec1').value;
  r.tec2=g('eot-tec2').value;
  r.tipoCortina=g('eot-tcortina').value;
  r.cantidad=parseInt(g('eot-cantidad').value)||0;
  r.comentario=g('eot-comentario').value;
  if(nuevaOT!==otAnterior){
    /* Propaga el cambio de N° de OT a todas las estructuras relacionadas
       (evaluaciones/fotos por OT) para que nada quede huérfano bajo el número antiguo. */
    evaluacionesFotos.forEach(e=>{if(e.ot===otAnterior)e.ot=nuevaOT;});
    if(evalFotosOT[otAnterior]){
      evalFotosOT[nuevaOT]=evalFotosOT[otAnterior];
      delete evalFotosOT[otAnterior];
    }
    if(otContext)otContext.ot=nuevaOT;
  }
  const ok=await dbUpsertRegistro(r);
  if(!ok){
    Object.assign(r,prevSnapshot);
    if(nuevaOT!==otAnterior){
      evaluacionesFotos.forEach(e=>{if(e.ot===nuevaOT)e.ot=otAnterior;});
      if(evalFotosOT[nuevaOT]){
        evalFotosOT[otAnterior]=evalFotosOT[nuevaOT];
        delete evalFotosOT[nuevaOT];
      }
      if(otContext)otContext.ot=otAnterior;
    }
    return;
  }
  closeEditOTModal();
  renderOTContextBar();
  if(currentTab==='dash')renderDash();
  if(currentTab==='regrep')renderRegReportes();
  if(currentTab==='seg_fotos')renderEvalFotos();
  if(currentTab==='seg_resenas')renderSegResenas();
  alert('OT actualizada correctamente.');
}
