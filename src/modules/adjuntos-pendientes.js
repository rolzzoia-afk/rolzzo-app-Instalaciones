import { dbDeleteDocumentoVehiculo, dbUpsertVehiculo, sb, sbReady } from './bootstrap.js';
import { MANT_PARAMS, lists, mantSelected, registros, unidades, vehiculoData } from './core-data.js';
import { calcEstadoReglaFlota, renderEstadoFlota } from './estado-flota.js';
import { escapeHtml, formatFecha, formatFechaHora, isAdminUser, safeId } from './evaluaciones.js';
import { clsToRGB, pdfCheckPageBreak, pdfDrawHeader, pdfDrawTitleBlock, pdfSectionBar } from './evaluaciones-pdf.js';
import { g } from './form-helpers.js';
import { ensureVehData, kmActualVeh } from './mantenciones-vehiculos.js';
import { flashGuardado, setEstadoVehiculo } from './periodo-helpers.js';
import { renderPendFab } from './pendientes-vehiculo.js';
import { guardar, mostrarToastBar } from './registro-adjuntos.js';
import { addMantNombreQuick, closeMantDetalleModal, currentUserName, unidadFotoUrl } from './reportes-unidad.js';
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
export let mantPanelOpen=false;
export function toggleMantPanel(){
  mantPanelOpen=!mantPanelOpen;
  renderMantDetail();
}
/* "Documentos antiguos" (vehiculoData[patente].documentos): documentos
   sueltos cargados con el flujo anterior. Ya no se pueden agregar nuevos
   por ahí (reemplazado por "Otras mantenciones y documentos" arriba), pero
   se mantiene la vista de solo lectura + eliminar por si quedó algo
   cargado con el flujo viejo. */
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
  const pSafe=patente.replace(/'/g,"\\'");
  const km=kmActualVeh(patente);
  const docsAntiguos=vd.documentos||[];
  const totalCargado=(vd.reglasMant||[]).reduce((n,r)=>n+((r.documentos||[]).length),0)
    +(vd.items||[]).reduce((n,it)=>n+((it.documentos||[]).length),0)
    +docsAntiguos.length;

  el.innerHTML=`
  <datalist id="mei-sugerencias">${[...(lists.mantNombres||[]),...(lists.docTypes||[])].map(n=>`<option value="${escapeHtml(n)}">`).join('')}</datalist>
  <div class="card" style="--sec-color:#eda100">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:.4rem">
      <p class="card-title" style="margin:0;padding:0;border:none"><i class="ti ti-car" aria-hidden="true"></i>${escapeHtml(patente)}</p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="dl-btn" onclick="exportVehiculoPDF('${pSafe}')" title="Descargar ficha en PDF"><i class="ti ti-download" aria-hidden="true"></i>PDF</button>
        <select id="mant-estado-${sid}" onchange="setEstadoVehiculo('${pSafe}',this.value)" style="width:auto">
          <option ${vd.estado==='Operativo'?'selected':''}>Operativo</option>
          <option ${vd.estado==='En taller'?'selected':''}>En taller</option>
          <option ${vd.estado==='Fuera de servicio'?'selected':''}>Fuera de servicio</option>
        </select>
      </div>
    </div>
    <p style="font-size:11.5px;color:var(--text-muted);margin:0 0 .9rem">Kilometraje actual (según Unidad → Registro): <b>${km!==null?km.toLocaleString('es-CL')+' km':'Sin registros'}</b></p>
    <div class="field" style="margin:0">
      <label>Datos del vehículo</label>
      <textarea id="veh-detalle-${sid}" rows="2" placeholder="Ej: Marca, modelo, año, N° de chasis, u otras especificaciones y notas generales del vehículo...">${escapeHtml(vd.detalle||'')}</textarea>
    </div>
    <button class="btn-sec btn-sm" id="veh-detalle-btn-${sid}" style="margin-top:.6rem" onclick="guardarDetalleVehiculo('${sid}')"><i class="ti ti-device-floppy" aria-hidden="true"></i>Guardar datos del vehículo</button>
  </div>

  <div class="card" style="--sec-color:#eda100;padding:0;overflow:hidden">
    <div class="mant-panel-head" onclick="toggleMantPanel()">
      <span><i class="ti ti-tool" aria-hidden="true"></i>Mantenciones<span class="mant-panel-count">${totalCargado}</span></span>
      <i class="sub-chevron ${mantPanelOpen?'open':''}" aria-hidden="true"></i>
    </div>
    ${mantPanelOpen?`<div class="mant-panel-body">
      <p class="sec-lbl">Mantención oficial (con seguimiento de kilometraje)</p>
      ${renderIngresoMantencion(patente,sid)}
      <hr class="sep">
      <p class="sec-lbl">Otras mantenciones y documentos</p>
      ${renderItemsExtra(patente,sid)}
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
export async function guardarDetalleVehiculo(sid){
  const patente=mantSelected;
  if(!patente)return;
  const el=g('veh-detalle-'+sid);
  if(!el)return;
  const vd=ensureVehData(patente);
  const prev=vd.detalle;
  vd.detalle=el.value;
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){vd.detalle=prev;return;}
  flashGuardado(g('veh-detalle-btn-'+sid));
}
/* Bloque "Ingreso de mantención": dropdown de nombre + fecha/km/detalle +
   adjuntos. Si el nombre elegido ya tiene un registro guardado y quien
   mira no es admin, se bloquea la edición (solo puede corregirlo un
   administrador desde Estado de Flota o el detalle en Reportes). */
export let ingresoMantNombre=null;
export function __set_ingresoMantNombre(v){ ingresoMantNombre = v; }
export function renderIngresoMantencion(patente,sid){
  const vd=ensureVehData(patente);
  const nombres=lists.mantNombres||[];
  if(!nombres.length){
    return '<p class="eval-empty" style="margin:0">No hay nombres de mantención en Listas todavía. <span class="patente-chip patente-chip-add" onclick="addMantNombreQuick()" title="Agregar nombre de mantención"><i class="ti ti-plus" aria-hidden="true"></i> Agregar en Listas</span></p>';
  }
  if(!ingresoMantNombre||!nombres.includes(ingresoMantNombre))__set_ingresoMantNombre(nombres[0]);
  const nombre=ingresoMantNombre;
  const params=MANT_PARAMS[nombre];
  let regla=(vd.reglasMant||[]).find(r=>r.desc===nombre);
  const yaRegistrada=!!(regla&&(regla.ultimoKm||regla.ultimaFecha||(regla.documentos&&regla.documentos.length)));
  const bloqueado=yaRegistrada&&!isAdminUser();
  const modo=regla?regla.modo:(params?params.modo:'km');
  const fid='im_'+sid;
  let html=`<div class="field" style="margin-bottom:.8rem">
    <label>Mantención</label>
    <select id="im-nombre-${sid}" onchange="ingresoMantNombre=this.value;renderMantDetail()">
      ${nombres.map(n=>`<option value="${escapeHtml(n)}" ${n===nombre?'selected':''}>${escapeHtml(n)}</option>`).join('')}
    </select>
  </div>`;
  if(bloqueado){
    html+=`<p style="font-size:11.5px;color:var(--text-muted);margin:.6rem 0">Esta mantención ya fue registrada${regla.ultimaFecha?' el '+formatFecha(regla.ultimaFecha):''}${regla.ultimoKm?' ('+Number(regla.ultimoKm).toLocaleString('es-CL')+' km)':''}. Si el dato está mal, pide a un administrador que lo corrija.</p>`;
    if(regla.documentos&&regla.documentos.length){
      html+=`<p class="sec-lbl" style="margin-bottom:.4rem">Documento cargado</p>${renderMantFormDocs(patente,regla)}`;
    }
    /* La corrección de fecha/km/detalle sigue reservada a un administrador,
       pero cualquiera puede seguir adjuntando respaldo adicional (boletas,
       fotos, etc.) aunque la mantención ya esté registrada. */
    html+=`<p class="sec-lbl" style="margin:.9rem 0 .4rem">Agregar más documentos</p>
      <div>${renderBarraAdjuntos('mantadd_'+fid)}</div>
      <button class="btn" style="margin-top:1rem;width:100%;justify-content:center" onclick="agregarDocumentosIngresoMantencion('${patente.replace(/'/g,"\\'")}','${fid}','${regla.id}')"><i class="ti ti-paperclip" aria-hidden="true"></i>Agregar documentos</button>`;
    return html;
  }
  const intervaloKmPreview=params?(params.modo==='km'?params.intervaloKm:0):((regla&&regla.intervaloKm)||0);
  const intervaloMesesPreview=params?(params.modo==='tiempo'?params.intervaloMeses:0):((regla&&regla.intervaloMeses)||0);
  /* Fecha y kilometraje se piden SIEMPRE juntos, para cualquier mantención,
     sin importar si su intervalo se mide en km o en meses — el modo solo
     define cómo se calcula el semáforo en Estado de Flota, pero los campos
     del formulario no cambian ni se ocultan según eso. */
  html+=`<input type="hidden" id="mf-modo-${fid}" value="${modo}">
    <div class="fg">
      <div class="field"><label>Fecha</label><input type="date" id="mf-fecha-${fid}" value="${(regla&&regla.ultimaFecha)||''}"></div>
      <div class="field"><label>Kilometraje en que se hizo</label><input type="number" id="mf-km-ultimo-${fid}" value="${(regla&&regla.ultimoKm)||''}" placeholder="Ej: 10000"></div>
    </div>
    <p style="font-size:10.5px;color:var(--text-muted);margin:-.3rem 0 .7rem">${modo==='km'?'Esta mantención se hace cada '+Number(intervaloKmPreview||0).toLocaleString('es-CL')+' km.':(intervaloMesesPreview?'Esta mantención se hace cada '+intervaloMesesPreview+' meses.':'')}</p>
    <div class="field" style="margin-top:.7rem"><label>Detalle / taller</label><input type="text" id="mf-detalle-${fid}" value="${escapeHtml((regla&&regla.detalleTaller)||'')}" placeholder="Ej: Taller Pérez, repuesto original"></div>
    <div class="field" style="margin-top:.6rem"><label>Comentario</label><textarea id="mf-comentario-${fid}" rows="2" placeholder="Notas adicionales sobre esta mantención">${escapeHtml((regla&&regla.comentario)||'')}</textarea></div>`;
  if(regla&&regla.documentos&&regla.documentos.length){
    html+=`<div style="margin-top:.9rem"><p class="sec-lbl" style="margin-bottom:.4rem">Documentos ya cargados</p>${renderMantFormDocs(patente,regla)}</div>`;
  }
  html+=`<div style="margin-top:.9rem">${renderBarraAdjuntos('mant_'+fid)}</div>
    <button class="btn" style="margin-top:1rem;width:100%;justify-content:center" onclick="guardarIngresoMantencion('${patente.replace(/'/g,"\\'")}','${fid}','${nombre.replace(/'/g,"\\'")}')"><i class="ti ti-device-floppy" aria-hidden="true"></i>Guardar mantención</button>`;
  return html;
}
/* Cuadro grande y protagonista con el estado semáforo (verde/amarillo/rojo)
   y el texto "VIGENTE HASTA: ..." o "VENCIDO · ...". */
export function renderMantVigenteBox(est){
  return `<div class="mant-vigente-box ${est.estado}">
    <i class="ti ${est.estado==='rojo'?'ti-alert-triangle':(est.estado==='amarillo'?'ti-clock':'ti-circle-check')}" aria-hidden="true"></i>
    <span>${escapeHtml(est.vigenteTexto)}</span>
  </div>`;
}
/* Guarda el bloque "Ingreso de mantención": crea o actualiza la regla en
   reglasMant (misma fuente que usa Estado de Flota) y sube los archivos
   pendientes de su cola. Fecha y kilometraje se piden siempre juntos, para
   cualquier mantención — Estado de Flota usa ese kilometraje para calcular
   cuándo corresponde la próxima, según el intervalo propio de cada tipo de
   mantención (definido en MANT_PARAMS). */
export async function guardarIngresoMantencion(patente,fid,nombre){
  const vd=ensureVehData(patente);
  if(!vd.reglasMant)vd.reglasMant=[];
  let regla=vd.reglasMant.find(r=>r.desc===nombre);
  const esNueva=!regla;
  if(!esNueva&&(regla.ultimoKm||regla.ultimaFecha||(regla.documentos&&regla.documentos.length))&&!isAdminUser()){
    alert('Esta mantención ya fue registrada. Solo un administrador puede corregirla.');
    return;
  }
  if(!regla){regla={id:'fm_'+Date.now(),desc:nombre,documentos:[],creadoPor:currentUserName(),creadoEn:new Date().toISOString()};vd.reglasMant.push(regla);}
  regla.editadoPor=currentUserName();
  regla.editadoEn=new Date().toISOString();
  const params=MANT_PARAMS[nombre];
  if(params){
    regla.modo=params.modo;
    regla.intervaloKm=params.modo==='km'?params.intervaloKm:0;
    regla.intervaloMeses=params.modo==='tiempo'?params.intervaloMeses:0;
  }else{
    regla.modo=g('mf-modo-'+fid).value||'km';
    regla.intervaloKm=0;regla.intervaloMeses=0;
  }
  const kmIngresado=parseInt(g('mf-km-ultimo-'+fid).value)||0;
  const fechaIngresada=g('mf-fecha-'+fid).value||'';
  if(!fechaIngresada){
    alert('Falta indicar la fecha en que se hizo esta mantención.');
    return;
  }
  if(!kmIngresado){
    const kmA=kmActualVeh(patente);
    if(kmA!==null&&kmA>0){
      alert('Falta indicar el kilometraje en que se hizo esta mantención. El vehículo ya registra '+kmA.toLocaleString('es-CL')+' km — ingresa ese valor (o el km exacto) para que el cálculo de la próxima mantención sea correcto.');
      return;
    }
  }
  regla.ultimoKm=kmIngresado;
  regla.ultimaFecha=fechaIngresada;
  regla.detalleTaller=g('mf-detalle-'+fid).value;
  regla.comentario=g('mf-comentario-'+fid).value;
  if(!regla.documentos)regla.documentos=[];
  const colaId='mant_'+fid;
  const pendientes=adjPendientes[colaId]||[];
  const subidos=await subirArchivosACola(patente,pendientes,nombre,regla.documentos);
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){alert('No se pudo guardar. Intenta nuevamente.');return;}
  limpiarAdjPendientes(colaId);
  mostrarToastBar('Mantención guardada con éxito');
  /* Tras guardar, el formulario vuelve a quedar en blanco: se selecciona la
     primera mantención de la lista que todavía no tenga datos registrados,
     para que la persona pueda seguir cargando la siguiente sin ver los
     datos que recién ingresó (esos quedan disponibles en Reportes de
     Unidad → Mantenciones, y en Estado de Flota). Si ya no queda ninguna
     mantención pendiente, vuelve a la primera de la lista. */
  const nombresList=lists.mantNombres||[];
  const siguienteSinRegistrar=nombresList.find(n=>{
    const r=(vd.reglasMant||[]).find(x=>x.desc===n);
    return !r||!(r.ultimoKm||r.ultimaFecha);
  });
  __set_ingresoMantNombre(siguienteSinRegistrar||nombresList[0]||null);
  renderMantDetail();
  renderEstadoFlota&&renderEstadoFlota();
}
/* Permite agregar más documentos a una mantención que ya fue registrada,
   sin tocar fecha/km/detalle/comentario (esos siguen reservados a un
   administrador vía guardarIngresoMantencion). A diferencia de esa función,
   esta NO exige ser admin: cualquiera puede seguir adjuntando respaldo. */
export async function agregarDocumentosIngresoMantencion(patente,fid,reglaId){
  const vd=ensureVehData(patente);
  const regla=(vd.reglasMant||[]).find(r=>r.id===reglaId);
  if(!regla)return;
  const colaId='mantadd_'+fid;
  const pendientes=adjPendientes[colaId]||[];
  if(!pendientes.length){
    alert('No hay ningún archivo elegido todavía. Toca el recuadro para elegir cámara, galería o escanear.');
    return;
  }
  if(!regla.documentos)regla.documentos=[];
  const subidos=await subirArchivosACola(patente,pendientes,regla.desc,regla.documentos);
  if(!subidos){renderMantDetail();return;}
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){alert('No se pudo guardar en la base de datos. Intenta nuevamente.');return;}
  limpiarAdjPendientes(colaId);
  mostrarToastBar('Documento agregado con éxito');
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
/* "Otras mantenciones y documentos": reemplaza al antiguo panel separado
   "Documentos del vehículo". Nombre libre (con sugerencias de mantNombres +
   docTypes vía <datalist>) + fecha + detalle + adjuntos, para todo lo que no
   es una mantención periódica oficial: reparaciones puntuales, permisos,
   boletas, etc. Usa la misma cola de adjuntos (adjPendientes) y el mismo
   dropzone que el resto de la app, y guarda los documentos con la misma
   forma que regla.documentos para poder reusar renderMantFormDocs. */
export function renderItemsExtra(patente,sid){
  const vd=ensureVehData(patente);
  const items=(vd.items||[]).slice().sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const pSafe=patente.replace(/'/g,"\\'");
  let html='';
  if(items.length){
    html+=items.map(it=>`
    <div class="eval-section">
      <div class="eval-section-head">
        <span class="eval-section-title">${escapeHtml(it.nombre)}<span class="eval-section-date">${it.fecha?formatFecha(it.fecha):''}</span></span>
        <button class="btn-del" onclick="removeItemExtra('${pSafe}','${it.id}')" title="Eliminar"><i class="ti ti-trash" aria-hidden="true"></i></button>
      </div>
      ${it.detalle?`<p style="font-size:11.5px;color:var(--text-secondary);white-space:pre-wrap">${escapeHtml(it.detalle)}</p>`:''}
      ${renderMantFormDocs(patente,it,'item')}
    </div>`).join('');
  }else{
    html+='<p class="eval-empty">Sin otras mantenciones ni documentos registrados todavía.</p>';
  }
  html+=`
  <div class="fg" style="margin-top:.8rem">
    <div class="field"><label>Nombre</label><input type="text" id="mei-nombre-${sid}" list="mei-sugerencias" placeholder="Ej: Reparación de cableado, Permiso de circulación..."></div>
    <div class="field"><label>Fecha</label><input type="date" id="mei-fecha-${sid}"></div>
  </div>
  <div class="field" style="margin-top:.5rem"><label>Detalle (opcional)</label><textarea id="mei-detalle-${sid}" rows="2" placeholder="Costo, taller, observaciones..."></textarea></div>
  <div style="margin-top:.7rem">${renderBarraAdjuntos('itemadd_'+sid)}</div>
  <button class="btn btn-sm" style="margin-top:.7rem" onclick="addItemExtra('${pSafe}','${sid}')"><i class="ti ti-plus" aria-hidden="true"></i>Agregar</button>`;
  return html;
}
export async function addItemExtra(patente,sid){
  const nombre=g('mei-nombre-'+sid).value.trim();
  const fecha=g('mei-fecha-'+sid).value;
  const detalle=g('mei-detalle-'+sid).value.trim();
  if(!nombre){alert('Ponle un nombre (ej: Reparación de cableado, Permiso de circulación...).');return;}
  if(!fecha){alert('Falta indicar la fecha.');return;}
  const vd=ensureVehData(patente);
  if(!vd.items)vd.items=[];
  const item={id:Date.now()+'_'+Math.random().toString(36).slice(2,6),nombre,fecha,detalle,documentos:[],creadoPor:currentUserName(),creadoEn:new Date().toISOString()};
  const colaId='itemadd_'+sid;
  const pendientes=adjPendientes[colaId]||[];
  await subirArchivosACola(patente,pendientes,nombre,item.documentos);
  vd.items.push(item);
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){
    vd.items=vd.items.filter(x=>x.id!==item.id);
    return;
  }
  limpiarAdjPendientes(colaId);
  mostrarToastBar('Registro agregado con éxito');
  renderMantDetail();
}
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
