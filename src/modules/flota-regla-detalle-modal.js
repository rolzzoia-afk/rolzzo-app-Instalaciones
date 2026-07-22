import { descargarDocumentoVehiculo } from './adjuntos-pendientes.js';
import { calcEstadoReglaFlota, flotaSelected, reglasFlota } from './estado-flota.js';
import { escapeHtml, formatFecha } from './evaluaciones.js';
import { g } from './form-helpers.js';

/* ===== Modal de detalle admin: trazabilidad completa de una regla de    mantención — qu ===== */
export function fmtFechaHora(iso){
  if(!iso)return '—';
  try{return new Date(iso).toLocaleString('es-CL',{dateStyle:'medium',timeStyle:'short'});}catch(e){return iso;}
}
export function abrirModalDetalleFlota(reglaId){
  const regla=reglasFlota(flotaSelected).find(r=>r.id===reglaId);
  if(!regla)return;
  const est=calcEstadoReglaFlota(regla,flotaSelected);
  const docs=regla.documentos||[];
  const docsHTML=docs.length?docs.map(d=>`
    <div class="doc-row">
      <i class="ti ${(d.mimeType||'').startsWith('image/')?'ti-photo':'ti-file-text'}" aria-hidden="true"></i>
      <div class="doc-info">
        <span class="doc-name">${escapeHtml(d.nombreArchivo||'—')}</span>
        <span class="doc-fecha">Adjuntado por ${escapeHtml(d.subidoPor||d.creadoPor||'—')} · ${fmtFechaHora(d.subidoEn)}</span>
      </div>
      <button class="btn-sec btn-sm" onclick="descargarDocumentoVehiculo('${d.id}','${escapeHtml(d.nombreArchivo||'')}')"><i class="ti ti-download" aria-hidden="true"></i></button>
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
      <div class="field"><label>Fecha en que se hizo</label><p style="margin:.2rem 0 0;font-size:13px">${regla.ultimaFecha?formatFecha(regla.ultimaFecha):'—'}</p></div>
      <div class="field"><label>Kilometraje en que se hizo</label><p style="margin:.2rem 0 0;font-size:13px">${regla.ultimoKm?Number(regla.ultimoKm).toLocaleString('es-CL')+' km':'—'}</p></div>
    </div>
    <div class="fg" style="margin-bottom:.9rem">
      <div class="field"><label>Intervalo oficial</label><p style="margin:.2rem 0 0;font-size:13px">${regla.modo==='km'?(Number(regla.intervaloKm||0).toLocaleString('es-CL')+' km'):(regla.modo==='tiempo'?((regla.intervaloMeses||0)+' meses'):'Sin intervalo definido')}</p></div>
      <div class="field"><label>Subido por</label><p style="margin:.2rem 0 0;font-size:13px">${escapeHtml(regla.creadoPor||'—')}</p></div>
    </div>
    ${regla.modo==='km'&&est.kmActual!==null&&est.kmActual!==undefined?`<div class="fg" style="margin-bottom:.9rem">
      <div class="field"><label>Kilometraje actual del vehículo</label><p style="margin:.2rem 0 0;font-size:13px">${est.kmActual.toLocaleString('es-CL')} km</p></div>
    </div>`:''}
    ${est.inconsistente?`<p style="font-size:12px;background:rgba(122,31,30,.1);color:#7a1f1e;padding:8px 10px;border-radius:8px;margin-bottom:.9rem"><i class="ti ti-alert-triangle" aria-hidden="true"></i> El kilometraje actual del vehículo es menor al "KM del último cambio" ingresado. Revisa si algún registro de Unidad tiene un kilometraje mal cargado, o si el KM del cambio se ingresó incorrectamente.</p>`:''}
    ${regla.detalleTaller?`<p style="font-size:12.5px;margin-bottom:.5rem"><b>Detalle / taller:</b> ${escapeHtml(regla.detalleTaller)}</p>`:''}
    ${regla.comentario?`<p style="font-size:12.5px;margin-bottom:.9rem"><b>Comentario:</b> ${escapeHtml(regla.comentario)}</p>`:''}
    <p class="sec-lbl" style="margin-bottom:.4rem">Documentos adjuntos (${docs.length})</p>
    ${docsHTML}
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
      <div class="obs-modal-actions" style="margin-top:1rem">
        <button class="btn-sec" onclick="cerrarModalDetalleFlota()">Cerrar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  g('fd-desc').textContent=regla.desc||'—';
  g('fd-body').innerHTML=body;
  modal.style.display='flex';
}
export function cerrarModalDetalleFlota(){
  const modal=g('modal-flota-detalle');
  if(modal)modal.style.display='none';
}
