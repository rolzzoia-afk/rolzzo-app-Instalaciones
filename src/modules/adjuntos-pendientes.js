import { dbDeleteDocumentoVehiculo, dbUpsertVehiculo, sb, sbReady } from './bootstrap.js';
import { MANT_PARAMS, lists, mantSelected, registros, unidades, vehiculoData } from './core-data.js';
import { calcEstadoReglaFlota, renderEstadoFlota } from './estado-flota.js';
import { escapeHtml, formatFecha, formatFechaHora, isAdminUser, safeId } from './evaluaciones.js';
import { clsToRGB, pdfCheckPageBreak, pdfDrawHeader, pdfDrawTitleBlock, pdfSectionBar } from './evaluaciones-pdf.js';
import { g } from './form-helpers.js';
import { ensureVehData, kmActualVeh } from './mantenciones-vehiculos.js';
import { setEstadoVehiculo } from './periodo-helpers.js';
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
/* ---------- Pantalla de Mantenciones: 2 paneles colapsables ----------
   1) Documentos del vehículo: cualquier documento suelto (permiso, seguro,
      boletas, etc.), sin asociarlo a una mantención específica.
   2) Ingreso de mantención: elegir qué mantención es (dropdown), poner
      fecha/km/detalle y adjuntar su respaldo — esto es lo que alimenta el
      semáforo de Estado de Flota.
   Ambos empiezan CERRADOS: al tocar el encabezado se despliegan. Sin
   listas de historial ni semáforos en esta pantalla — eso vive en Estado
   de Flota y en Reportes. */
export let mantPanelOpen={docs:false,ingreso:false};
export function toggleMantPanel(panel){
  mantPanelOpen[panel]=!mantPanelOpen[panel];
  renderMantDetail();
}
/* Tipo de documento elegido en el dropdown de "Documentos del vehículo"
   (Permiso de Circulación, SOAP, Seguro, etc.) — se guarda en memoria para
   que no se pierda al re-renderizar mientras la persona sigue eligiendo
   archivos. La lista de documentos ya guardados vive en un sub-panel aparte
   y cerrado por defecto, para que la zona de carga siempre se vea vacía
   apenas se guarda (y quede lista para el siguiente documento). */
export let vehDocTipoSel=null;
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
  const docs=vd.documentos||[];

  el.innerHTML=`
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
    <p style="font-size:11.5px;color:var(--text-muted);margin:0">Kilometraje actual (según Unidad → Registro): <b>${km!==null?km.toLocaleString('es-CL')+' km':'Sin registros'}</b></p>
  </div>

  <div class="card" style="--sec-color:#eda100;padding:0;overflow:hidden">
    <div class="mant-panel-head" onclick="toggleMantPanel('docs')">
      <span><i class="ti ti-folder" aria-hidden="true"></i>Documentos del vehículo<span class="mant-panel-count">${docs.length}</span></span>
      <i class="sub-chevron ${mantPanelOpen.docs?'open':''}" aria-hidden="true"></i>
    </div>
    ${mantPanelOpen.docs?`<div class="mant-panel-body">
      <div class="field" style="margin-bottom:.8rem">
        <label>Tipo de documento</label>
        <select id="vehdoc-tipo-${sid}">
          ${(lists.docTypes||[]).map(t=>`<option value="${escapeHtml(t)}" ${t===vehDocTipoSel?'selected':''}>${escapeHtml(t)}</option>`).join('')}
        </select>
      </div>
      ${renderBarraAdjuntos('vehdoc_'+sid)}
      <button class="btn" style="margin-top:1rem;width:100%;justify-content:center" onclick="guardarDocumentosVehiculo('${sid}')"><i class="ti ti-device-floppy" aria-hidden="true"></i>Guardar documentos</button>
      <div class="sub-accordion-simple" style="margin-top:1.1rem">
        <div class="sub-accordion-simple-head" onclick="toggleVerDocsGuardados()">
          <span><i class="ti ti-eye" aria-hidden="true"></i>Ver documentos ya cargados<span class="mant-panel-count">${docs.length}</span></span>
          <i class="sub-chevron ${verDocsGuardados?'open':''}" aria-hidden="true"></i>
        </div>
        ${verDocsGuardados?`<div class="sub-accordion-simple-body"><div id="mant-docs-list-${sid}">${renderDocsList(patente)}</div></div>`:''}
      </div>
    </div>`:''}
  </div>

  <div class="card" style="--sec-color:#eda100;padding:0;overflow:hidden">
    <div class="mant-panel-head" onclick="toggleMantPanel('ingreso')">
      <span><i class="ti ti-tool" aria-hidden="true"></i>Ingreso de mantención</span>
      <i class="sub-chevron ${mantPanelOpen.ingreso?'open':''}" aria-hidden="true"></i>
    </div>
    ${mantPanelOpen.ingreso?`<div class="mant-panel-body">${renderIngresoMantencion(patente,sid)}</div>`:''}
  </div>`;
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
/* Guarda el bloque "Documentos del vehículo": sube todos los archivos
   pendientes de su cola como documentos sueltos (no asociados a una
   mantención específica). */
export async function guardarDocumentosVehiculo(sid){
  const patente=mantSelected;
  if(!patente)return;
  const colaId='vehdoc_'+sid;
  const pendientes=adjPendientes[colaId]||[];
  if(!pendientes.length){
    alert('No hay ningún archivo elegido todavía. Toca el recuadro para elegir cámara, galería o escanear.');
    return;
  }
  const tipoEl=g('vehdoc-tipo-'+sid);
  const tipo=(tipoEl&&tipoEl.value)||(lists.docTypes&&lists.docTypes[0])||'Documento';
  vehDocTipoSel=tipo;
  const vd=ensureVehData(patente);
  const subidos=await subirArchivosACola(patente,pendientes,tipo,vd.documentos);
  if(!subidos){renderMantDetail();return;}
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){alert('No se pudo guardar en la base de datos. Intenta nuevamente.');return;}
  limpiarAdjPendientes(colaId);
  mostrarToastBar('Documentos guardados con éxito');
  renderMantDetail();
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
export function renderMantFormDocs(patente,regla){
  const docs=regla.documentos||[];
  if(!docs.length)return '<p class="eval-empty">Sin documentos cargados para esta mantención.</p>';
  const admin=isAdminUser();
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
      ${admin?`<button class="btn-del" style="display:inline-flex" onclick="eliminarDocumentoMantForm('${patente.replace(/'/g,"\\'")}','${regla.id}','${d.id}')"><i class="ti ti-trash" aria-hidden="true"></i></button>`:''}
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
export function renderItemsExtra(patente,sid){
  const vd=ensureVehData(patente);
  const items=vd.items||[];
  const pSafe=patente.replace(/'/g,"\\'");
  let html='';
  if(items.length){
    html+=items.slice().sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).map(it=>{
      const archivos=(it.archivos&&it.archivos.length)?it.archivos:(it.fotoPath?[{path:it.fotoPath,nombre:it.nombre||'Foto'}]:[]);
      const galeria=archivos.length?`<div class="ef-fotos-grid" style="margin-top:.5rem">`+archivos.map((a,ai)=>{
        const url=unidadFotoUrl(a.path);
        const esImg=/\.(jpe?g|png|webp)$/i.test(a.nombre||'');
        const media=esImg?`<img src="${url}" alt="${escapeHtml(a.nombre||'')}" onclick="${url?`window.open('${url}','_blank')`:''}">`:`<div class="ef-foto-ph" onclick="${url?`window.open('${url}','_blank')`:''}"><i class="ti ti-file-type-pdf" aria-hidden="true"></i></div>`;
        return `<div class="ef-foto-card">${media}<div class="ef-foto-meta"><span class="ef-foto-name" title="${escapeHtml(a.nombre||'')}">${escapeHtml(a.nombre||'')}</span></div><div style="display:flex;gap:6px;padding:0 7px 7px">
          <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="window.open('${url}','_blank')"`:'disabled'}><i class="ti ti-eye" aria-hidden="true"></i> Ver</button>
          <button class="btn-del" onclick="removeItemExtraArchivo('${pSafe}','${it.id}',${ai})" title="Quitar archivo"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div></div>`;
      }).join('')+`</div>`:'';
      return `
    <div class="eval-section">
      <div class="eval-section-head">
        <span class="eval-section-title">${escapeHtml(it.nombre)}<span class="eval-section-date">${it.fecha?formatFecha(it.fecha):''}</span></span>
        <button class="btn-del" onclick="removeItemExtra('${pSafe}','${it.id}')" title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button>
      </div>
      ${it.detalle?`<p style="font-size:11.5px;color:var(--text-secondary)">${escapeHtml(it.detalle)}</p>`:''}
      ${galeria}
    </div>`;
    }).join('');
  }else{
    html+='<p class="eval-empty">Sin otras mantenciones registradas.</p>';
  }
  html+=`
  <div class="fg" style="margin-top:.8rem">
    <div class="field"><label>Nombre (ej: Cambio de neumáticos)</label><input type="text" id="mei-nombre-${sid}" placeholder="Nombre de la mantención"></div>
    <div class="field"><label>Fecha</label><input type="date" id="mei-fecha-${sid}"></div>
  </div>
  <div class="fg" style="margin-top:.5rem">
    <div class="field"><label>Detalle (opcional)</label><input type="text" id="mei-detalle-${sid}" placeholder="Detalle adicional"></div>
    <div class="field"><label>Fotos o documentos (uno o varios)</label><input type="file" id="mei-foto-${sid}" accept=".jpg,.jpeg,.png,.webp,.pdf" multiple style="text-transform:none" data-filesrc="Elegir archivo(s)"></div>
  </div>
  <button class="btn btn-sm" style="margin-top:.7rem" onclick="addItemExtra('${pSafe}','${sid}')"><i class="ti ti-plus" aria-hidden="true"></i>Agregar mantención</button>`;
  return html;
}
export async function addItemExtra(patente,sid){
  const nombre=g('mei-nombre-'+sid).value.trim();
  const fecha=g('mei-fecha-'+sid).value;
  const detalle=g('mei-detalle-'+sid).value.trim();
  if(!nombre){alert('Ponle un nombre a la mantención (ej: Cambio de neumáticos).');return;}
  const vd=ensureVehData(patente);
  if(!vd.items)vd.items=[];
  const item={id:Date.now()+'_'+Math.random().toString(36).slice(2,6),nombre,fecha,detalle,fotoPath:null,archivos:[]};
  const fileInput=g('mei-foto-'+sid);
  const files=fileInput?Array.from(fileInput.files||[]):[];
  for(let file of files){
    if(file.size>15*1024*1024){alert('El archivo "'+file.name+'" supera 15MB y no se subirá.');continue;}
    if(!sbReady())continue;
    file=await comprimirImagenSiHaceFalta(file);
    const archId=Date.now()+'_'+Math.random().toString(36).slice(2,6);
    const path='unidades/'+String(patente||'SIN_PATENTE').replace(/[^a-zA-Z0-9]/g,'_')+'/mant_'+archId+'_'+file.name;
    try{
      const{error}=await sb.storage.from('vehiculo-documentos').upload(path,file);
      if(error)throw error;
      item.archivos.push({path,nombre:file.name});
    }catch(err){
      alert('No se pudo subir "'+file.name+'": '+((err&&err.message)||'intenta de nuevo.'));
    }
  }
  vd.items.push(item);
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){
    vd.items=vd.items.filter(x=>x.id!==item.id);
    return;
  }
  renderMantDetail();
}
export async function removeItemExtraArchivo(patente,itemId,archivoIdx){
  if(!confirm('¿Quitar este archivo de la mantención?'))return;
  const vd=ensureVehData(patente);
  const item=(vd.items||[]).find(x=>x.id===itemId);
  if(!item)return;
  const prevArchivos=(item.archivos||[]).slice();
  if(item.archivos&&item.archivos.length>archivoIdx)item.archivos.splice(archivoIdx,1);
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){
    item.archivos=prevArchivos;
    return;
  }
  renderMantDetail();
}
export async function removeItemExtra(patente,id){
  if(!confirm('¿Eliminar esta mantención?'))return;
  const vd=ensureVehData(patente);
  const prevItems=(vd.items||[]).slice();
  vd.items=(vd.items||[]).filter(x=>x.id!==id);
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){
    vd.items=prevItems;
    return;
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
    y=pdfSectionBar(doc,y,marginX,pageW,'OTRAS MANTENCIONES REGISTRADAS',[100,116,139]);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    items.forEach(it=>{
      y=pdfCheckPageBreak(doc,y,18);
      const txt=`•  ${it.nombre} — ${it.fecha?formatFecha(it.fecha):'sin fecha'}${it.detalle?': '+it.detalle:''}`;
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
  const fotosMant=(vd.items||[]).filter(it=>it.fotoPath).map(it=>({url:unidadFotoUrl(it.fotoPath),nombre:it.nombre||'Mantención'}));
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
    return{titulo:'PATENTE '+p,fotos:(vd.items||[]).filter(it=>it.fotoPath).map(it=>({url:unidadFotoUrl(it.fotoPath),nombre:it.nombre||'Mantención'}))};
  });
  await pdfAddPhotosPage(doc,pageW,pageH,marginX,grupos);
  doc.save('Vehiculos_Todos.pdf');
}
