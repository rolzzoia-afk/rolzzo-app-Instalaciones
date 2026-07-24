import { __set_otContext, currentTab, otContext, personas, registros } from './core-data.js';
import { renderDash } from './dashboard-kpis.js';
import { escapeHtml, evalFotosOT, formatFecha } from './evaluaciones.js';
import { __set_efAcordeonOtAbierta, __set_segResenaOtActiva, renderEvalFotos, renderEvalFotosAcordeon, renderSegResenas } from './evaluaciones-extra.js';
import { g } from './form-helpers.js';
import { iniciarEdicionOT } from './registro-adjuntos.js';

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
  iniciarEdicionOT(otContext.registro);
}
