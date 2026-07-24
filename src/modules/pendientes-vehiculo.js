import { dbUpsertVehiculo } from './bootstrap.js';
import { mantSelected } from './core-data.js';
import { escapeHtml, formatFecha } from './evaluaciones.js';
import { g } from './form-helpers.js';
import { ensureVehData } from './mantenciones-vehiculos.js';
import { currentUserName } from './reportes-unidad.js';

/* ===== Pendientes por patente (botón rojo flotante en Mantenciones)
   Notas libres + fecha límite opcional, compartidas entre todos los
   usuarios (viven en rolzzo_vehiculos.pendientes), cualquiera puede
   eliminarlas manualmente. ===== */
export function renderPendFab(){
  const el=g('pend-fab');
  if(!el)return;
  if(!mantSelected){el.style.display='none';return;}
  const vd=ensureVehData(mantSelected);
  const n=(vd.pendientes||[]).length;
  el.style.display='flex';
  el.innerHTML=`<i class="ti ti-alert-triangle" aria-hidden="true"></i>${n?`<span class="pend-fab-badge">${n}</span>`:''}`;
}
function renderModalPendientesBody(){
  const vd=ensureVehData(mantSelected);
  const items=(vd.pendientes||[]).slice().sort((a,b)=>(a.fechaLimite||'').localeCompare(b.fechaLimite||''));
  g('pend-modal-patente').textContent=mantSelected;
  g('pend-modal-list').innerHTML=items.length?items.map(p=>`
    <div class="doc-row">
      <i class="ti ti-alert-triangle" aria-hidden="true" style="color:#E34948"></i>
      <div class="doc-info">
        <span class="doc-name">${escapeHtml(p.texto)}</span>
        <span class="doc-fecha">${p.fechaLimite?'Vence: '+formatFecha(p.fechaLimite):'Sin fecha límite'} · Agregado por ${escapeHtml(p.creadoPor||'—')}</span>
      </div>
      <button class="btn-del" style="display:inline-flex" title="Eliminar" onclick="eliminarPendienteVehiculo('${p.id}')"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>`).join(''):'<p class="eval-empty">Sin pendientes para esta patente.</p>';
  g('pend-nuevo-texto').value='';
  g('pend-nuevo-fecha').value='';
}
export function abrirModalPendientes(){
  if(!mantSelected)return;
  renderModalPendientesBody();
  g('modal-pendientes').style.display='flex';
}
export function cerrarModalPendientes(){
  g('modal-pendientes').style.display='none';
}
export async function agregarPendienteVehiculo(){
  const texto=(g('pend-nuevo-texto').value||'').trim();
  if(!texto){alert('Escribe el pendiente antes de agregarlo.');return;}
  const fechaLimite=g('pend-nuevo-fecha').value||'';
  const vd=ensureVehData(mantSelected);
  if(!vd.pendientes)vd.pendientes=[];
  const item={id:Date.now()+'_'+Math.random().toString(36).slice(2,6),texto,fechaLimite,creadoPor:currentUserName(),creadoEn:new Date().toISOString()};
  vd.pendientes.push(item);
  const ok=await dbUpsertVehiculo(mantSelected);
  if(!ok){vd.pendientes=vd.pendientes.filter(p=>p.id!==item.id);return;}
  renderModalPendientesBody();
  renderPendFab();
}
export async function eliminarPendienteVehiculo(id){
  if(!confirm('¿Eliminar este pendiente?'))return;
  const vd=ensureVehData(mantSelected);
  const prev=(vd.pendientes||[]).slice();
  vd.pendientes=(vd.pendientes||[]).filter(p=>String(p.id)!==String(id));
  const ok=await dbUpsertVehiculo(mantSelected);
  if(!ok){vd.pendientes=prev;return;}
  renderModalPendientesBody();
  renderPendFab();
}
