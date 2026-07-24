import { adjPendientes, descargarDocumentoVehiculo, limpiarAdjPendientes, renderBarraAdjuntos, subirArchivosACola } from './adjuntos-pendientes.js';
import { dbUpsertVehiculo, sb } from './bootstrap.js';
import { calcEstadoReglaFlota, flotaSelected, reglasFlota, renderEstadoFlota } from './estado-flota.js';
import { escapeHtml, formatFecha, isAdminUser } from './evaluaciones.js';
import { g } from './form-helpers.js';
import { currentUserName } from './reportes-unidad.js';
import { mostrarToastBar } from './registro-adjuntos.js';

/* ===== Modal de detalle admin: trazabilidad completa de una regla de
   mantención — qué se hizo, cuándo, quién, y sus documentos. Un admin puede
   además editarla en el mismo lugar (fecha, km, detalle, comentario) y
   adjuntar/quitar documentos, con el mismo criterio que el detalle de OT en
   Registro (edición en el mismo panel, no un modal aparte). ===== */
export function fmtFechaHora(iso){
  if(!iso)return '—';
  try{return new Date(iso).toLocaleString('es-CL',{dateStyle:'medium',timeStyle:'short'});}catch(e){return iso;}
}
let flotaDetalleReglaId=null;
let flotaDetalleEditMode=false;
export function abrirModalDetalleFlota(reglaId){
  flotaDetalleReglaId=reglaId;
  flotaDetalleEditMode=false;
  renderModalDetalleFlota();
}
function renderModalDetalleFlota(){
  const regla=reglasFlota(flotaSelected).find(r=>r.id===flotaDetalleReglaId);
  if(!regla){cerrarModalDetalleFlota();return;}
  const est=calcEstadoReglaFlota(regla,flotaSelected);
  const docs=regla.documentos||[];
  const admin=isAdminUser();
  const editMode=flotaDetalleEditMode&&admin;
  const docsHTML=docs.length?docs.map(d=>`
    <div class="doc-row">
      <i class="ti ${(d.mimeType||'').startsWith('image/')?'ti-photo':'ti-file-text'}" aria-hidden="true"></i>
      <div class="doc-info">
        <span class="doc-name">${escapeHtml(d.nombreArchivo||'—')}</span>
        <span class="doc-fecha">Adjuntado por ${escapeHtml(d.subidoPor||d.creadoPor||'—')} · ${fmtFechaHora(d.subidoEn)}</span>
      </div>
      <button class="btn-sec btn-sm" onclick="descargarDocumentoVehiculo('${d.id}','${escapeHtml(d.nombreArchivo||'')}')"><i class="ti ti-download" aria-hidden="true"></i></button>
      ${editMode?`<button class="btn-del" style="display:inline-flex" title="Eliminar" onclick="eliminarDocDetalleFlota('${d.id}')"><i class="ti ti-trash" aria-hidden="true"></i></button>`:''}
    </div>`).join(''):'<p class="eval-empty">Sin documentos adjuntos.</p>';
  const body=`
    <p style="font-size:11px;color:var(--text-muted);margin:-.3rem 0 .9rem">Patente: <b style="color:var(--text-primary)">${escapeHtml(flotaSelected)}</b></p>
    <div class="mant-vigente-box ${est.estado}" style="margin-bottom:1rem">
      <i class="ti ${est.estado==='rojo'?'ti-alert-triangle':(est.estado==='amarillo'?'ti-clock':'ti-circle-check')}" aria-hidden="true"></i>
      <span>${escapeHtml(est.vigenteTexto)}</span>
    </div>
    <div class="fg" style="margin-bottom:.9rem">
      <div class="field"><label>Creado por</label><p style="margin:.2rem 0 0;font-size:13px">${escapeHtml(regla.creadoPor||'—')}</p><p style="font-size:11px;color:var(--text-muted);margin:.1rem 0 0">${fmtFechaHora(regla.creadoEn)}</p></div>
      <div class="field"><label>Última edición por</label><p style="margin:.2rem 0 0;font-size:13px">${escapeHtml(regla.editadoPor||regla.creadoPor||'—')}</p><p style="font-size:11px;color:var(--text-muted);margin:.1rem 0 0">${fmtFechaHora(regla.editadoEn||regla.creadoEn)}</p></div>
    </div>
    <div class="fg" style="margin-bottom:.9rem">
      ${editMode?`
      <div class="field"><label>Fecha en que se hizo</label><input type="date" id="fd-edit-fecha" value="${regla.ultimaFecha||''}"></div>
      <div class="field"><label>Kilometraje en que se hizo</label><input type="number" id="fd-edit-km" value="${regla.ultimoKm||''}" placeholder="Ej: 10000"></div>
      `:`
      <div class="field"><label>Fecha en que se hizo</label><p style="margin:.2rem 0 0;font-size:13px">${regla.ultimaFecha?formatFecha(regla.ultimaFecha):'—'}</p></div>
      <div class="field"><label>Kilometraje en que se hizo</label><p style="margin:.2rem 0 0;font-size:13px">${regla.ultimoKm?Number(regla.ultimoKm).toLocaleString('es-CL')+' km':'—'}</p></div>
      `}
    </div>
    <div class="fg" style="margin-bottom:.9rem">
      <div class="field"><label>Intervalo oficial</label><p style="margin:.2rem 0 0;font-size:13px">${regla.modo==='km'?(Number(regla.intervaloKm||0).toLocaleString('es-CL')+' km'):(regla.modo==='tiempo'?((regla.intervaloMeses||0)+' meses'):'Sin intervalo definido')}</p></div>
      <div class="field"><label>Subido por</label><p style="margin:.2rem 0 0;font-size:13px">${escapeHtml(regla.creadoPor||'—')}</p></div>
    </div>
    ${regla.modo==='km'&&est.kmActual!==null&&est.kmActual!==undefined?`<div class="fg" style="margin-bottom:.9rem">
      <div class="field"><label>Kilometraje actual del vehículo</label><p style="margin:.2rem 0 0;font-size:13px">${est.kmActual.toLocaleString('es-CL')} km</p></div>
    </div>`:''}
    ${est.inconsistente?`<p style="font-size:12px;background:rgba(122,31,30,.1);color:#7a1f1e;padding:8px 10px;border-radius:8px;margin-bottom:.9rem"><i class="ti ti-alert-triangle" aria-hidden="true"></i> El kilometraje actual del vehículo es menor al "KM del último cambio" ingresado. Revisa si algún registro de Unidad tiene un kilometraje mal cargado, o si el KM del cambio se ingresó incorrectamente.</p>`:''}
    ${editMode?`
    <div class="field" style="margin-bottom:.7rem"><label>Detalle / taller</label><input type="text" id="fd-edit-detalle" value="${escapeHtml(regla.detalleTaller||'')}" placeholder="Ej: Taller Pérez, repuesto original"></div>
    <div class="field" style="margin-bottom:.9rem"><label>Comentario</label><textarea id="fd-edit-comentario" rows="2" placeholder="Notas adicionales sobre esta mantención">${escapeHtml(regla.comentario||'')}</textarea></div>
    `:`
    ${regla.detalleTaller?`<p style="font-size:12.5px;margin-bottom:.5rem"><b>Detalle / taller:</b> ${escapeHtml(regla.detalleTaller)}</p>`:''}
    ${regla.comentario?`<p style="font-size:12.5px;margin-bottom:.9rem"><b>Comentario:</b> ${escapeHtml(regla.comentario)}</p>`:''}
    `}
    <p class="sec-lbl" style="margin-bottom:.4rem">Documentos adjuntos (${docs.length})</p>
    ${docsHTML}
    ${editMode?`<div style="margin-top:.7rem">${renderBarraAdjuntos('flotadet_'+regla.id)}</div>`:''}
  `;
  let modal=g('modal-flota-detalle');
  if(!modal){
    modal=document.createElement('div');
    modal.id='modal-flota-detalle';
    modal.className='obs-modal-overlay';
    modal.onclick=(e)=>{if(e.target===modal)cerrarModalDetalleFlota();};
    modal.innerHTML=`<div class="obs-modal-box" style="max-width:480px">
      <p class="obs-modal-title"><i class="ti ti-info-circle" aria-hidden="true"></i>Detalle de mantención — <span id="fd-desc"></span></p>
      <div id="fd-body"></div>
      <div class="obs-modal-actions" id="fd-actions" style="margin-top:1rem"></div>
    </div>`;
    document.body.appendChild(modal);
  }
  g('fd-desc').textContent=regla.desc||'—';
  g('fd-body').innerHTML=body;
  g('fd-actions').innerHTML=editMode?
    `<button class="btn-sec" onclick="cancelarEdicionDetalleFlota()">Cancelar</button><button class="btn" onclick="guardarEdicionDetalleFlota()"><i class="ti ti-device-floppy" aria-hidden="true"></i>Guardar cambios</button>`
    :`<button class="btn-sec" onclick="cerrarModalDetalleFlota()">Cerrar</button>${admin?`<button class="btn" onclick="editarDetalleFlota()"><i class="ti ti-pencil" aria-hidden="true"></i>Editar</button>`:''}`;
  modal.style.display='flex';
}
export function cerrarModalDetalleFlota(){
  const modal=g('modal-flota-detalle');
  if(modal)modal.style.display='none';
  if(flotaDetalleEditMode&&flotaDetalleReglaId)limpiarAdjPendientes('flotadet_'+flotaDetalleReglaId);
  flotaDetalleEditMode=false;
}
export function editarDetalleFlota(){
  if(!isAdminUser()){alert('Solo un administrador puede editar esta mantención.');return;}
  flotaDetalleEditMode=true;
  renderModalDetalleFlota();
}
export function cancelarEdicionDetalleFlota(){
  if(flotaDetalleReglaId)limpiarAdjPendientes('flotadet_'+flotaDetalleReglaId);
  flotaDetalleEditMode=false;
  renderModalDetalleFlota();
}
export async function guardarEdicionDetalleFlota(){
  if(!isAdminUser()){alert('Solo un administrador puede editar esta mantención.');return;}
  const regla=reglasFlota(flotaSelected).find(r=>r.id===flotaDetalleReglaId);
  if(!regla)return;
  regla.ultimaFecha=g('fd-edit-fecha').value||'';
  regla.ultimoKm=parseInt(g('fd-edit-km').value)||0;
  regla.detalleTaller=g('fd-edit-detalle').value;
  regla.comentario=g('fd-edit-comentario').value;
  regla.editadoPor=currentUserName();
  regla.editadoEn=new Date().toISOString();
  if(!regla.documentos)regla.documentos=[];
  const colaId='flotadet_'+regla.id;
  const pendientes=adjPendientes[colaId]||[];
  await subirArchivosACola(flotaSelected,pendientes,regla.desc,regla.documentos);
  const ok=await dbUpsertVehiculo(flotaSelected);
  if(!ok){alert('No se pudo guardar. Intenta nuevamente.');return;}
  limpiarAdjPendientes(colaId);
  flotaDetalleEditMode=false;
  mostrarToastBar('Mantención actualizada con éxito');
  renderModalDetalleFlota();
  renderEstadoFlota();
}
export async function eliminarDocDetalleFlota(docId){
  if(!isAdminUser()){alert('Solo un administrador puede eliminar un documento.');return;}
  if(!confirm('¿Eliminar este documento?'))return;
  const regla=reglasFlota(flotaSelected).find(r=>r.id===flotaDetalleReglaId);
  if(!regla)return;
  const doc=(regla.documentos||[]).find(d=>String(d.id)===String(docId));
  const prevDocs=(regla.documentos||[]).slice();
  regla.documentos=(regla.documentos||[]).filter(d=>String(d.id)!==String(docId));
  const ok=await dbUpsertVehiculo(flotaSelected);
  if(!ok){regla.documentos=prevDocs;return;}
  if(doc&&doc.storagePath&&sb)sb.storage.from('vehiculo-documentos').remove([doc.storagePath]).catch(()=>{});
  renderModalDetalleFlota();
  renderEstadoFlota();
}
