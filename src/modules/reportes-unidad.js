import { __set_ingresoMantNombre, adjPendientes, descargarDocumentoVehiculo, exportVehiculoPDF, limpiarAdjPendientes, removeItemExtra, renderBarraAdjuntos, renderMantDetail, subirArchivosACola } from './adjuntos-pendientes.js';
import { dbDeleteDocumentoVehiculo, dbDeleteUnidad, dbUpsertUnidad, dbUpsertVehiculo, saveAll, sb, sbReady } from './bootstrap.js';
import { __set_mantSelected, __set_unidades, activarInputsFilesrc, lists, session, unidades } from './core-data.js';
import { renderUniTable } from './dashboard-kpis.js';
import { __set_flotaSelected, calcEstadoReglaFlota, renderEstadoFlota } from './estado-flota.js';
import { escapeHtml, formatFecha, formatFechaHora, isAdminUser, mesFromFecha, safeId } from './evaluaciones.js';
import { pdfCheckPageBreak, pdfDrawHeader, pdfDrawTitleBlock, pdfSectionBar } from './evaluaciones-pdf.js';
import { exportViajesExcel } from './exportacion-excel.js';
import { renderMantenciones } from './flota-regla-modal.js';
import { fillSel, g, populateForms, tecnicosList } from './form-helpers.js';
import { renderAdmin } from './listas-admin.js';
import { ensureVehData } from './mantenciones-vehiculos.js';
import { sw } from './nav.js';
import { forzarDescarga, guardar, mostrarAvisoGuardadoOk, tiposRegistroKm } from './registro-adjuntos.js';
import { comprimirImagenSiHaceFalta, pdfAddPhotosPage } from './selector-foto-galeria.js';
import { __set_uniregSelected, renderUniregChips } from './unidad-patente-selector.js';

/* ===== REPORTES DE UNIDAD ===== */
export let repSelected=null;
export let editUnidadId=null;
export function renderReportes(){
  const chipsEl=g('rep-chips');
  if(!lists.vehiculos.length){
    chipsEl.innerHTML=addPatenteChipBtn('rep');
    g('rep-detail').innerHTML='<div class="empty-s"><p style="font-size:13px">No hay vehículos cargados.</p></div>';
    return;
  }
  if(!repSelected||!lists.vehiculos.includes(repSelected))repSelected=lists.vehiculos[0];
  chipsEl.innerHTML=lists.vehiculos.map(p=>`<span class="patente-chip ${repSelected===p?'sel':''}" onclick="selectPatenteRep('${p.replace(/'/g,"\\'")}')">${p}</span>`).join('')+addPatenteChipBtn('rep');
  renderRepDetail();
}
export function selectPatenteRep(p){repSelected=p;renderReportes();}
export let repSubTab='viajes';
/* Nombre del usuario con la sesión abierta (para trazabilidad creado_por) */
export function currentUserName(){return (session&&session.nombre)||'';}
/* Botón "+ Agregar patente" — pastilla clara con texto, para no confundirse con un cuadro vacío */
export function addPatenteChipBtn(ctx){
  return `<button type="button" class="patente-chip patente-chip-add" onclick="addPatenteQuick('${ctx}')" title="Agregar patente"><i class="ti ti-plus" aria-hidden="true"></i> Agregar patente</button>`;
}
export async function addPatenteQuick(ctx){
  const val=(prompt('Ingresa la nueva patente (ej: ABCD-12):')||'').trim().toUpperCase();
  if(!val)return;
  if(lists.vehiculos.includes(val)){alert('Esa patente ya existe.');return;}
  lists.vehiculos.push(val);
  const ok=await saveAll();
  if(!ok){
    lists.vehiculos=lists.vehiculos.filter(v=>v!==val);
    return;
  }
  populateForms();
  if(ctx==='mant')__set_mantSelected(val);
  if(ctx==='rep')repSelected=val;
  renderMantenciones();
  renderReportes();
  if(typeof renderAdmin==='function')renderAdmin();
  if(ctx==='reg'){__set_uniregSelected(val);renderUniregChips();}
  if(ctx==='flota'){__set_flotaSelected(val);renderEstadoFlota();}
}
export function setRepSubTab(t){repSubTab=t;renderRepDetail();}
/* Igual que "+ Agregar patente": agrega un nuevo nombre de mantención
   directamente desde la pantalla de Mantenciones, sin sacar al usuario a
   la sección Listas. */
export async function addMantNombreQuick(){
  const val=(prompt('Ingresa el nombre de la nueva mantención (ej: Cambio de neumáticos):')||'').trim();
  if(!val)return;
  if(!lists.mantNombres)lists.mantNombres=[];
  if(lists.mantNombres.includes(val)){alert('Ese nombre de mantención ya existe.');return;}
  lists.mantNombres.push(val);
  const ok=await saveAll();
  if(!ok){
    lists.mantNombres=lists.mantNombres.filter(v=>v!==val);
    return;
  }
  populateForms();
  __set_ingresoMantNombre(val);
  renderMantenciones();
  if(typeof renderAdmin==='function')renderAdmin();
}
/* Arma una lista unificada de "eventos" de mantención para una patente: el cambio
   de aceite, la revisión técnica, cada mantención adicional y cada documento cargado,
   cada uno con su fecha, tipo, detalle y fotos/archivos adjuntos si los tiene. */
export function buildMantEventos(patente){
  const vd=ensureVehData(patente);
  const eventos=[];
  /* Nota: los antiguos campos vd.aceite/vd.revision ya se migran a
     reglasMant dentro de ensureVehData, así que aquí solo hace falta leer
     reglasMant — una sola fuente de verdad para Mantenciones, Estado de
     Flota y este historial. */
  (vd.items||[]).forEach(it=>{
    eventos.push({
      tipo:it.nombre||'Mantención',icon:'ti-settings',clase:'b-gar',
      fecha:it.fecha||'',
      detalle:it.detalle||'',
      extra:'',
      fotos:it.fotoPath?[{path:it.fotoPath,nombre:it.nombre||'Mantención'}]:[],
      origen:'item',patente,itemId:it.id
    });
  });
  (vd.reglasMant||[]).forEach(r=>{
    if(!r.detalleTaller&&!r.comentario&&!r.ultimoKm&&!r.ultimaFecha&&!(r.documentos&&r.documentos.length))return;
    const est=calcEstadoReglaFlota(r,patente);
    const docs=r.documentos||[];
    eventos.push({
      tipo:r.desc||'Mantención',icon:'ti-tool',clase:'b-'+(est.estado==='rojo'?'err':(est.estado==='amarillo'?'gar':'ok')),
      fecha:r.ultimaFecha||'',
      detalle:[r.detalleTaller,r.comentario].filter(Boolean).join(' · ')||est.vigenteTexto,
      extra:r.ultimoKm?Number(r.ultimoKm).toLocaleString('es-CL')+' km al momento del cambio':'',
      /* Fotos con vista previa de imagen, y documentos (PDF u otros) como
         archivos descargables aparte — así ningún adjunto queda "invisible"
         en el detalle aunque no sea una imagen. */
      fotos:docs.filter(d=>(d.mimeType||'').startsWith('image/')).map(d=>({path:d.storagePath,nombre:d.nombreArchivo})),
      archivos:docs.filter(d=>!(d.mimeType||'').startsWith('image/')).map(d=>({path:d.storagePath,nombre:d.nombreArchivo})),
      origen:'regla',patente,reglaId:r.id
    });
  });
  (vd.documentos||[]).forEach(d=>{
    eventos.push({
      tipo:d.tipo||'Documento',icon:'ti-file-text',clase:'b-gar',
      fecha:d.fecha||'',
      detalle:d.nombreArchivo||'',
      extra:'',
      docId:d.id,
      docNombre:d.nombreArchivo||'',
      docPath:d.storagePath||'',
      docMime:d.mimeType||'',
      subidoEn:d.subidoEn||'',
      subidoPor:d.subidoPor||'',
      fotos:[],
      origen:'documento',patente
    });
  });
  return eventos.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
}
export let mantEventosActual=[];
/* Vista de "Reportes → Mantenciones": misma lista tipo OT que el historial de
   viajes, con Ver detalle / Editar / PDF por cada evento de mantención. */
export function repMantResumenHTML(patente){
  const vd=ensureVehData(patente);
  const eventos=buildMantEventos(patente);
  mantEventosActual=eventos;
  /* Resumen de Aceite y Revisión Técnica leído directamente de reglasMant
     (la misma fuente que usa Estado de Flota), para que el semáforo mostrado
     aquí sea siempre igual al de esa pantalla. */
  const clsMap={verde:'alto',amarillo:'medio',rojo:'bajo'};
  const reglaResumen=(nombre,icon)=>{
    const r=(vd.reglasMant||[]).find(x=>x.desc===nombre);
    if(!r)return `<span class="eval-avg-badge sindata"><i class="ti ${icon}" aria-hidden="true"></i> ${nombre}: Sin datos</span>`;
    const est=calcEstadoReglaFlota(r,patente);
    return `<span class="eval-avg-badge ${clsMap[est.estado]||'sindata'}"><i class="ti ${icon}" aria-hidden="true"></i> ${nombre}: ${escapeHtml(est.vigenteTexto||est.pendiente||'—')}</span>`;
  };
  const badges=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1rem">
    ${reglaResumen('Cambio de Aceite','ti-droplet')}
    ${reglaResumen('Revisión Técnica','ti-clipboard-check')}
  </div>`;
  const admin=isAdminUser();
  const lista=eventos.length?`<div class="card" style="padding:0;overflow:hidden;margin-bottom:0">`+eventos.map((ev,i)=>`
    <div class="reg-row">
      <div class="reg-row-info">
        <span class="reg-row-fecha">${ev.fecha?formatFecha(ev.fecha):'—'}</span>
        <span class="reg-row-ot"><i class="ti ${ev.icon}" aria-hidden="true"></i> ${escapeHtml(ev.tipo)}</span>
        <span class="reg-row-cliente">${escapeHtml(ev.detalle||'—')}</span>
        <span class="reg-row-badges"><span class="badge ${ev.clase}">${ev.fotos.length?'Con foto':((ev.archivos&&ev.archivos.length)||ev.docId?'Documento':'Sin adjunto')}</span></span>
      </div>
      <div class="reg-row-actions">
        <button class="btn-sec btn-sm" onclick="verDetalleMantencion(${i})"><i class="ti ti-eye" aria-hidden="true"></i> Ver</button>
        <button class="btn-sec btn-sm" onclick="exportVehiculoPDF('${patente.replace(/'/g,"\\'")}')"><i class="ti ti-download" aria-hidden="true"></i> PDF</button>
        ${admin?`<button class="btn-del" style="display:inline-flex" title="Eliminar" onclick="eliminarEventoMantencion(${i})"><i class="ti ti-trash" aria-hidden="true"></i></button>`:''}
      </div>
    </div>`).join('')+`</div>`:'<p class="eval-empty">Sin mantenciones ni documentos registrados para esta patente.</p>';
  return badges+lista;
}
/* Abre el detalle completo de un evento de mantención (foto o documento incluido) */
export function verDetalleMantencion(idx){
  const ev=mantEventosActual[idx];if(!ev)return;
  const rows=[
    ['Tipo',ev.tipo||'—'],
    ['Fecha',ev.fecha?formatFecha(ev.fecha):'—'],
    ['Detalle',ev.detalle||'—']
  ];
  if(ev.extra)rows.push(['Información adicional',ev.extra]);
  let html=rows.map(f=>`<div class="regdet-row"><span class="regdet-lbl">${f[0]}</span><span class="regdet-val">${escapeHtml(String(f[1]))}</span></div>`).join('');
  if(ev.fotos&&ev.fotos.length){
    html+=`<p class="sec-lbl" style="margin-top:1rem">Foto${ev.fotos.length>1?'s':''} adjunta${ev.fotos.length>1?'s':''}</p><div class="ef-fotos-grid">`+
      ev.fotos.map(f=>{
        const url=unidadFotoUrl(f.path);
        return `<div class="ef-foto-card">
          <img src="${url}" alt="${escapeHtml(f.nombre)}" onclick="${url?`window.open('${url}','_blank')`:''}">
          <div class="ef-foto-meta"><span class="ef-foto-name" title="${escapeHtml(f.nombre)}">${escapeHtml(f.nombre)}</span></div>
          <div style="display:flex;gap:6px;padding:0 7px 7px">
            <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="window.open('${url}','_blank')"`:'disabled'}><i class="ti ti-eye" aria-hidden="true"></i> Ver en grande</button>
            <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="forzarDescarga('${url}','${escapeHtml(f.nombre)}')"`:'disabled'}><i class="ti ti-download" aria-hidden="true"></i> Descargar</button>
          </div>
        </div>`;
      }).join('')+'</div>';
  }
  /* Documentos que no son imagen (PDF, etc): se muestran como tarjeta con
     ícono y botón de descarga, para que ningún adjunto quede sin mostrarse
     solo por no ser una foto. */
  if(ev.archivos&&ev.archivos.length){
    html+=`<p class="sec-lbl" style="margin-top:1rem">Documento${ev.archivos.length>1?'s':''} adjunto${ev.archivos.length>1?'s':''}</p><div class="ef-fotos-grid">`+
      ev.archivos.map(a=>{
        const url=unidadFotoUrl(a.path);
        return `<div class="ef-foto-card">
          <div class="ef-foto-ph" onclick="${url?`window.open('${url}','_blank')`:''}"><i class="ti ti-file-type-pdf" aria-hidden="true"></i></div>
          <div class="ef-foto-meta"><span class="ef-foto-name" title="${escapeHtml(a.nombre)}">${escapeHtml(a.nombre)}</span></div>
          <div style="display:flex;gap:6px;padding:0 7px 7px">
            <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="window.open('${url}','_blank')"`:'disabled'}><i class="ti ti-eye" aria-hidden="true"></i> Ver</button>
            <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="forzarDescarga('${url}','${escapeHtml(a.nombre)}')"`:'disabled'}><i class="ti ti-download" aria-hidden="true"></i> Descargar</button>
          </div>
        </div>`;
      }).join('')+'</div>';
  }
  if(ev.docId){
    const url=ev.docPath?unidadFotoUrl(ev.docPath):'';
    const esImagen=(ev.docMime||'').startsWith('image/');
    html+=`<p class="sec-lbl" style="margin-top:1rem">Documento adjunto</p><div class="ef-fotos-grid">`+
      `<div class="ef-foto-card">
        ${esImagen
          ?`<img src="${url}" alt="${escapeHtml(ev.docNombre)}" onclick="${url?`window.open('${url}','_blank')`:''}">`
          :`<div class="ef-foto-ph" onclick="${url?`window.open('${url}','_blank')`:''}"><i class="ti ti-file-type-pdf" aria-hidden="true"></i></div>`}
        <div class="ef-foto-meta"><span class="ef-foto-name" title="${escapeHtml(ev.docNombre)}">${escapeHtml(ev.docNombre)}</span></div>
        <div style="display:flex;gap:6px;padding:0 7px 7px">
          <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="window.open('${url}','_blank')"`:'disabled'}><i class="ti ti-eye" aria-hidden="true"></i> Ver</button>
          <button class="btn-sec btn-sm" style="flex:1" onclick="descargarDocumentoVehiculo('${ev.docId}','${escapeHtml(ev.docNombre)}')"><i class="ti ti-download" aria-hidden="true"></i> Descargar</button>
        </div>
      </div></div>`;
    if(ev.subidoEn){
      html+=`<div class="regdet-row" style="margin-top:.6rem"><span class="regdet-lbl">Ingresado el</span><span class="regdet-val">${formatFechaHora(ev.subidoEn)}${ev.subidoPor?' · '+escapeHtml(ev.subidoPor):''}</span></div>`;
    }
  }
  if(!(ev.fotos&&ev.fotos.length)&&!(ev.archivos&&ev.archivos.length)&&!ev.docId){
    html+=`<p style="font-size:11.5px;color:var(--text-muted);margin-top:1rem">Sin foto ni documento adjunto para este evento.</p>`;
  }
  /* Edición completa: solo un administrador puede corregir un registro ya
     guardado (el equipo técnico en terreno puede equivocarse al ingresar
     fecha/km, y esta es la vía para arreglarlo sin borrar y crear de nuevo).
     Por ahora la edición de campos vive solo para eventos que vienen de
     'regla' (el flujo unificado de Mantenciones/Estado de Flota); otros
     orígenes (documento suelto, item libre) solo pueden eliminarse. */
  if(isAdminUser()){
    if(ev.origen==='regla'){
      const vdEd=ensureVehData(ev.patente);
      const reglaEd=(vdEd.reglasMant||[]).find(r=>r.id===ev.reglaId);
      if(reglaEd){
        const eid='ed_'+idx;
        html+=`<div style="margin-top:1.2rem;padding-top:1rem;border-top:1px solid var(--border-color)">
          <p class="sec-lbl"><i class="ti ti-pencil" aria-hidden="true"></i>Editar (solo administrador)</p>
          <div class="fg">
            ${reglaEd.modo==='km'
              ?`<div class="field"><label>KM en que se hizo</label><input type="number" id="ed-km-${eid}" value="${reglaEd.ultimoKm||''}"></div>`
              :`<div class="field"><label>Fecha en que se hizo</label><input type="date" id="ed-fecha-${eid}" value="${reglaEd.ultimaFecha||''}"></div>`}
            <div class="field"><label>Detalle / taller</label><input type="text" id="ed-detalle-${eid}" value="${escapeHtml(reglaEd.detalleTaller||'')}"></div>
          </div>
          <div class="field" style="margin-top:.6rem"><label>Comentario</label><textarea id="ed-comentario-${eid}" rows="2">${escapeHtml(reglaEd.comentario||'')}</textarea></div>
          <div class="field" style="margin-top:.6rem"><label>Reemplazar foto o documento</label><input type="file" id="ed-archivo-${eid}" accept=".pdf,.jpg,.jpeg,.png,.webp" style="text-transform:none" data-filesrc="Elegir foto o PDF"></div>
          <button class="btn" style="margin-top:.8rem;width:100%;justify-content:center" onclick="guardarEdicionAdminMantencion(${idx},'${eid}')"><i class="ti ti-device-floppy" aria-hidden="true"></i>Guardar corrección</button>
        </div>`;
      }
    }
    html+=`<div style="margin-top:1.2rem;padding-top:1rem;border-top:1px solid var(--border-color)">
      <button class="btn-eliminar-evento" onclick="eliminarEventoMantencion(${idx})"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar este registro del historial</button>
    </div>`;
  }
  g('mant-detalle-modal-body').innerHTML=html;
  g('mant-detail-modal').style.display='flex';
  activarInputsFilesrc(g('mant-detalle-modal-body'));
}
/* Guarda la corrección hecha por un admin sobre un evento ya registrado
   (fecha/km/detalle/comentario y, opcionalmente, reemplazo de archivo).
   Solo aplica a eventos de origen 'regla' — el flujo unificado que usan
   Mantenciones y Estado de Flota. */
export async function guardarEdicionAdminMantencion(idx,eid){
  if(!isAdminUser())return;
  const ev=mantEventosActual[idx];if(!ev||ev.origen!=='regla')return;
  const patente=ev.patente;
  const vd=ensureVehData(patente);
  const regla=(vd.reglasMant||[]).find(r=>r.id===ev.reglaId);
  if(!regla)return;
  const prev=JSON.parse(JSON.stringify(regla));
  if(regla.modo==='km'){
    const kmEl=g('ed-km-'+eid);
    if(kmEl)regla.ultimoKm=parseInt(kmEl.value)||0;
  }else{
    const fechaEl=g('ed-fecha-'+eid);
    if(fechaEl)regla.ultimaFecha=fechaEl.value||'';
  }
  const detEl=g('ed-detalle-'+eid);if(detEl)regla.detalleTaller=detEl.value;
  const comEl=g('ed-comentario-'+eid);if(comEl)regla.comentario=comEl.value;
  regla.editadoPor=currentUserName();
  regla.editadoEn=new Date().toISOString();
  /* Si se eligió un archivo de reemplazo, se sube y se agrega a los
     documentos de la regla (no se borra el anterior automáticamente, para
     no perder respaldo si el reemplazo falla o fue sin querer). */
  const archivoEl=g('ed-archivo-'+eid);
  const nuevoArchivo=archivoEl&&archivoEl.files&&archivoEl.files[0];
  let archivoSubidoPath=null;
  if(nuevoArchivo){
    if(!sbReady()){alert('Sin conexión a la base de datos, no se pudo subir el archivo. Se guardarán los demás cambios.');}
    else if(nuevoArchivo.size>15*1024*1024){alert('El archivo supera 15MB, no se subió. Se guardarán los demás cambios.');}
    else{
      try{
        const fileComp=await comprimirImagenSiHaceFalta(nuevoArchivo);
        const id=Date.now()+'_'+Math.random().toString(36).slice(2,7);
        const path=patente.replace(/[^a-zA-Z0-9]/g,'_')+'/'+id+'_'+fileComp.name;
        const{error}=await sb.storage.from('vehiculo-documentos').upload(path,fileComp);
        if(error)throw error;
        if(!regla.documentos)regla.documentos=[];
        regla.documentos.push({id,tipo:regla.desc,nombreArchivo:fileComp.name,fecha:new Date().toISOString().slice(0,10),mimeType:fileComp.type,storagePath:path,creadoPor:currentUserName(),subidoPor:currentUserName(),subidoEn:new Date().toISOString()});
        archivoSubidoPath=path;
      }catch(err){
        alert('No se pudo subir el archivo de reemplazo: '+((err&&err.message)||'error al subir')+'. Se guardarán los demás cambios.');
      }
    }
  }
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){
    Object.assign(regla,prev);
    if(archivoSubidoPath&&sb)sb.storage.from('vehiculo-documentos').remove([archivoSubidoPath]).catch(()=>{});
    alert('No se pudo guardar la corrección. Intenta nuevamente.');
    return;
  }
  mostrarAvisoGuardadoOk('Corrección de '+regla.desc);
  closeMantDetalleModal();
  renderMantDetail&&typeof renderMantDetail==='function'&&renderMantDetail();
  renderMantenciones&&typeof renderMantenciones==='function'&&renderMantenciones();
  renderRepDetail&&typeof renderRepDetail==='function'&&renderRepDetail();
  renderEstadoFlota&&typeof renderEstadoFlota==='function'&&renderEstadoFlota();
}
export function closeMantDetalleModal(){g('mant-detail-modal').style.display='none';}
/* Elimina un evento del historial de mantenciones, sin importar de qué
   parte del modelo de datos venga (cambio de aceite, revisión técnica,
   mantención adicional, regla de flota o documento suelto). Cada tipo se
   borra en su propio lugar y se guarda puntualmente ese vehículo. */
export async function eliminarEventoMantencion(idx){
  if(!isAdminUser()){alert('Solo un administrador puede eliminar un registro del historial.');return;}
  const ev=mantEventosActual[idx];if(!ev)return;
  if(!confirm('¿Eliminar este registro del historial? Esta acción no se puede deshacer.'))return;
  const patente=ev.patente;
  const vd=ensureVehData(patente);
  if(ev.origen==='item'){
    await removeItemExtraSilencioso(patente,ev.itemId);
  }else if(ev.origen==='regla'){
    const regla=(vd.reglasMant||[]).find(r=>r.id===ev.reglaId);
    const prevReglas=(vd.reglasMant||[]).slice();
    /* Si la regla tiene documentos adjuntos, se borran también sus archivos
       del storage para no dejar basura huérfana. */
    const docsRegla=(regla&&regla.documentos)||[];
    vd.reglasMant=(vd.reglasMant||[]).filter(r=>r.id!==ev.reglaId);
    const ok=await dbUpsertVehiculo(patente);
    if(!ok){vd.reglasMant=prevReglas;return;}
    docsRegla.forEach(d=>{if(d.storagePath&&sb)sb.storage.from('vehiculo-documentos').remove([d.storagePath]).catch(()=>{});});
  }else if(ev.origen==='documento'){
    const doc=(vd.documentos||[]).find(d=>String(d.id)===String(ev.docId));
    const ok=await dbDeleteDocumentoVehiculo(ev.docId);
    if(!ok)return;
    vd.documentos=(vd.documentos||[]).filter(d=>String(d.id)!==String(ev.docId));
    if(doc&&doc.storagePath&&sb)sb.storage.from('vehiculo-documentos').remove([doc.storagePath]).catch(()=>{});
  }else{
    return;
  }
  closeMantDetalleModal();
  renderMantDetail&&typeof renderMantDetail==='function'&&renderMantDetail();
  renderMantenciones&&typeof renderMantenciones==='function'&&renderMantenciones();
  renderRepDetail&&typeof renderRepDetail==='function'&&renderRepDetail();
  renderEstadoFlota&&typeof renderEstadoFlota==='function'&&renderEstadoFlota();
}
/* Versión de removeItemExtra sin el confirm() propio (el confirm ya lo pide
   eliminarEventoMantencion una sola vez) */
export async function removeItemExtraSilencioso(patente,id){
  const vd=ensureVehData(patente);
  const item=(vd.items||[]).find(x=>x.id===id);
  const prevItems=(vd.items||[]).slice();
  vd.items=(vd.items||[]).filter(x=>x.id!==id);
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){vd.items=prevItems;return;}
  if(item&&item.archivos)item.archivos.forEach(a=>{if(a.path&&sb)sb.storage.from('vehiculo-documentos').remove([a.path]).catch(()=>{});});
  if(item&&item.fotoPath&&sb)sb.storage.from('vehiculo-documentos').remove([item.fotoPath]).catch(()=>{});
}
/* Lleva al formulario de mantenciones (pestaña Mantenciones) con esa patente seleccionada */
export function irAEditarMantencion(patente){
  __set_mantSelected(patente);
  sw('unimant');
  renderMantenciones();
}
/* Modal "Ver" detalle completo de un viaje, con galería estética de todas las fotos
   (odómetro inicial, odómetro final y foto adicional) en tamaño grande. */
export function verViajeModal(id){
  const u=unidades.find(x=>x.id===id);if(!u)return;
  const integrantes=[u.i1,u.i2,u.i3,u.i4].filter(Boolean).join(', ')||'—';
  const rows=[
    ['Fecha',u.fecha?formatFecha(u.fecha):'—'],
    ['Mes',u.mes||'—'],
    ['Tipo de registro',u.tipo||'—'],
    ['Conductor',u.conductor||'—'],
    ['Patente',u.patente||'—'],
    ['KM inicial',u.kmi!=null?Number(u.kmi).toLocaleString('es-CL'):'—'],
    ['KM final',u.kmf!=null?Number(u.kmf).toLocaleString('es-CL'):'—'],
    ['KM recorridos',u.total>0?u.total.toLocaleString('es-CL')+' km':'—'],
    ['Combustible',u.comb||'—'],
    ['¿Recargó combustible?',u.recarga==='SI'?'Sí':'No'],
    ['Monto recarga',u.recarga==='SI'?'$'+(u.monto||0).toLocaleString('es-CL'):'—'],
    ['Forma de pago',u.pago||'—'],
    ['Integrantes',integrantes],
    ['Ingresado por',u.creadoPor||'—']
  ];
  let html=rows.map(f=>`<div class="regdet-row"><span class="regdet-lbl">${f[0]}</span><span class="regdet-val">${escapeHtml(String(f[1]))}</span></div>`).join('');
  /* fotosKm reemplaza a las fotos únicas de odómetro (fotoKmiPath/fotoKmfPath)
     desde que el registro pasó a admitir varias fotos — pero se muestran las
     antiguas igual para no perder el respaldo de registros ya guardados. */
  const galeria=(u.fotosKm&&u.fotosKm.length
    ?u.fotosKm.map(f=>({path:f.storagePath,nombre:f.tipo||f.nombreArchivo||'Foto del odómetro',icon:'ti-gauge'}))
    :[{path:u.fotoKmiPath,nombre:'Odómetro KM inicial',icon:'ti-gauge'},{path:u.fotoKmfPath,nombre:'Odómetro KM final',icon:'ti-gauge'}])
    .concat([{path:u.fotoPath,nombre:'Foto adicional',icon:'ti-camera'}])
    .filter(f=>f.path);
  if(galeria.length){
    html+=`<p class="sec-lbl" style="margin-top:1.1rem">Fotos de respaldo (${galeria.length})</p><div class="ef-fotos-grid">`+
      galeria.map(f=>{
        const url=unidadFotoUrl(f.path);
        return `<div class="ef-foto-card">
          <img src="${url}" alt="${escapeHtml(f.nombre)}" onclick="${url?`window.open('${url}','_blank')`:''}">
          <div class="ef-foto-meta"><span class="ef-foto-name" title="${escapeHtml(f.nombre)}"><i class="ti ${f.icon}" aria-hidden="true"></i> ${escapeHtml(f.nombre)}</span></div>
          <div style="display:flex;gap:6px;padding:0 7px 7px">
            <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="window.open('${url}','_blank')"`:'disabled'}><i class="ti ti-eye" aria-hidden="true"></i> Ver en grande</button>
            <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="forzarDescarga('${url}','${escapeHtml(f.nombre)}.jpg')"`:'disabled'}><i class="ti ti-download" aria-hidden="true"></i> Descargar</button>
          </div>
        </div>`;
      }).join('')+'</div>';
  }else{
    html+=`<p style="font-size:11.5px;color:var(--text-muted);margin-top:1rem">Sin fotos adjuntas para este viaje.</p>`;
  }
  g('viaje-modal-body').innerHTML=html;
  g('viaje-detail-modal').style.display='flex';
}
export function closeViajeModal(){g('viaje-detail-modal').style.display='none';}
export function verFotoUnidad(path){
  if(!sbReady()||!path){alert('No se pudo abrir la foto.');return;}
  const{data}=sb.storage.from('vehiculo-documentos').getPublicUrl(path);
  window.open(data.publicUrl,'_blank');
}
export function unidadFotoUrl(path){
  if(!path||!sbReady())return'';
  try{return sb.storage.from('vehiculo-documentos').getPublicUrl(path).data.publicUrl;}catch(e){return'';}
}
/* PDF de un solo viaje */
export async function exportViajePDF(id){
  const u=unidades.find(x=>x.id===id);if(!u)return;
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  const pageH=doc.internal.pageSize.getHeight();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'PATENTE '+(u.patente||'—'),`Generado el ${new Date().toLocaleDateString('es-CL')}`);

  const pintarFilas=(filas)=>{
    doc.setFontSize(10);
    filas.forEach(f=>{
      if(!f[1])return;
      y=pdfCheckPageBreak(doc,y,20);
      doc.setFont('helvetica','bold');doc.text(f[0]+':',marginX,y);
      doc.setFont('helvetica','normal');doc.text(String(f[1]),marginX+140,y);
      y+=18;
    });
  };

  y=pdfSectionBar(doc,y,marginX,pageW,'DATOS DEL VIAJE',[42,120,214]);
  pintarFilas([
    ['Fecha',u.fecha?formatFecha(u.fecha):'—'],
    ['Conductor',u.conductor||'—'],
    ['Patente',u.patente||'—'],
    ['Ingresado por',u.creadoPor||'—']
  ]);

  y=pdfSectionBar(doc,y,marginX,pageW,'KILOMETRAJE',[100,116,139]);
  pintarFilas([
    ['KM inicial',u.kmi!=null?String(u.kmi):'—'],
    ['KM final',u.kmf!=null?String(u.kmf):'—'],
    ['KM recorridos',u.total>0?u.total+' km':'—']
  ]);

  y=pdfSectionBar(doc,y,marginX,pageW,'COMBUSTIBLE Y PAGO',[237,161,0]);
  pintarFilas([
    ['Combustible',u.comb||'—'],
    ['Recargó combustible',u.recarga==='SI'?'Sí':'No'],
    ['Monto recarga',u.recarga==='SI'?'$'+(u.monto||0).toLocaleString('es-CL'):'—'],
    ['Forma de pago',u.pago||'—']
  ]);

  y=pdfSectionBar(doc,y,marginX,pageW,'TRIPULACIÓN',[124,58,237]);
  pintarFilas([
    ['Integrantes',[u.i1,u.i2,u.i3,u.i4].filter(Boolean).join(', ')||'—']
  ]);

  if(u.detalle){
    y=pdfSectionBar(doc,y,marginX,pageW,'ESPECIFICACIÓN / COMENTARIO DEL ENCARGADO',[100,116,139]);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    const lines=doc.splitTextToSize(u.detalle,pageW-marginX*2);
    y=pdfCheckPageBreak(doc,y,lines.length*10+6);
    doc.text(lines,marginX,y);y+=lines.length*10+4;
  }
  const fotos=[
    {path:u.fotoKmiPath,nombre:'Odómetro KM inicial'},
    {path:u.fotoKmfPath,nombre:'Odómetro KM final'},
    {path:u.fotoPath,nombre:'Foto adicional'}
  ].filter(f=>f.path).map(f=>({url:unidadFotoUrl(f.path),nombre:f.nombre}));
  await pdfAddPhotosPage(doc,pageW,pageH,marginX,[{titulo:'PATENTE '+(u.patente||'—')+' — '+(u.fecha?formatFecha(u.fecha):''),fotos}]);
  doc.save(`Viaje_${safeId(u.patente||'unidad')}_${u.fecha||u.id}.pdf`);
}
export function renderRepDetail(){
  const el=g('rep-detail');
  if(!repSelected){el.innerHTML='';return;}
  const patente=repSelected;
  const pSafe=patente.replace(/'/g,"\\'");
  const fechaFiltro=g('unirep-fil-fecha')?g('unirep-fil-fecha').value:'';
  let trips=unidades.filter(u=>u.patente===patente);
  if(fechaFiltro)trips=trips.filter(u=>u.fecha===fechaFiltro);
  trips=trips.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const toggle=`
    <div class="rep-subtabs">
      <button class="rep-subtab ${repSubTab==='viajes'?'sel':''}" onclick="setRepSubTab('viajes')"><i class="ti ti-steering-wheel" aria-hidden="true"></i> Viajes (Registro)</button>
      <button class="rep-subtab ${repSubTab==='mant'?'sel':''}" onclick="setRepSubTab('mant')"><i class="ti ti-tool" aria-hidden="true"></i> Mantenciones</button>
    </div>`;
  let body;
  if(repSubTab==='mant'){
    body=repMantResumenHTML(patente);
  }else{
    body=(trips.length?`<div class="card" style="padding:0;overflow:hidden;margin-bottom:0">`+trips.map(u=>`
      <div class="reg-row">
        <div class="reg-row-info">
          <span class="reg-row-fecha">${u.fecha?formatFecha(u.fecha):'—'}</span>
          <span class="reg-row-ot"><i class="ti ti-user" aria-hidden="true"></i> ${u.conductor||'—'}</span>
          <span class="reg-row-cliente">${u.total>0?u.total.toLocaleString('es-CL')+' km recorridos':'—'}</span>
          <span class="reg-row-badges">
            <span class="badge ${u.recarga==='SI'?'b-inst':'b-gar'}">${u.comb||'—'}</span>
            ${(u.fotoKmiPath||u.fotoKmfPath||(u.fotosKm&&u.fotosKm.length))?'<span class="badge b-ok"><i class="ti ti-camera" aria-hidden="true"></i> Con fotos</span>':'<span class="badge b-err"><i class="ti ti-camera-off" aria-hidden="true"></i> Sin fotos</span>'}
          </span>
        </div>
        <div class="reg-row-actions">
          <button class="btn-sec btn-sm" onclick="verViajeModal(${u.id})"><i class="ti ti-eye" aria-hidden="true"></i> Ver</button>
          <button class="btn-sec btn-sm" onclick="editarUnidadModal(${u.id})"><i class="ti ti-pencil" aria-hidden="true"></i> Editar</button>
          <button class="btn-sec btn-sm" onclick="exportViajePDF(${u.id})"><i class="ti ti-download" aria-hidden="true"></i> PDF</button>
          <button class="btn-del" onclick="eliminarUnidad(${u.id})" title="Eliminar"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </div>`).join('')+`</div>`:'<p class="eval-empty">Sin viajes registrados para esta patente en el filtro seleccionado.</p>');
  }
  el.innerHTML=`
  <div class="card" style="--sec-color:#eda100">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:1rem">
      <p class="card-title" style="margin:0;padding:0;border:none"><i class="ti ti-report" aria-hidden="true"></i>${patente}</p>
      <div style="display:flex;gap:8px">
        <button class="dl-btn" onclick="exportReportePatentePDF('${pSafe}')"><i class="ti ti-download" aria-hidden="true"></i>PDF</button>
        <button class="dl-btn" style="background:#1D6F42" onclick="exportViajesExcel('${pSafe}')"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i>Excel</button>
      </div>
    </div>
    ${toggle}
    ${body}
  </div>`;
}
export function editarUnidadModal(id){
  const u=unidades.find(x=>x.id===id);if(!u)return;
  editUnidadId=id;
  g('ue-fecha').value=u.fecha||'';
  fillSel('ue-tipo',tiposRegistroKm(),'');g('ue-tipo').value=u.tipo||'Registro de kilometraje';
  fillSel('ue-conductor',tecnicosList(),'');g('ue-conductor').value=u.conductor||'';
  fillSel('ue-patente',lists.vehiculos,'');g('ue-patente').value=u.patente||'';
  fillSel('ue-comb',lists.combustibles,'');g('ue-comb').value=u.comb||'FULL';
  g('ue-kmi').value=u.kmi||'';
  g('ue-kmf').value=u.kmf||'';
  g('ue-recarga').value=u.recarga||'NO';
  g('ue-monto').value=u.monto||'';
  limpiarAdjPendientes('uedit_kmfoto');
  renderUeFotosKm();
  g('unidad-edit-modal').style.display='flex';
}
/* Fotos del odómetro ya guardadas (con botón eliminar) + dropzone para
   agregar más, dentro del modal "Editar registro de unidad" — para que
   desde "detalles" se pueda ver y editar absolutamente todo, tal como en
   Mantenciones. */
export function renderUeFotosKm(){
  const wrap=g('ue-fotos-list');
  if(!wrap)return;
  const u=unidades.find(x=>x.id===editUnidadId);
  const fotos=(u&&u.fotosKm)||[];
  wrap.innerHTML=fotos.length?'<div class="ef-fotos-grid">'+fotos.map((f,i)=>{
    const url=unidadFotoUrl(f.storagePath);
    return `<div class="ef-foto-card">
      <img src="${url}" alt="${escapeHtml(f.nombreArchivo||'foto')}" onclick="${url?`window.open('${url}','_blank')`:''}">
      <div class="ef-foto-meta"><span class="ef-foto-name" title="${escapeHtml(f.tipo||f.nombreArchivo||'')}">${escapeHtml(f.tipo||f.nombreArchivo||'Foto')}</span>
      <button class="btn-del" onclick="eliminarFotoKmEdit(${i})"><i class="ti ti-trash" aria-hidden="true"></i></button></div>
    </div>`;
  }).join('')+'</div>':'<p class="eval-empty" style="margin:0">Sin fotos guardadas.</p>';
  const dz=g('ue-fotos-dz');
  if(dz)dz.innerHTML=renderBarraAdjuntos('uedit_kmfoto');
}
export async function eliminarFotoKmEdit(idx){
  const u=unidades.find(x=>x.id===editUnidadId);if(!u||!u.fotosKm)return;
  if(!confirm('¿Eliminar esta foto?'))return;
  const doc=u.fotosKm[idx];
  const prev=u.fotosKm.slice();
  u.fotosKm=u.fotosKm.filter((_,i)=>i!==idx);
  u.fotoKmfPath=u.fotosKm.length?u.fotosKm[0].storagePath:null;
  const ok=await dbUpsertUnidad(u);
  if(!ok){u.fotosKm=prev;return;}
  if(doc&&doc.storagePath&&sb)sb.storage.from('vehiculo-documentos').remove([doc.storagePath]).catch(()=>{});
  renderUeFotosKm();
}
export function closeUnidadEditModal(){g('unidad-edit-modal').style.display='none';editUnidadId=null;}
export async function saveUnidadEdit(){
  const u=unidades.find(x=>x.id===editUnidadId);if(!u)return;
  const prevSnapshot={...u,fotosKm:(u.fotosKm||[]).slice()};
  u.fecha=g('ue-fecha').value;u.mes=mesFromFecha(u.fecha);
  u.tipo=g('ue-tipo').value;
  u.conductor=g('ue-conductor').value;
  u.patente=g('ue-patente').value;
  u.comb=g('ue-comb').value;
  u.kmi=parseInt(g('ue-kmi').value)||0;
  u.kmf=parseInt(g('ue-kmf').value)||0;
  u.total=u.kmf-u.kmi;
  u.recarga=g('ue-recarga').value;
  u.monto=parseInt(g('ue-monto').value)||0;
  if(!u.fotosKm)u.fotosKm=[];
  const pendientes=adjPendientes['uedit_kmfoto']||[];
  if(pendientes.length)await subirArchivosACola(u.patente,pendientes,u.tipo,u.fotosKm);
  if(u.fotosKm.length)u.fotoKmfPath=u.fotosKm[0].storagePath;
  const ok=await dbUpsertUnidad(u);
  if(!ok){
    Object.assign(u,prevSnapshot);
    return;
  }
  limpiarAdjPendientes('uedit_kmfoto');
  closeUnidadEditModal();
  renderReportes();
  renderUniTable();
  alert('Registro actualizado.');
}
export function eliminarUnidad(id){
  if(!confirm('¿Eliminar este registro de unidad?'))return;
  __set_unidades(unidades.filter(u=>u.id!==id));
  dbDeleteUnidad(id);renderReportes();renderUniTable();
}
export function buildReportePatenteBlock(doc,y,patente){
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  const trips=unidades.filter(u=>u.patente===patente).sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
  y=pdfCheckPageBreak(doc,y,60);
  y+=8;
  doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(20,20,20);
  doc.text('PATENTE '+patente,marginX,y);
  y+=6;
  doc.setDrawColor(210);doc.setLineWidth(0.8);
  doc.line(marginX,y,pageW-marginX,y);
  y+=15;
  if(!trips.length){
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(140);
    doc.text('Sin viajes registrados.',marginX,y);doc.setTextColor(0);
    return y+20;
  }
  const colFecha=65,colCond=140,colKm=65,colComb=60;
  let cx=marginX;
  doc.setFillColor(13,27,38);doc.rect(cx,y,colFecha,15,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(7);
  doc.text('FECHA',cx+colFecha/2,y+10,{align:'center'});cx+=colFecha;
  doc.setFillColor(13,27,38);doc.rect(cx,y,colCond,15,'F');doc.text('CONDUCTOR',cx+colCond/2,y+10,{align:'center'});cx+=colCond;
  doc.setFillColor(13,27,38);doc.rect(cx,y,colKm,15,'F');doc.text('KM',cx+colKm/2,y+10,{align:'center'});cx+=colKm;
  doc.setFillColor(13,27,38);doc.rect(cx,y,colComb,15,'F');doc.text('COMB.',cx+colComb/2,y+10,{align:'center'});
  doc.setTextColor(0);doc.setFont('helvetica','normal');
  y+=15;
  trips.forEach(u=>{
    y=pdfCheckPageBreak(doc,y,16);
    cx=marginX;
    doc.setDrawColor(220);doc.setLineWidth(0.4);doc.setFontSize(7.5);
    doc.rect(cx,y,colFecha,16);doc.text(u.fecha?formatFecha(u.fecha):'—',cx+colFecha/2,y+11,{align:'center'});cx+=colFecha;
    doc.rect(cx,y,colCond,16);doc.text(u.conductor||'—',cx+5,y+11);cx+=colCond;
    doc.rect(cx,y,colKm,16);doc.text(u.total>0?String(u.total):'—',cx+colKm/2,y+11,{align:'center'});cx+=colKm;
    doc.rect(cx,y,colComb,16);doc.text(u.comb||'—',cx+colComb/2,y+11,{align:'center'});
    y+=16;
  });
  return y+20;
}
export function exportReportePatentePDF(patente){
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'PATENTE '+patente,`Reporte de unidad · Generado el ${new Date().toLocaleDateString('es-CL')}`);
  buildReportePatenteBlock(doc,y,patente);
  doc.save(`Reporte_${safeId(patente)}.pdf`);
}
export function exportReportesTodosPDF(){
  if(!lists.vehiculos.length){alert('No hay vehículos cargados.');return;}
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'Reportes de unidades',`Generado el ${new Date().toLocaleDateString('es-CL')}`);
  lists.vehiculos.forEach(p=>{y=buildReportePatenteBlock(doc,y,p);});
  doc.save('Reportes_Unidades.pdf');
}
