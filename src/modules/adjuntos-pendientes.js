import { dbDeleteDocumentoVehiculo, dbUpsertVehiculo, sb, sbReady } from './bootstrap.js';
import { MANT_PARAMS, lists, mantSelected, registros, unidades, vehiculoData } from './core-data.js';
import { calcEstadoReglaFlota, renderEstadoFlota } from './estado-flota.js';
import { escapeHtml, formatFecha, formatFechaHora, isAdminUser, safeId } from './evaluaciones.js';
import { clsToRGB, pdfCheckPageBreak, pdfDrawHeader, pdfDrawTitleBlock, pdfSectionBar } from './evaluaciones-pdf.js';
import { g } from './form-helpers.js';
import { ensureVehData, kmActualVeh, kmMasCercano } from './mantenciones-vehiculos.js';
import { renderPendFab } from './pendientes-vehiculo.js';
import { guardar, mostrarToastBar } from './registro-adjuntos.js';
import { buildMantEventos, closeMantDetalleModal, currentUserName, renderMantHistorialConFiltro, unidadFotoUrl } from './reportes-unidad.js';
import { abrirSelectorArchivo, comprimirImagenSiHaceFalta, pdfAddPhotosPage } from './selector-foto-galeria.js';

/* ===== ADJUNTOS PENDIENTES (dropzone + vista previa, mismo estilo que OT)    Sistema ge ===== */
export let adjPendientes={}; /* {colaId: [File, File, ...]} */
export function handleAdjSelected(colaId,fileList){
  if(!adjPendientes[colaId])adjPendientes[colaId]=[];
  [...fileList].forEach(f=>adjPendientes[colaId].push(f));
  renderAdjPreview(colaId);
}
export function quitarAdjPendiente(colaId,idx){
  if(!adjPendientes[colaId])return;
  adjPendientes[colaId].splice(idx,1);
  renderAdjPreview(colaId);
}
export function renderAdjPreview(colaId){
  const wrap=g('adj-preview-'+colaId);
  if(!wrap)return;
  const files=adjPendientes[colaId]||[];
  if(!files.length){wrap.innerHTML='';return;}
  wrap.innerHTML='<div class="ot-pending-grid">'+files.map((f,i)=>{
    const isPdf=f.type==='application/pdf';
    const inner=isPdf?`<div class="ot-pending-file" style="background:#7A1F1F"><span class="ext">PDF</span><span class="fname">${escapeHtml(f.name)}</span></div>`:`<img src="${URL.createObjectURL(f)}">`;
    return `<div class="ot-pending-card">${inner}<button class="rm" onclick="quitarAdjPendiente('${colaId}',${i})" title="Quitar"></button></div>`;
  }).join('')+'</div>';
}
export function limpiarAdjPendientes(colaId){
  delete adjPendientes[colaId];
  const wrap=g('adj-preview-'+colaId);
  if(wrap)wrap.innerHTML='';
}
/* Dropzone idéntica a la de Registro de OT (mismo ícono, texto y
   comportamiento drag&drop), para que Mantenciones se vea con el mismo
   nivel de acabado en toda la app. */
export function renderBarraAdjuntos(colaId){
  return `<div class="ot-dropzone" id="dz-${colaId}"
      onclick="abrirSelectorArchivo(this,(files)=>handleAdjSelected('${colaId}',files))"
      ondragover="event.preventDefault();this.classList.add('drag')"
      ondragleave="this.classList.remove('drag')"
      ondrop="event.preventDefault();this.classList.remove('drag');handleAdjSelected('${colaId}',event.dataTransfer.files)">
      <i class="ti ti-cloud-upload" aria-hidden="true"></i>
      <p>Toca para elegir: cámara, galería o escanear</p>
      <small>JPG, PNG o PDF · máximo 15MB por archivo</small>
    </div>
    <div id="adj-preview-${colaId}"></div>`;
}

export let docsVehiculoActuales=[]; /* usado por verDetalleDocumentoVehiculo para ubicar el documento clickeado */
export function renderDocsList(patente){
  const docs=ensureVehData(patente).documentos;
  if(!docs.length)return '<p class="eval-empty">Sin documentos cargados.</p>';
  const ordenados=docs.slice().sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  docsVehiculoActuales=ordenados.map(d=>({...d,patente}));
  return `<div class="card" style="padding:0;overflow:hidden;margin-bottom:0">`+ordenados.map((d,i)=>{
    const esImagen=(d.mimeType||'').startsWith('image/');
    return `
    <div class="reg-row">
      <div class="reg-row-info">
        <span class="reg-row-fecha">${d.fecha?formatFecha(d.fecha):'—'}</span>
        <span class="reg-row-ot"><i class="ti ${esImagen?'ti-photo':'ti-file-type-pdf'}" aria-hidden="true"></i> ${escapeHtml(d.tipo||'Documento')}</span>
        <span class="reg-row-cliente">${escapeHtml(d.nombreArchivo||'—')}</span>
        <span class="reg-row-badges"><span class="badge b-gar">${esImagen?'Foto':'PDF'}</span></span>
      </div>
      <div class="reg-row-actions">
        <button class="btn-sec btn-sm" onclick="verDetalleDocumentoVehiculo(${i})"><i class="ti ti-eye" aria-hidden="true"></i> Ver detalle</button>
        <button class="btn-del" style="display:inline-flex" title="Eliminar" onclick="eliminarDocumentoVehiculo('${patente.replace(/'/g,"\\'")}','${d.id}')"><i class="ti ti-trash" aria-hidden="true"></i></button>
      </div>
    </div>`;
  }).join('')+`</div>`;
}
/* Detalle completo de un documento del vehículo: fecha, tipo, nombre de
   archivo, quién lo subió y cuándo, más vista previa (foto real o ícono PDF)
   con botones Ver/Descargar — mismo modal y mismo patrón visual que el
   resto de la app usa para "ver detalle". */
export function verDetalleDocumentoVehiculo(idx){
  const d=docsVehiculoActuales[idx];if(!d)return;
  const url=d.storagePath?unidadFotoUrl(d.storagePath):'';
  const esImagen=(d.mimeType||'').startsWith('image/');
  const rows=[
    ['Tipo',d.tipo||'—'],
    ['Fecha',d.fecha?formatFecha(d.fecha):'—'],
    ['Archivo',d.nombreArchivo||'—']
  ];
  if(d.subidoPor||d.creadoPor)rows.push(['Subido por',d.subidoPor||d.creadoPor]);
  if(d.subidoEn)rows.push(['Subido el',formatFechaHora(d.subidoEn)]);
  let html=rows.map(f=>`<div class="regdet-row"><span class="regdet-lbl">${f[0]}</span><span class="regdet-val">${escapeHtml(String(f[1]))}</span></div>`).join('');
  html+=`<p class="sec-lbl" style="margin-top:1rem">Vista previa</p><div class="ef-fotos-grid">
    <div class="ef-foto-card">
      ${esImagen
        ?`<img src="${url}" alt="${escapeHtml(d.nombreArchivo)}" onclick="${url?`window.open('${url}','_blank')`:''}">`
        :`<div class="ef-foto-ph" onclick="${url?`window.open('${url}','_blank')`:''}"><i class="ti ti-file-type-pdf" aria-hidden="true"></i></div>`}
      <div class="ef-foto-meta"><span class="ef-foto-name" title="${escapeHtml(d.nombreArchivo)}">${escapeHtml(d.nombreArchivo)}</span></div>
      <div style="display:flex;gap:6px;padding:0 7px 7px">
        <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="window.open('${url}','_blank')"`:'disabled'}><i class="ti ti-eye" aria-hidden="true"></i> Ver en grande</button>
        <button class="btn-sec btn-sm" style="flex:1" onclick="descargarDocumentoVehiculo('${d.id}','${escapeHtml(d.nombreArchivo)}')"><i class="ti ti-download" aria-hidden="true"></i> Descargar</button>
      </div>
    </div>
  </div>`;
  html+=`<div style="margin-top:1.2rem;padding-top:1rem;border-top:1px solid var(--border-color)">
    <button class="btn-eliminar-evento" onclick="closeMantDetalleModal();eliminarDocumentoVehiculo('${d.patente.replace(/'/g,"\\'")}','${d.id}')"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar este documento</button>
  </div>`;
  g('mant-detalle-modal-body').innerHTML=html;
  g('mant-detail-modal').style.display='flex';
}
/* ---------- Pantalla de Mantenciones: una sola sección ----------
   Antes había 2 paneles separados ("Documentos del vehículo" e "Ingreso de
   mantención"); se unificaron en un solo panel "Mantenciones" para que
   cualquier foto o documento del vehículo — sea de una mantención oficial
   con seguimiento de km, o algo suelto (reparación puntual, permiso, etc.) —
   se cargue desde el mismo lugar. Dentro conviven dos bloques:
   1) Mantención oficial (con seguimiento de km): dropdown de nombre + fecha/
      km/detalle + adjuntos — esto es lo que alimenta el semáforo de Estado
      de Flota.
   2) Otras mantenciones y documentos: nombre libre + fecha + detalle +
      adjuntos, para todo lo que no es una mantención periódica oficial
      (reparaciones puntuales, permisos, boletas, etc.) — vive en
      vehiculoData[patente].items.
   Empieza CERRADO: al tocar el encabezado se despliega. */
export let mantPanelOpen=true;
export function toggleMantPanel(){
  mantPanelOpen=!mantPanelOpen;
  renderMantDetail();
}
/* "Documentos antiguos" (vehiculoData[patente].documentos): documentos
   sueltos cargados con el flujo anterior a la unificación. Ya no se pueden
   agregar nuevos por ahí, pero se mantiene la vista de solo lectura +
   eliminar por si quedó algo cargado con el flujo viejo. */
export let verDocsGuardados=false;
export function toggleVerDocsGuardados(){
  verDocsGuardados=!verDocsGuardados;
  renderMantDetail();
}
export function renderMantDetail(){
  const el=g('mant-detail');
  if(!mantSelected){el.innerHTML='';return;}
  const patente=mantSelected;
  const vd=ensureVehData(patente);
  const sid=safeId(patente);
  const docsAntiguos=vd.documentos||[];

  el.innerHTML=`
  <div class="card" style="--sec-color:#eda100;padding:0;overflow:hidden">
    <div class="mant-panel-head" onclick="toggleMantPanel()">
      <span><i class="ti ti-tool" aria-hidden="true"></i>Mantenciones</span>
      <i class="sub-chevron ${mantPanelOpen?'open':''}" aria-hidden="true"></i>
    </div>
    ${mantPanelOpen?`<div class="mant-panel-body">
      ${renderMantFormUnificado(patente,sid)}
      <hr class="sep">
      ${renderMantHistorialConFiltro(patente)}
      ${docsAntiguos.length?`
      <hr class="sep">
      <div class="sub-accordion-simple">
        <div class="sub-accordion-simple-head" onclick="toggleVerDocsGuardados()">
          <span><i class="ti ti-folder" aria-hidden="true"></i>Documentos antiguos<span class="mant-panel-count">${docsAntiguos.length}</span></span>
          <i class="sub-chevron ${verDocsGuardados?'open':''}" aria-hidden="true"></i>
        </div>
        ${verDocsGuardados?`<div class="sub-accordion-simple-body">${renderDocsList(patente)}</div>`:''}
      </div>`:''}
    </div>`:''}
  </div>`;
  renderPendFab();
}
/* Formulario único de Mantenciones: un solo combo de tipo (escribible, con
   sugerencias del catálogo combinado de Listas: mantenciones + documentos
   del vehículo) + fecha + adjuntos. Reemplaza la antigua separación entre
   "Mantención oficial" (solo catálogo fijo, con ficha única bloqueada) y
   "Otras mantenciones y documentos" (texto libre) — ahora es un solo campo
   y cada guardado agrega una fila nueva al historial (ver
   guardarMantencionUnificada), sin bloqueo de admin. */
export function renderMantFormUnificado(patente,sid){
  const fid='mf_'+sid;
  return `
  <div class="fg">
    <div class="field">
      <label>Tipo de documento</label>
      <div class="mant-combo-wrap">
        <input type="text" id="mf-nombre-${fid}" autocomplete="off" placeholder="Ej: Cambio de Aceite, Permiso de Circulación..." oninput="filtrarComboMantencion('${fid}')" onfocus="filtrarComboMantencion('${fid}')" onblur="cerrarComboMantencion('${fid}')">
        <div class="mant-combo-drop" id="mf-nombre-${fid}-drop" style="display:none"></div>
      </div>
    </div>
    <div class="field"><label>Fecha</label><input type="date" id="mf-fecha-${fid}" value="${new Date().toISOString().slice(0,10)}"></div>
  </div>
  <div class="field" style="margin-top:.5rem"><label>Detalle (opcional)</label><textarea id="mf-detalle-${fid}" rows="2" placeholder="Costo, taller, observaciones..."></textarea></div>
  <div style="margin-top:.7rem">${renderBarraAdjuntos('mfadd_'+fid)}</div>
  <button class="btn" style="margin-top:1rem;width:100%;justify-content:center" onclick="guardarMantencionUnificada('${patente.replace(/'/g,"\\'")}','${sid}')"><i class="ti ti-device-floppy" aria-hidden="true"></i>Guardar</button>`;
}
/* Combo escribible del "Tipo de documento": se arma a mano en vez de usar
   <input list> con <datalist> porque el datalist nativo anda muy
   inconsistente en navegadores móviles (Chrome Android no lo muestra como
   un desplegable real ni filtra bien mientras se escribe). Al enfocar el
   campo muestra todo el catálogo (Listas → mantNombres + docTypes); al
   escribir, lo filtra por coincidencia en cualquier parte del texto (ej.
   escribir "gases" encuentra "Certificado de Homologación de Gases"). Se
   puede elegir una opción o simplemente seguir escribiendo un nombre libre
   que no esté en la lista. */
function catalogoMantenciones(){
  return [...new Set([...(lists.mantNombres||[]),...(lists.docTypes||[])])];
}
export function filtrarComboMantencion(fid){
  const input=g('mf-nombre-'+fid);
  const drop=g('mf-nombre-'+fid+'-drop');
  if(!input||!drop)return;
  const catalogo=catalogoMantenciones();
  const q=(input.value||'').trim().toUpperCase();
  const opciones=q?catalogo.filter(n=>n.toUpperCase().includes(q)):catalogo;
  drop.innerHTML=opciones.length
    ?opciones.map(n=>`<div class="mant-combo-item" onmousedown="event.preventDefault();elegirComboMantencion('${fid}','${n.replace(/'/g,"\\'")}')">${escapeHtml(n)}</div>`).join('')
    :'<div class="mant-combo-empty">Sin coincidencias — puedes dejarlo como nombre libre.</div>';
  drop.style.display='block';
}
export function elegirComboMantencion(fid,valor){
  const input=g('mf-nombre-'+fid);
  if(input)input.value=valor;
  cerrarComboMantencion(fid);
}
/* onmousedown con preventDefault en cada opción evita que el blur del
   input cierre el desplegable ANTES de registrar el click/tap sobre la
   opción — si no, en el celular el tap nunca alcanza a seleccionar nada. */
export function cerrarComboMantencion(fid){
  const drop=g('mf-nombre-'+fid+'-drop');
  if(drop)drop.style.display='none';
}
/* Ventana, en días, para avisar de un posible documento duplicado: mismo
   tipo de mantención subido para la misma patente hace poco. */
export const MANT_VENTANA_DUPLICADO_DIAS=7;
/* Todo input[type=text] de la app se fuerza a mayúsculas al tipear (ver el
   listener global en bootstrap.js) — así que lo que llega acá SIEMPRE viene
   en mayúsculas, sea que lo hayan escrito o elegido del datalist. Sin
   normalizar, "CAMBIO DE ACEITE" no calzaría ni con la clave de
   MANT_PARAMS['Cambio de Aceite'] ni con el "desc" de una regla ya
   guardada en su forma original — quedaría como un tipo nuevo y distinto
   cada vez. Esta función lo hace calzar de vuelta con el nombre tal como
   está en Listas (mantNombres/docTypes) cuando corresponde; si es un
   nombre libre que no está en el catálogo, se deja tal cual llegó. */
function nombreMantencionCanonico(valorIngresado){
  const match=catalogoMantenciones().find(n=>n.toUpperCase()===valorIngresado.toUpperCase());
  return match||valorIngresado;
}
/* Guarda una entrada del historial unificado de Mantenciones. SIEMPRE crea
   una fila nueva en reglasMant (nunca sobreescribe una existente) — así el
   mismo tipo se puede volver a registrar la próxima vez que corresponda,
   sin bloqueo de administrador. Si el tipo tiene un intervalo definido en
   Listas/MANT_PARAMS (las 12 mantenciones mecánicas), Estado de Flota
   calcula un semáforo real; si no (documentos como SOAP, Permiso de
   Circulación, etc.), aparece igual en Estado de Flota pero como "Sin
   intervalo definido" (siempre verde). El kilometraje se auto-asocia con
   kmMasCercano() — no se pide a mano. */
export async function guardarMantencionUnificada(patente,sid){
  const fid='mf_'+sid;
  const nombre=nombreMantencionCanonico((g('mf-nombre-'+fid).value||'').trim());
  const fecha=g('mf-fecha-'+fid).value;
  const detalle=(g('mf-detalle-'+fid).value||'').trim();
  if(!nombre){alert('Indica el tipo de documento (ej: Cambio de Aceite, Permiso de Circulación...).');return;}
  if(!fecha){alert('Falta indicar la fecha.');return;}
  const vd=ensureVehData(patente);
  if(!vd.reglasMant)vd.reglasMant=[];
  const fechaMs=new Date(fecha+'T12:00:00').getTime();
  const posibleDuplicado=vd.reglasMant.some(r=>{
    if((r.desc||'').toUpperCase()!==nombre.toUpperCase()||!r.ultimaFecha)return false;
    const dias=Math.abs(fechaMs-new Date(r.ultimaFecha+'T12:00:00').getTime())/86400000;
    return dias<=MANT_VENTANA_DUPLICADO_DIAS;
  });
  if(posibleDuplicado){
    const seguro=confirm(`Ya se subió un documento de "${nombre}" hace poco para ${patente}.\n\n¿Seguro que es la patente y la mantención correctas?`);
    if(!seguro)return;
  }
  const params=MANT_PARAMS[nombre];
  const modo=params?params.modo:'km';
  const intervaloKm=params&&params.modo==='km'?params.intervaloKm:0;
  const intervaloMeses=params&&params.modo==='tiempo'?params.intervaloMeses:0;
  const kmAuto=kmMasCercano(patente,fecha);
  const regla={
    id:'fm_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    desc:nombre,modo,intervaloKm,intervaloMeses,
    ultimoKm:kmAuto||0,ultimaFecha:fecha,
    detalleTaller:detalle,comentario:'',documentos:[],
    creadoPor:currentUserName(),creadoEn:new Date().toISOString()
  };
  const colaId='mfadd_'+fid;
  const pendientes=adjPendientes[colaId]||[];
  await subirArchivosACola(patente,pendientes,nombre,regla.documentos);
  vd.reglasMant.push(regla);
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){
    vd.reglasMant=vd.reglasMant.filter(x=>x.id!==regla.id);
    alert('No se pudo guardar. Intenta nuevamente.');
    return;
  }
  limpiarAdjPendientes(colaId);
  mostrarToastBar('Mantención guardada con éxito'+(kmAuto?' · '+kmAuto.toLocaleString('es-CL')+' km asociados automáticamente':''));
  renderMantDetail();
  renderEstadoFlota&&renderEstadoFlota();
}
/* Sube una lista de archivos (File[]) al bucket y los agrega al array
   destino, devolviendo cuántos se subieron con éxito. Usado tanto por
   "Documentos del vehículo" como por "Ingreso de mantención". */
export async function subirArchivosACola(patente,files,tipo,destinoArray){
  if(!files.length)return 0;
  if(!sbReady()){alert('Sin conexión a la base de datos, no se pudieron subir los archivos.');return 0;}
  let subidos=0;const fallidos=[];
  for(let file of files){
    if(file.size>15*1024*1024){fallidos.push(file.name+' (supera 15MB)');continue;}
    file=await comprimirImagenSiHaceFalta(file);
    const id=Date.now()+'_'+Math.random().toString(36).slice(2,7);
    const path=patente.replace(/[^a-zA-Z0-9]/g,'_')+'/'+id+'_'+file.name;
    try{
      const{error}=await sb.storage.from('vehiculo-documentos').upload(path,file);
      if(error)throw error;
      destinoArray.push({id,tipo,nombreArchivo:file.name,fecha:new Date().toISOString().slice(0,10),mimeType:file.type,storagePath:path,creadoPor:currentUserName(),subidoPor:currentUserName(),subidoEn:new Date().toISOString()});
      subidos++;
    }catch(err){
      fallidos.push(file.name+' ('+((err&&err.message)||'error al subir')+')');
    }
  }
  if(fallidos.length)alert('Algunos archivos no se pudieron subir:\n'+fallidos.join('\n'));
  return subidos;
}
export function descargarDocumentoVehiculo(id,nombreArchivo){
  if(!sbReady())return;
  let path=null;
  Object.values(vehiculoData).forEach(v=>{(v.documentos||[]).forEach(d=>{if(String(d.id)===String(id))path=d.storagePath;});});
  if(!path){alert('No se pudo encontrar el archivo.');return;}
  const{data}=sb.storage.from('vehiculo-documentos').getPublicUrl(path);
  window.open(data.publicUrl,'_blank');
}
export async function eliminarDocumentoVehiculo(patente,id){
  if(!confirm('¿Eliminar este documento?'))return;
  const vd=ensureVehData(patente);
  const doc=vd.documentos.find(d=>String(d.id)===String(id));
  const ok=await dbDeleteDocumentoVehiculo(id);
  if(!ok)return;
  vd.documentos=vd.documentos.filter(d=>String(d.id)!==String(id));
  if(doc&&doc.storagePath&&sb)sb.storage.from('vehiculo-documentos').remove([doc.storagePath]).catch(()=>{});
  renderMantDetail();
}
export function renderMantFormDocs(patente,entidad,kind){
  const docs=entidad.documentos||[];
  if(!docs.length)return '<p class="eval-empty">Sin documentos cargados.</p>';
  const admin=isAdminUser();
  const delFn=kind==='item'?'eliminarDocumentoItemExtra':'eliminarDocumentoMantForm';
  return `<div class="ef-fotos-grid">`+docs.slice().sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).map(d=>{
    const url=d.storagePath?unidadFotoUrl(d.storagePath):'';
    const esImagen=(d.mimeType||'').startsWith('image/');
    return `
  <div class="ef-foto-card">
    ${esImagen
      ?`<img src="${url}" alt="${escapeHtml(d.nombreArchivo)}" onclick="${url?`window.open('${url}','_blank')`:''}">`
      :`<div class="ef-foto-ph" onclick="${url?`window.open('${url}','_blank')`:''}"><i class="ti ti-file-type-pdf" aria-hidden="true"></i></div>`}
    <div class="ef-foto-meta" style="flex-direction:column;align-items:flex-start;gap:1px">
      <span class="ef-foto-name" title="${escapeHtml(d.nombreArchivo)}" style="max-width:100%">${escapeHtml(d.nombreArchivo)}</span>
      <span class="doc-fecha">${d.fecha?formatFecha(d.fecha):''}${admin&&(d.subidoPor||d.creadoPor)?' · '+escapeHtml(d.subidoPor||d.creadoPor):''}</span>
    </div>
    <div style="display:flex;gap:6px;padding:0 7px 7px">
      <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="window.open('${url}','_blank')"`:'disabled'}><i class="ti ti-eye" aria-hidden="true"></i> Ver</button>
      <button class="btn-sec btn-sm" style="flex:1" onclick="descargarDocumentoVehiculo('${d.id}','${escapeHtml(d.nombreArchivo)}')"><i class="ti ti-download" aria-hidden="true"></i></button>
      ${admin?`<button class="btn-del" style="display:inline-flex" onclick="${delFn}('${patente.replace(/'/g,"\\'")}','${entidad.id}','${d.id}')"><i class="ti ti-trash" aria-hidden="true"></i></button>`:''}
    </div>
  </div>`;}).join('')+`</div>`;
}
export async function eliminarDocumentoMantForm(patente,reglaId,docId){
  if(!isAdminUser()){alert('Solo un administrador puede eliminar un documento ya cargado.');return;}
  if(!confirm('¿Eliminar este documento?'))return;
  const vd=ensureVehData(patente);
  const regla=(vd.reglasMant||[]).find(r=>r.id===reglaId);
  if(!regla)return;
  const doc=(regla.documentos||[]).find(d=>String(d.id)===String(docId));
  const prevDocs=(regla.documentos||[]).slice();
  regla.documentos=(regla.documentos||[]).filter(d=>String(d.id)!==String(docId));
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){regla.documentos=prevDocs;return;}
  if(doc&&doc.storagePath&&sb)sb.storage.from('vehiculo-documentos').remove([doc.storagePath]).catch(()=>{});
  renderMantDetail();
}
export async function eliminarDocumentoItemExtra(patente,itemId,docId){
  if(!isAdminUser()){alert('Solo un administrador puede eliminar un documento ya cargado.');return;}
  if(!confirm('¿Eliminar este documento?'))return;
  const vd=ensureVehData(patente);
  const item=(vd.items||[]).find(x=>x.id===itemId);
  if(!item)return;
  const doc=(item.documentos||[]).find(d=>String(d.id)===String(docId));
  const prevDocs=(item.documentos||[]).slice();
  item.documentos=(item.documentos||[]).filter(d=>String(d.id)!==String(docId));
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){item.documentos=prevDocs;return;}
  if(doc&&doc.storagePath&&sb)sb.storage.from('vehiculo-documentos').remove([doc.storagePath]).catch(()=>{});
  renderMantDetail();
}
/* "Otras mantenciones y documentos" (vehiculoData[patente].items): flujo
   anterior a la unificación, reemplazado por el formulario único de
   Mantenciones (ver renderMantFormUnificado/guardarMantencionUnificada) —
   ya no se agregan items nuevos. Se conserva solo la posibilidad de
   eliminar un item viejo (removeItemExtra) para poder limpiar datos
   cargados con el flujo anterior; siguen mostrándose en el historial
   unificado (buildMantEventos) para no perder nada de lo ya guardado. */
export async function removeItemExtra(patente,id){
  if(!confirm('¿Eliminar este registro?'))return;
  const vd=ensureVehData(patente);
  const prevItems=(vd.items||[]).slice();
  const item=(vd.items||[]).find(x=>x.id===id);
  vd.items=(vd.items||[]).filter(x=>x.id!==id);
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){
    vd.items=prevItems;
    return;
  }
  if(item&&item.documentos&&item.documentos.length&&sb){
    item.documentos.forEach(d=>{if(d.storagePath)sb.storage.from('vehiculo-documentos').remove([d.storagePath]).catch(()=>{});});
  }
  renderMantDetail();
}

/* --- PDF de vehículos --- */
export function buildVehiculoPDFBlock(doc,y,patente,esPrimeraEnPagina){
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  const vd=ensureVehData(patente);
  const km=kmActualVeh(patente);

  y=pdfCheckPageBreak(doc,y,80);
  y+=8;
  if(!esPrimeraEnPagina){
    /* Línea negra gruesa: separa claramente la ficha de un vehículo de la
       ficha del vehículo anterior en el mismo documento. */
    doc.setDrawColor(20,20,20);doc.setLineWidth(1.6);
    doc.line(marginX,y,pageW-marginX,y);
    y+=16;
  }
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(20,20,20);
  doc.text('PATENTE '+patente,marginX,y);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(90);
  doc.text('Estado: '+(vd.estado||'Operativo'),pageW-marginX,y,{align:'right'});
  doc.setTextColor(0);
  y+=6;
  doc.setDrawColor(210);doc.setLineWidth(0.8);
  doc.line(marginX,y,pageW-marginX,y);
  y+=13;
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(110);
  doc.text('Kilometraje actual: '+(km!==null?km.toLocaleString('es-CL')+' km':'Sin registros'),marginX,y);
  doc.setTextColor(0);
  y+=16;

  /* Mantenciones registradas con el formulario genérico (Cambio de aceite,
     Revisión técnica, Cambio de motor, etc), una sección por cada una,
     mostrando su estado "VIGENTE HASTA" con el color del semáforo. */
  const reglas=(vd.reglasMant||[]).filter(r=>r.detalleTaller||r.comentario||r.ultimoKm||r.ultimaFecha||(r.documentos&&r.documentos.length));
  if(reglas.length){
    reglas.forEach(r=>{
      const est=calcEstadoReglaFlota(r,patente);
      y=pdfSectionBar(doc,y,marginX,pageW,(r.desc||'MANTENCIÓN').toUpperCase()+' — '+est.vigenteTexto,clsToRGB(est.estado==='rojo'?'bajo':(est.estado==='amarillo'?'medio':'alto')));
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);
      const refTxt=r.modo==='km'?`KM del último cambio: ${r.ultimoKm?Number(r.ultimoKm).toLocaleString('es-CL'):'—'}`:`Última fecha: ${r.ultimaFecha?formatFecha(r.ultimaFecha):'—'}`;
      doc.text(refTxt,marginX,y);y+=11;
      if(r.detalleTaller){
        const lines=doc.splitTextToSize('Detalle / taller: '+r.detalleTaller,pageW-marginX*2);
        doc.text(lines,marginX,y);y+=lines.length*10+4;
      }
      if(r.comentario){
        const lines=doc.splitTextToSize('Comentario: '+r.comentario,pageW-marginX*2);
        doc.text(lines,marginX,y);y+=lines.length*10+4;
      }
      y+=8;
    });
  }else{
    y=pdfSectionBar(doc,y,marginX,pageW,'MANTENCIONES PROGRAMADAS',[100,116,139]);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(140);
    doc.text('Sin mantenciones registradas todavía.',marginX,y);y+=14;
    doc.setTextColor(0);
    y+=6;
  }

  const items=vd.items||[];
  if(items.length){
    y=pdfSectionBar(doc,y,marginX,pageW,'OTRAS MANTENCIONES Y DOCUMENTOS',[100,116,139]);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    items.forEach(it=>{
      y=pdfCheckPageBreak(doc,y,18);
      const nDocs=(it.documentos||[]).length;
      const txt=`•  ${it.nombre} — ${it.fecha?formatFecha(it.fecha):'sin fecha'}${it.detalle?': '+it.detalle:''}${nDocs?' ('+nDocs+' doc. adjunto'+(nDocs===1?'':'s')+')':''}`;
      const lines=doc.splitTextToSize(txt,pageW-marginX*2);
      doc.text(lines,marginX,y);y+=lines.length*10+4;
    });
    y+=6;
  }

  const docs=vd.documentos||[];
  y=pdfSectionBar(doc,y,marginX,pageW,'DOCUMENTOS REGISTRADOS',[42,120,214]);
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);
  if(!docs.length){
    doc.setTextColor(140);
    doc.text('Sin documentos cargados.',marginX,y);y+=14;
    doc.setTextColor(0);
  }else{
    docs.forEach(d=>{
      y=pdfCheckPageBreak(doc,y,14);
      doc.text(`•  ${d.tipo} — ${d.nombreArchivo} (${d.fecha?formatFecha(d.fecha):''})`,marginX,y);y+=12;
    });
  }
  y+=10;

  if(vd.detalle){
    y=pdfSectionBar(doc,y,marginX,pageW,'ESPECIFICACIÓN / COMENTARIO DEL ENCARGADO',[100,116,139]);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    const lines=doc.splitTextToSize(vd.detalle,pageW-marginX*2);
    y=pdfCheckPageBreak(doc,y,lines.length*10+6);
    doc.text(lines,marginX,y);y+=lines.length*10+4;
  }
  return y+22;
}
/* Junta las fotos (imágenes, no PDFs) de "Otras mantenciones y documentos"
   de un vehículo, para la página de fotos al final de su ficha en PDF. */
function fotosDeItems(vd){
  const fotos=[];
  (vd.items||[]).forEach(it=>{
    (it.documentos||[]).forEach(d=>{
      if((d.mimeType||'').startsWith('image/'))fotos.push({url:unidadFotoUrl(d.storagePath),nombre:it.nombre||d.nombreArchivo||'Foto'});
    });
  });
  return fotos;
}
export async function exportVehiculoPDF(patente){
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF. Revisa tu conexión e intenta de nuevo.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  const pageH=doc.internal.pageSize.getHeight();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'PATENTE '+patente,`Generado el ${new Date().toLocaleDateString('es-CL')}`);
  buildVehiculoPDFBlock(doc,y,patente,true);
  const vd=ensureVehData(patente);
  const fotosMant=fotosDeItems(vd);
  await pdfAddPhotosPage(doc,pageW,pageH,marginX,[{titulo:'PATENTE '+patente,fotos:fotosMant}]);
  doc.save(`Vehiculo_${safeId(patente)}.pdf`);
}
export async function exportAllVehiculosPDF(){
  if(!lists.vehiculos.length){alert('No hay vehículos cargados.');return;}
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF. Revisa tu conexión e intenta de nuevo.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  const pageH=doc.internal.pageSize.getHeight();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'Fichas de vehículos',`Generado el ${new Date().toLocaleDateString('es-CL')}`);
  lists.vehiculos.forEach((p,i)=>{y=buildVehiculoPDFBlock(doc,y,p,i===0);});
  const grupos=lists.vehiculos.map(p=>{
    const vd=ensureVehData(p);
    return{titulo:'PATENTE '+p,fotos:fotosDeItems(vd)};
  });
  await pdfAddPhotosPage(doc,pageW,pageH,marginX,grupos);
  doc.save('Vehiculos_Todos.pdf');
}
