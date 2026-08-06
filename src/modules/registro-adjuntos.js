import { adjPendientes, limpiarAdjPendientes, renderBarraAdjuntos, subirArchivosACola } from './adjuntos-pendientes.js';
import { GOOGLE_REVIEW_LINK, dbUpsertRegistro, dbUpsertUnidad, sb, sbReady } from './bootstrap.js';
import { __set_charts, __set_registros, __set_unidades, charts, currentTab, lists, otContext, registros, rgVals, session, unidades } from './core-data.js';
import { renderDash, renderUniTable } from './dashboard-kpis.js';
import { dbUpsertEvalFotosOT, ensureEvalFotosOT, esMiOT, escapeHtml, evalFotosOT, evaluacionesFotos, isAdminUser } from './evaluaciones.js';
import { renderSegResenas } from './evaluaciones-extra.js';
import { __set_extraRows, extraRows, extrasValidos, renderExtraRows } from './form-adicionales-garantia.js';
import { actualizarCamposGiftcard, actualizarWhatsappRegistro, calcDur, fillSel, g, selRg, toggleAnclaje } from './form-helpers.js';
import { __set_productoRows, productoRows, productosValidos, renderProductoRows } from './form-productos.js';
import { __set_fotografos, __set_materialRows, __set_tecnicosExtra, fotografos, fotografosValidos, materialRows, materialesValidos, renderFotografosRows, renderMaterialRows, renderTecnicosExtra, resetFotografos, resetMaterialRows, resetUniIntegrantes, tecnicosExtra, tecnicosExtraValidos, uniIntegrantesValidos } from './form-tecnicos-extra.js';
import { kmActualVeh } from './mantenciones-vehiculos.js';
import { sw } from './nav.js';
import { getRegdetCurrentId, mesInputARango, renderRegReportes, verDetalleRegistro } from './periodo-helpers.js';
import { populateComunasForRegion } from './regiones-comunas.js';
import { currentUserName } from './reportes-unidad.js';
import { comprimirImagenSiHaceFalta, limpiarPreviewArchivo } from './selector-foto-galeria.js';
import { uniregSelected } from './unidad-patente-selector.js';

/* ===== Adjuntos del registro (fotos y PDFs) ===== */
export let regAdjuntosPendientes=[];
/* Adjuntos que ya se subieron a Supabase (por ejemplo, al apretar "DE UNA!"
   antes de guardar el registro). Se guardan acá para que, si después se
   aprieta "Guardar registro", esos archivos no se vuelvan a subir ni se
   pierdan — simplemente se incluyen tal cual en el registro final. */
export let regAdjuntosYaSubidos=[];
/* Si no es null, el formulario "OT nueva" está en modo edición de esta visita
   ya guardada (id de registros[]): guardar() actualiza esa misma fila en vez
   de crear una nueva. Ver iniciarEdicionOT() / cancelarEdicionOT(). */
export let regEditingId=null;
export function handleRegAdjuntosSelected(fileList){
  [...fileList].forEach(f=>regAdjuntosPendientes.push(f));
  renderRegAdjuntosPendientes();
}
export function renderRegAdjuntosYaSubidos(){
  const el=g('reg-adjuntos-ya-subidos');
  if(!el)return;
  if(!regAdjuntosYaSubidos.length){el.innerHTML='';return;}
  el.innerHTML='<p class="sec-lbl" style="margin-top:.8rem">Ya subidos ('+regAdjuntosYaSubidos.length+')</p><div class="ef-fotos-grid">'+regAdjuntosYaSubidos.map((a,i)=>{
    const url=adjuntoUrl(a);
    const isImg=(a.mimeType||'').startsWith('image/');
    const nombre=escapeHtml(a.nombreArchivo||'archivo');
    const media=isImg&&url?`<img src="${url}" alt="${nombre}" onclick="window.open('${url}','_blank')">`:`<div class="ef-foto-ph" onclick="${url?`window.open('${url}','_blank')`:''}"><i class="ti ti-file-type-pdf" aria-hidden="true"></i></div>`;
    return `<div class="ef-foto-card">${media}<div class="ef-foto-meta"><span class="ef-foto-name" title="${nombre}">${nombre}</span><button class="btn-del" onclick="eliminarAdjuntoRegYaSubido(${i})"><i class="ti ti-trash" aria-hidden="true"></i></button></div></div>`;
  }).join('')+'</div>';
}
export function eliminarAdjuntoRegYaSubido(idx){
  if(!confirm('¿Quitar este documento de la visita? Se eliminará al guardar.'))return;
  const doc=regAdjuntosYaSubidos[idx];
  regAdjuntosYaSubidos=regAdjuntosYaSubidos.filter((_,i)=>i!==idx);
  if(doc&&doc.storagePath&&sb)sb.storage.from('registro-adjuntos').remove([doc.storagePath]).catch(()=>{});
  renderRegAdjuntosYaSubidos();
}
export function renderRegAdjuntosPendientes(){
  const el=g('reg-adjuntos-pending');
  if(!el)return;
  if(!regAdjuntosPendientes.length){el.innerHTML='';return;}
  el.innerHTML='<div class="ot-pending-grid">'+regAdjuntosPendientes.map((f,i)=>{
    const isPdf=f.type==='application/pdf';
    const inner=isPdf?`<div class="ot-pending-file" style="background:#7A1F1F"><span class="ext">PDF</span><span class="fname">${escapeHtml(f.name)}</span></div>`:`<img src="${URL.createObjectURL(f)}">`;
    return `<div class="ot-pending-card">${inner}<button class="rm" onclick="removeRegAdjuntoPendiente(${i})" title="Quitar"></button></div>`;
  }).join('')+'</div>';
}
export function removeRegAdjuntoPendiente(i){regAdjuntosPendientes.splice(i,1);renderRegAdjuntosPendientes();}
async function subirArchivosGenerico(files,ot){
  const by=currentUserName();
  const subidos=[];
  const fallidos=[];
  for(let file of files){
    if(file.size>15*1024*1024){fallidos.push(`${file.name} (supera 15MB)`);continue;}
    file=await comprimirImagenSiHaceFalta(file);
    const id=Date.now()+'_'+Math.random().toString(36).slice(2,7);
    const path='OT_'+String(ot).replace(/[^a-zA-Z0-9]/g,'_')+'/'+id+'_'+file.name;
    try{
      const{error}=await sb.storage.from('registro-adjuntos').upload(path,file);
      if(error)throw error;
      subidos.push({id,nombreArchivo:file.name,fecha:new Date().toISOString().slice(0,10),mimeType:file.type,storagePath:path,uploadedBy:by});
    }catch(e){
      console.error('Error subiendo adjunto:',e);
      const detalle=(e&&(e.message||e.error_description||e.hint||e.statusCode))||'Error desconocido';
      fallidos.push(`${file.name} (${detalle})`);
    }
  }
  return{subidos,fallidos};
}
export async function subirRegAdjuntosPendientes(ot){
  if(!regAdjuntosPendientes.length)return[];
  if(!sbReady())return[];
  const{subidos,fallidos}=await subirArchivosGenerico(regAdjuntosPendientes,ot);
  regAdjuntosPendientes=[];
  renderRegAdjuntosPendientes();
  if(fallidos.length){
    alert('No se pudieron subir estos archivos adjuntos:\n\n'+fallidos.join('\n')+
      '\n\nEl resto del registro se guardó igual. Revisa en Supabase que exista el bucket "registro-adjuntos" (Storage) y que tenga permisos de subida (policy INSERT) para usuarios autenticados/anónimos.');
  }
  return subidos;
}
/* ===== Agregar documentos a una OT YA guardada, desde el detalle (útil
   cuando en terreno se cayó el internet y no se pudieron subir a tiempo) ===== */
export let regdetAdjuntosPendientes=[];
export function handleRegdetAdjuntosSelected(fileList){
  [...fileList].forEach(f=>regdetAdjuntosPendientes.push(f));
  renderRegdetAdjuntosPendientes();
}
export function renderRegdetAdjuntosPendientes(){
  const el=g('regdet-adjuntos-pending');
  if(!el)return;
  if(!regdetAdjuntosPendientes.length){el.innerHTML='';return;}
  el.innerHTML='<div class="ot-pending-grid">'+regdetAdjuntosPendientes.map((f,i)=>{
    const isPdf=f.type==='application/pdf';
    const inner=isPdf?`<div class="ot-pending-file" style="background:#7A1F1F"><span class="ext">PDF</span><span class="fname">${escapeHtml(f.name)}</span></div>`:`<img src="${URL.createObjectURL(f)}">`;
    return `<div class="ot-pending-card">${inner}<button class="rm" onclick="removeRegdetAdjuntoPendiente(${i})" title="Quitar"></button></div>`;
  }).join('')+'</div>';
}
export function removeRegdetAdjuntoPendiente(i){regdetAdjuntosPendientes.splice(i,1);renderRegdetAdjuntosPendientes();}
export function resetRegdetAdjuntosPendientes(){regdetAdjuntosPendientes.length=0;renderRegdetAdjuntosPendientes();}
export async function guardarRegdetAdjuntos(){
  if(!regdetAdjuntosPendientes.length)return;
  const id=getRegdetCurrentId();
  const r=registros.find(x=>x.id===id);
  if(!r||!sbReady())return;
  const btn=g('regdet-adjuntos-guardar-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-cloud-upload" aria-hidden="true"></i> Subiendo...';}
  const{subidos,fallidos}=await subirArchivosGenerico(regdetAdjuntosPendientes,r.ot);
  regdetAdjuntosPendientes=[];
  renderRegdetAdjuntosPendientes();
  if(subidos.length){
    /* Se relee 'adjuntos' desde la base justo antes de guardar (en vez de
       confiar solo en r.adjuntos, que pudo quedar desactualizado en memoria)
       para no perder documentos subidos por otra persona mientras tanto. */
    let base=r.adjuntos||[];
    try{
      const{data}=await sb.from('rolzzo_registros').select('adjuntos').eq('id',id).single();
      if(data&&data.adjuntos)base=data.adjuntos;
    }catch(e){/* si falla, se sigue con lo que había en memoria */}
    r.adjuntos=[...base,...subidos];
    await dbUpsertRegistro(r);
    verDetalleRegistro(id);
  }
  if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar documentos';}
  if(fallidos.length){
    alert('No se pudieron subir estos archivos adjuntos:\n\n'+fallidos.join('\n')+
      '\n\nEl resto se guardó igual.');
  }
}
/* Elimina un documento YA guardado de una OT (incluye los certificados
   generados desde Formulario, que se guardan en este mismo arreglo). */
export async function eliminarAdjuntoRegistro(idx){
  const id=getRegdetCurrentId();
  const r=registros.find(x=>x.id===id);
  if(!r)return;
  const doc=(r.adjuntos||[])[idx];
  if(!doc)return;
  if(!confirm(`¿Eliminar "${doc.nombreArchivo||'este documento'}"? Esta acción no se puede deshacer.`))return;
  const prev=r.adjuntos;
  r.adjuntos=r.adjuntos.filter((_,i)=>i!==idx);
  const ok=await dbUpsertRegistro(r);
  if(!ok){r.adjuntos=prev;return;}
  if(doc.storagePath&&sb)sb.storage.from('registro-adjuntos').remove([doc.storagePath]).catch(()=>{});
  verDetalleRegistro(id);
}
export async function forzarDescarga(url,nombre){
  try{
    const res=await fetch(url);
    if(!res.ok)throw new Error('No se pudo obtener el archivo');
    const blob=await res.blob();
    const blobUrl=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=blobUrl;
    a.download=nombre||'archivo';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(blobUrl),4000);
  }catch(e){
    console.error('Error al descargar:',e);
    alert('No se pudo descargar el archivo. Se abrirá en una pestaña nueva.');
    window.open(url,'_blank');
  }
}
export function adjuntoUrl(a){
  if(a.storagePath&&sbReady()){try{return sb.storage.from('registro-adjuntos').getPublicUrl(a.storagePath).data.publicUrl;}catch(e){}}
  return'';
}
/* Acorta una URL larga (ej: el link público de Supabase) usando la API
   gratuita de is.gd, para que en WhatsApp se vea corto y prolijo en vez
   del link enorme. No requiere API key. Si falla por algún motivo (sin
   internet, servicio caído, etc.) se devuelve la URL original tal cual,
   para no perder el link. */
export async function acortarUrl(url){
  if(!url)return url;
  try{
    const resp=await fetch('https://is.gd/create.php?format=simple&url='+encodeURIComponent(url));
    if(!resp.ok)throw new Error('is.gd status '+resp.status);
    const corta=(await resp.text()).trim();
    if(corta&&corta.startsWith('http'))return corta;
    throw new Error('Respuesta inesperada de is.gd: '+corta);
  }catch(e){
    console.error('No se pudo acortar el link, se usará el original:',e);
    return url;
  }
}

export let problemaRows=[{problema:'',solucion:'',quesol:''}];
export function probOpts(arr,sel){return (arr||[]).map(v=>`<option value="${escapeHtml(v)}" ${v===sel?'selected':''}>${escapeHtml(v)}</option>`).join('');}
export function renderProblemasRows(){
  const cont=g('problemas-rows');
  if(!cont)return;
  const multi=problemaRows.length>1;
  cont.innerHTML=problemaRows.map((row,i)=>{
    const num=multi?` ${i+1}`:'';
    return `
    <div class="prob-row">
      <div class="field"><label>Tipo de problema${num}</label><select onchange="setProbRow(${i},'problema',this.value)">${probOpts(lists.problemas,row.problema)}</select></div>
      <div class="field"><label>Solución${num}</label><select onchange="setProbRow(${i},'solucion',this.value)">${probOpts(lists.soluciones,row.solucion)}</select></div>
      <div class="field"><label>¿Qué se solucionó?${num}</label><select onchange="setProbRow(${i},'quesol',this.value)">${probOpts(lists.queSoluciono,row.quesol)}</select></div>
      <button type="button" class="btn-del prob-del" title="Quitar problema" onclick="removeProbRow(${i})" style="${multi?'':'visibility:hidden'}"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>`;
  }).join('')+`<button type="button" class="btn-sec prob-add" onclick="addProbRow()" title="Agregar otro problema"><i class="ti ti-plus" aria-hidden="true"></i> Agregar otro problema</button>`;
  // Sincroniza el modelo con los valores realmente renderizados (por defaults)
  [...cont.querySelectorAll('.prob-row')].forEach((rowEl,i)=>{
    const sels=rowEl.querySelectorAll('select');
    if(sels[0])problemaRows[i].problema=sels[0].value;
    if(sels[1])problemaRows[i].solucion=sels[1].value;
    if(sels[2])problemaRows[i].quesol=sels[2].value;
  });
}
export function setProbRow(i,key,val){if(problemaRows[i])problemaRows[i][key]=val;scheduleRegDraftSave();}
export function addProbRow(){problemaRows.push({problema:'',solucion:'',quesol:''});renderProblemasRows();scheduleRegDraftSave();}
export function removeProbRow(i){problemaRows.splice(i,1);if(!problemaRows.length)problemaRows.push({problema:'',solucion:'',quesol:''});renderProblemasRows();scheduleRegDraftSave();}
export function resetProblemasRows(){problemaRows=[{problema:'',solucion:'',quesol:''}];renderProblemasRows();}
/* Concatena una columna: 1 fila -> valor plano; varias -> "1- A / 2- B" */
export function joinProbField(key){
  const vals=problemaRows.map(r=>r[key]).filter(v=>v&&String(v).trim());
  if(vals.length<=1)return vals[0]||'';
  return vals.map((v,i)=>`${i+1}- ${v}`).join(' / ');
}
/* Evita duplicados por doble clic o doble tap en "Guardar registro": sin este
   freno, dos clics rápidos (o un click que no pareció responder al toque en
   el celular y la persona vuelve a tocar) alcanzan a crear DOS filas con el
   mismo OT/técnicos/fecha antes de que la primera termine de guardarse —
   cada una cuenta aparte en el dashboard y el ranking de técnicos, inflando
   las visitas de esa persona de cara al cálculo de sueldo. */
let guardandoRegistro=false;
export async function guardar(){
  if(guardandoRegistro)return;
  guardandoRegistro=true;
  try{
    await guardarInterno();
  }finally{
    guardandoRegistro=false;
  }
}
async function guardarInterno(){
  if(regEditingId){return guardarEdicionOT();}
  const ot=g('f-ot').value;
  if(!ot||!ot.trim()){alert('Debes ingresar el N° de OT antes de guardar.');return;}
  if(!sbReady())return;
  const hi=g('f-hinicio').value, hs=g('f-hsalida').value;
  let durMin=null;
  if(hi&&hs){const[hh,mm]=hi.split(':').map(Number);const[sh,sm]=hs.split(':').map(Number);durMin=(sh*60+sm)-(hh*60+mm);}
  const productos=productosValidos().map(p=>({tipo:p.tipo,cantidad:parseInt(p.cantidad)||0,codigo:(p.codigo||'').trim()}));
  const tipoCortina=productos.map(p=>p.tipo).join(', ');
  const cantidad=productos.reduce((s,p)=>s+p.cantidad,0);
  const adjuntosNuevos=await subirRegAdjuntosPendientes(ot);
  const adjuntos=[...regAdjuntosYaSubidos,...adjuntosNuevos];
  const extras=extrasValidos().map(e=>({adicional:e.adicional,cantidad:parseInt(e.cantidad)||0,tipoGar:e.tipoGar}));
  const adicional=extras.map(e=>e.adicional).filter(Boolean).join(', ');
  const tipoGar=extras.map(e=>e.tipoGar).filter(Boolean).join(', ');
  const materiales=materialesValidos();
  const r={
    id:Date.now(),fecha:g('f-fecha').value,mes:g('f-mes').value,
    tipo:rgVals['rg-tipo']||'',ot,cliente:g('f-cliente').value,
    tec1:g('f-tec1').value,tec2:g('f-tec2').value,tec3:g('f-tec3').value,tec4:g('f-tec4').value,
    tecnicosExtra:tecnicosExtraValidos(),
    hinicio:hi,hsalida:hs,durMin,traslado:g('f-traslado').value,
    tipoCortina,cantidad,productos,
    adicional,tipoGar,extras,
    nivelDif:rgVals['rg-niveldif']||'',
    materiales,material:materiales.join(', '),
    anclaje:rgVals['rg-anclaje']||'',
    ubicacion:g('f-ubic').value,codMotor:g('f-codmotor').value,
    calle:g('f-calle').value,numero:g('f-numero').value,
    region:g('f-region').value,comuna:g('f-comuna').value,
    google:rgVals['rg-google']||'No',video:rgVals['rg-video']||'No',fotoVideo:rgVals['rg-fotovideo']||'No',danos:rgVals['rg-danos']||'No',
    comentarioSeguimiento:g('f-seg-comentario').value,
    problema:joinProbField('problema'),solucion:joinProbField('solucion'),queSol:joinProbField('quesol'),
    comentario:g('f-comentario').value,adjuntos,
    fotografos:fotografosValidos(),
    giftcard:rgVals['rg-giftcard']||'No',
    giftcardCodigo:(g('f-giftcard-codigo')?.value||'').trim(),
    giftcardDescuento:g('f-giftcard-desc')?.value?parseInt(g('f-giftcard-desc').value)||0:null,
    creadoPor:currentUserName()
  };
  registros.push(r);
  const ok=await dbUpsertRegistro(r);
  if(!ok){
    __set_registros(registros.filter(x=>x.id!==r.id));
    return;
  }
  /* Si en esta OT nueva se marcó "Sí" en Reseña Google, quiere decir que
     al cliente ya se le avisó que debe dejar su reseña (todavía no que
     la dejó). Ese aviso cuenta como el primer contacto de seguimiento,
     así que se rellena automáticamente el Seguimiento 1 de su ficha con
     la fecha de la OT y el comentario que se dejó en esta misma sección.
     Los Seguimientos 2 y 3 quedan vacíos para que el admin los complete
     a mano cuando haga el seguimiento real de la reseña. Esto solo pasa
     al crear la OT (acá en guardar()), nunca al editarla después.
     Solo se rellena si el Seguimiento 1 de esa OT todavía está vacío:
     una misma OT puede tener más de una visita registrada (ej. una
     garantía posterior), y no queremos pisar un seguimiento que el
     admin ya haya completado a mano en una visita anterior. */
  if(r.google==='Si'){
    const m=ensureEvalFotosOT(ot);
    if(!m.seg1&&!m.seg1c){
      m.seg1=r.fecha||'';
      m.seg1c=r.comentarioSeguimiento||'';
      await dbUpsertEvalFotosOT(ot);
    }
  }
  if(currentTab==='seg_resenas')renderSegResenas();
  showToast('toast-reg');
  mostrarAvisoGuardadoOk(r.ot);
  clearRegDraft();
  blankRegForm();
}
/* Reparte un campo tipo "1- A / 2- B" (ver joinProbField) de vuelta en una
   lista de valores sueltos ["A","B"]. Si el campo no tiene ese formato
   (una sola fila, o vacío), lo devuelve tal cual en una lista de 1. */
function parseProbField(str){
  if(!str)return[];
  if(!/^\d+-\s/.test(str))return[str];
  return str.split(' / ').map(s=>s.replace(/^\d+-\s*/,''));
}
/* Convierte un registro ya guardado al mismo formato "borrador" que usa
   applyRegDraftToForm(), para poder abrir el formulario "OT nueva" con
   TODOS sus datos ya cargados y editables (en vez de un modal aparte con
   solo unos pocos campos). */
export function registroToDraftFields(r){
  const probs=parseProbField(r.problema), sols=parseProbField(r.solucion), quesols=parseProbField(r.queSol);
  const nFilas=Math.max(probs.length,sols.length,quesols.length,1);
  const problemaRows=[];
  for(let i=0;i<nFilas;i++)problemaRows.push({problema:probs[i]||'',solucion:sols[i]||'',quesol:quesols[i]||''});
  return{
    fields:{
      'f-fecha':r.fecha||'','f-mes':r.mes||'','f-ot':r.ot||'','f-cliente':r.cliente||'',
      'f-telefono-cliente':r.telefono||'',
      'f-tec1':r.tec1||'','f-tec2':r.tec2||'','f-tec3':r.tec3||'','f-tec4':r.tec4||'',
      'f-hinicio':r.hinicio||'','f-hsalida':r.hsalida||'','f-traslado':r.traslado||'',
      'f-ubic':r.ubicacion||'','f-codmotor':r.codMotor||'',
      'f-calle':r.calle||'','f-numero':r.numero||'','f-region':r.region||'','f-comuna':r.comuna||'',
      'f-seg-comentario':r.comentarioSeguimiento||'','f-comentario':r.comentario||'',
      'f-giftcard-codigo':r.giftcardCodigo||'','f-giftcard-desc':(r.giftcardDescuento??'')
    },
    rgVals:{
      'rg-tipo':r.tipo||'Instalación','rg-niveldif':r.nivelDif||'MEDIO','rg-anclaje':r.anclaje||'',
      'rg-giftcard':r.giftcard||'No','rg-google':r.google||'No','rg-video':r.video||'No','rg-fotovideo':r.fotoVideo||'No','rg-danos':r.danos||'No'
    },
    productoRows:(r.productos&&r.productos.length)?r.productos.map(p=>({tipo:p.tipo||'',cantidad:p.cantidad||'',codigo:p.codigo||''})):[{tipo:'',cantidad:'',codigo:''}],
    extraRows:(r.extras&&r.extras.length)?r.extras.map(e=>({adicional:e.adicional||'',cantidad:e.cantidad||'',tipoGar:e.tipoGar||''})):[{adicional:'',tipoGar:''}],
    tecnicosExtra:r.tecnicosExtra||[],
    materialRows:(r.materiales&&r.materiales.length)?r.materiales.slice():[''],
    fotografos:r.fotografos||[],
    problemaRows
  };
}
/* Pone el formulario "OT nueva" en modo edición para esta visita ya guardada:
   lo llena con TODOS sus datos (incluidos los adjuntos ya subidos) usando el
   mismo mecanismo del borrador, y deja el botón "Guardar registro" listo para
   actualizar esta misma fila en vez de crear una nueva. Solo un administrador
   puede editar una visita ya guardada. */
export function iniciarEdicionOT(r){
  if(!isAdminUser()){alert('Solo un administrador puede editar una visita ya registrada.');return;}
  regEditingId=r.id;
  applyRegDraftToForm(registroToDraftFields(r));
  regAdjuntosYaSubidos=[...(r.adjuntos||[])];
  regAdjuntosPendientes=[];
  renderRegAdjuntosPendientes();
  renderRegAdjuntosYaSubidos();
  const banner=g('reg-editing-banner');
  if(banner){banner.style.display='flex';}
  const otSpan=g('reg-editing-ot');
  if(otSpan)otSpan.textContent=r.ot||'—';
  sw('regnew');
  const card=document.querySelector('#pane-regnew .card');
  if(card)card.scrollIntoView({behavior:'smooth',block:'start'});
}
export function cancelarEdicionOT(){
  regEditingId=null;
  const banner=g('reg-editing-banner');
  if(banner)banner.style.display='none';
  clearRegDraft();
  blankRegForm();
}
/* Guarda los cambios de una visita ya existente (modo edición): lee los
   mismos campos que guardar(), pero actualiza esa fila en vez de crear una
   nueva. Se llama automáticamente desde guardar() cuando regEditingId está
   activo — nunca hace falta llamarla directo. */
export async function guardarEdicionOT(){
  const r=registros.find(x=>x.id===regEditingId);
  if(!r){alert('No se encontró la visita que se estaba editando.');regEditingId=null;return;}
  const ot=g('f-ot').value;
  if(!ot||!ot.trim()){alert('Debes ingresar el N° de OT antes de guardar.');return;}
  if(!sbReady())return;
  const hi=g('f-hinicio').value, hs=g('f-hsalida').value;
  let durMin=null;
  if(hi&&hs){const[hh,mm]=hi.split(':').map(Number);const[sh,sm]=hs.split(':').map(Number);durMin=(sh*60+sm)-(hh*60+mm);}
  const productos=productosValidos().map(p=>({tipo:p.tipo,cantidad:parseInt(p.cantidad)||0,codigo:(p.codigo||'').trim()}));
  const tipoCortina=productos.map(p=>p.tipo).join(', ');
  const cantidad=productos.reduce((s,p)=>s+p.cantidad,0);
  const adjuntosNuevos=await subirRegAdjuntosPendientes(ot);
  const adjuntos=[...regAdjuntosYaSubidos,...adjuntosNuevos];
  const extras=extrasValidos().map(e=>({adicional:e.adicional,cantidad:parseInt(e.cantidad)||0,tipoGar:e.tipoGar}));
  const adicional=extras.map(e=>e.adicional).filter(Boolean).join(', ');
  const tipoGar=extras.map(e=>e.tipoGar).filter(Boolean).join(', ');
  const materiales=materialesValidos();
  const otAnterior=r.ot;
  Object.assign(r,{
    fecha:g('f-fecha').value,mes:g('f-mes').value,
    tipo:rgVals['rg-tipo']||'',ot,cliente:g('f-cliente').value,
    tec1:g('f-tec1').value,tec2:g('f-tec2').value,tec3:g('f-tec3').value,tec4:g('f-tec4').value,
    tecnicosExtra:tecnicosExtraValidos(),
    hinicio:hi,hsalida:hs,durMin,traslado:g('f-traslado').value,
    tipoCortina,cantidad,productos,
    adicional,tipoGar,extras,
    nivelDif:rgVals['rg-niveldif']||'',
    materiales,material:materiales.join(', '),
    anclaje:rgVals['rg-anclaje']||'',
    ubicacion:g('f-ubic').value,codMotor:g('f-codmotor').value,
    calle:g('f-calle').value,numero:g('f-numero').value,
    region:g('f-region').value,comuna:g('f-comuna').value,
    google:rgVals['rg-google']||'No',video:rgVals['rg-video']||'No',fotoVideo:rgVals['rg-fotovideo']||'No',danos:rgVals['rg-danos']||'No',
    comentarioSeguimiento:g('f-seg-comentario').value,
    problema:joinProbField('problema'),solucion:joinProbField('solucion'),queSol:joinProbField('quesol'),
    comentario:g('f-comentario').value,adjuntos,
    fotografos:fotografosValidos(),
    giftcard:rgVals['rg-giftcard']||'No',
    giftcardCodigo:(g('f-giftcard-codigo')?.value||'').trim(),
    giftcardDescuento:g('f-giftcard-desc')?.value?parseInt(g('f-giftcard-desc').value)||0:null
  });
  const ok=await dbUpsertRegistro(r);
  if(!ok)return;
  if(otAnterior!==ot){
    evaluacionesFotos.forEach(e=>{if(e.ot===otAnterior)e.ot=ot;});
    if(evalFotosOT[otAnterior]){evalFotosOT[ot]=evalFotosOT[otAnterior];delete evalFotosOT[otAnterior];dbUpsertEvalFotosOT(ot);}
  }
  regEditingId=null;
  const banner=g('reg-editing-banner');
  if(banner)banner.style.display='none';
  showToast('toast-reg');
  mostrarAvisoGuardadoOk(r.ot);
  clearRegDraft();
  blankRegForm();
  renderRegReportes();
  if(currentTab==='dash')renderDash();
}
export function formatFechaCorta(fecha){
  const[y,m,d]=fecha.split('-');
  return `${d}/${m}/${(y||'').slice(2)}`;
}

/* ---------- Borrador del formulario "OT nueva" ----------
   Guarda en localStorage lo que la persona va escribiendo, para que si
   se recarga la página, se cae la conexión, se actualiza el sistema, o
   cierra la pestaña por error ANTES de guardar, no pierda el trabajo ya
   hecho.

   Solo existe UN borrador activo a la vez POR OPERADOR (el que está en el
   formulario ahora mismo) — no hay varios formularios "en pausa" en paralelo
   para una misma persona.

   IMPORTANTE: la clave incluye el código del operador que inició sesión
   (ver regDraftKey()). Esto es a propósito: si no se separara por operador,
   el borrador que dejó a medio llenar una persona podría aparecer en la
   pantalla de otra persona que inicia sesión después en el mismo equipo —
   cada operador debe ver únicamente lo que él mismo escribió.

   El borrador se borra automáticamente en cuanto esa OT se guarda con éxito. */
export const REG_DRAFT_KEY_BASE='rolzzo_reg_draft';
/* Devuelve la clave de localStorage del borrador para el operador con sesión
   activa. Si por algún motivo no hay sesión (no debería pasar dentro del
   formulario), se usa una clave separada para no mezclarla nunca con la de
   un operador real. */
export function regDraftKey(){
  const codigo=(session&&session.codigo)?session.codigo:'sin-sesion';
  return REG_DRAFT_KEY_BASE+'_'+codigo;
}
export const REG_DRAFT_FIELD_IDS=['f-fecha','f-mes','f-ot','f-cliente','f-telefono-cliente','f-tec1','f-tec2','f-tec3','f-tec4',
  'f-hinicio','f-hsalida','f-traslado','f-ubic','f-codmotor',
  'f-calle','f-numero','f-region','f-comuna','f-seg-comentario','f-comentario',
  'f-giftcard-codigo','f-giftcard-desc'];
export let regDraftSuspend=false;
export function captureRegDraft(){
  const fields={};
  REG_DRAFT_FIELD_IDS.forEach(id=>{const el=g(id);if(el)fields[id]=el.value;});
  return {fields,rgVals:{...rgVals},productoRows,extraRows,tecnicosExtra,problemaRows,materialRows,fotografos,savedAt:new Date().toISOString()};
}
export function regDraftIsEmpty(d){
  if(!d)return true;
  const hasField=Object.values(d.fields||{}).some(v=>v&&String(v).trim());
  const hasProd=(d.productoRows||[]).some(p=>p.tipo&&p.tipo.trim());
  const hasProb=(d.problemaRows||[]).some(p=>p.problema&&p.problema.trim());
  const hasExtra=(d.extraRows||[]).some(e=>e.adicional&&e.adicional.trim());
  const hasTecExtra=(d.tecnicosExtra||[]).some(t=>t&&t.trim());
  const hasMaterial=(d.materialRows||[]).some(m=>m&&m.trim());
  const hasFotografos=(d.fotografos||[]).length>0;
  return !hasField&&!hasProd&&!hasProb&&!hasExtra&&!hasTecExtra&&!hasMaterial&&!hasFotografos;
}
export function saveRegDraft(){
  if(regDraftSuspend)return;
  try{
    const draft=captureRegDraft();
    if(regDraftIsEmpty(draft)){localStorage.removeItem(regDraftKey());return;}
    localStorage.setItem(regDraftKey(),JSON.stringify(draft));
  }catch(e){}
}
export function clearRegDraft(){
  try{localStorage.removeItem(regDraftKey());}catch(e){}
}
/* Aplica un objeto de borrador al formulario visible (sin tocarlo si viene vacío). */
export function applyRegDraftToForm(draft){
  regDraftSuspend=true;
  try{
    if(draft.rgVals){
      Object.keys(draft.rgVals).forEach(k=>{
        rgVals[k]=draft.rgVals[k];
        const grp=g(k);
        if(grp){
          grp.querySelectorAll('.ro').forEach(x=>{
            const oc=x.getAttribute('onclick')||'';
            if(k==='rg-anclaje'){
              /* rg-anclaje permite multi-selección (toggleAnclaje), no un solo valor */
              const m=oc.match(/toggleAnclaje\('([^']*)'\)/);
              const btnVal=m?m[1]:null;
              const vals=(draft.rgVals[k]||'').split(',').filter(Boolean);
              x.classList.toggle('sel',btnVal&&vals.includes(btnVal));
              return;
            }
            const m=oc.match(/selRg\([^,]+,[^,]+,'([^']*)'\)/);
            const btnVal=m?m[1]:null;
            x.classList.toggle('sel',btnVal===draft.rgVals[k]);
          });
        }
      });
    }
    __set_productoRows((draft.productoRows&&draft.productoRows.length)?draft.productoRows:[{tipo:'',cantidad:'',codigo:''}]);
    renderProductoRows();
    __set_extraRows((draft.extraRows&&draft.extraRows.length)?draft.extraRows:[{adicional:'',tipoGar:''}]);
    renderExtraRows();
    __set_tecnicosExtra(draft.tecnicosExtra||[]);
    renderTecnicosExtra();
    __set_materialRows((draft.materialRows&&draft.materialRows.length)?draft.materialRows:['']);
    renderMaterialRows();
    __set_fotografos(draft.fotografos||[]);
    problemaRows=(draft.problemaRows&&draft.problemaRows.length)?draft.problemaRows:[{problema:'',solucion:'',quesol:''}];
    renderProblemasRows();
    REG_DRAFT_FIELD_IDS.forEach(id=>{
      const el=g(id);
      if(el)el.value=(draft.fields&&draft.fields[id])||'';
    });
    renderFotografosRows();
    actualizarCamposGiftcard();
    actualizarWhatsappRegistro();
    if(g('f-region').value)populateComunasForRegion('f-region','f-comuna',draft.fields&&draft.fields['f-comuna']);
    else populateComunasForRegion('f-region','f-comuna');
    calcDur();
  }finally{
    regDraftSuspend=false;
  }
}
/* Limpia el formulario a un estado en blanco, sin guardar nada. */
export function blankRegForm(){
  rgVals['rg-tipo']='Instalación';rgVals['rg-niveldif']='MEDIO';rgVals['rg-anclaje']='TECHO';
  rgVals['rg-google']='No';rgVals['rg-video']='No';rgVals['rg-fotovideo']='No';rgVals['rg-danos']='No';rgVals['rg-giftcard']='No';
  applyRegDraftToForm({fields:{},rgVals:{...rgVals}});
  resetMaterialRows();
  resetFotografos();
  actualizarCamposGiftcard();
  actualizarWhatsappRegistro();
  g('dur-display').textContent='';
  regAdjuntosPendientes=[];
  regAdjuntosYaSubidos=[];
  renderRegAdjuntosPendientes();
}
export function otDraftLabel(d){
  const ot=(d.fields&&d.fields['f-ot'])||'';
  const cliente=(d.fields&&d.fields['f-cliente'])||'';
  if(ot&&cliente)return`OT ${ot} · ${cliente}`;
  if(ot)return`OT ${ot}`;
  if(cliente)return cliente;
  return'un formulario sin OT ni cliente';
}
/* Se llama justo después de iniciar sesión (o al recargar/reabrir el
   sistema): si hay un borrador guardado de una OT que quedó sin terminar
   (por ejemplo, por un cierre inesperado, una actualización del sistema,
   o recargar la página sin querer), se muestra un aviso claro preguntando
   si se quiere retomar esa OT o empezar una nueva. No aparece solo por
   cambiar de pestaña dentro del sistema — solo al reabrir/recargar. */
export function restoreRegDraft(){
  let draft=null;
  try{draft=JSON.parse(localStorage.getItem(regDraftKey())||'null');}catch(e){}
  if(!draft||regDraftIsEmpty(draft))return;
  pendingRegDraft=draft;
  abrirModalOtPendiente(draft);
}
export let pendingRegDraft=null;
export function abrirModalOtPendiente(draft){
  const label=otDraftLabel(draft);
  const body=g('modal-ot-pendiente-body');
  if(body)body.textContent=`Quedó ${label} sin terminar. ¿Quieres retomarla donde la dejaste, o prefieres empezar una OT nueva?`;
  const modal=g('modal-ot-pendiente');
  if(modal)modal.style.display='flex';
}
export function cerrarModalOtPendiente(){
  const modal=g('modal-ot-pendiente');
  if(modal)modal.style.display='none';
}
/* Botón "Retomar" del modal: repone el borrador guardado en el formulario. */
export function retomarOtPendiente(){
  if(pendingRegDraft)applyRegDraftToForm(pendingRegDraft);
  pendingRegDraft=null;
  cerrarModalOtPendiente();
}
/* Botón "Nueva OT" del modal: descarta el borrador pendiente y deja el
   formulario en blanco. */
export function descartarOtPendiente(){
  clearRegDraft();
  blankRegForm();
  pendingRegDraft=null;
  cerrarModalOtPendiente();
}
/* Autoguardado: cualquier tecleo o cambio dentro del formulario de OT nueva
   dispara el guardado del borrador (con un pequeño retraso para no saturar). */
export let regDraftTimer=null;
export function scheduleRegDraftSave(){
  clearTimeout(regDraftTimer);
  regDraftTimer=setTimeout(saveRegDraft,400);
}
document.addEventListener('input',e=>{
  const el=e.target;
  if(el.id&&REG_DRAFT_FIELD_IDS.includes(el.id))scheduleRegDraftSave();
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id&&REG_DRAFT_FIELD_IDS.includes(el.id))scheduleRegDraftSave();
});

/* Arma el texto del resumen de WhatsApp ("DE UNA!") a partir de un objeto
   de registro con la MISMA forma que arma guardar() (r.ot, r.tec1, r.productos,
   r.extras, r.adjuntos, etc). Esto permite generar exactamente el mismo
   resumen y los mismos links de descarga tanto desde el formulario "OT nueva"
   (antes de guardar) como desde el detalle de una OT ya guardada (por si el
   botón original falló al copiar o el técnico necesita reenviarlo). */
export async function armarTextoResumenWhatsapp(r){
  const ot=r.ot||'—';
  const hinicio=r.hinicio||'—';
  const hsalida=r.hsalida||'—';
  const fecha=r.fecha?formatFechaCorta(r.fecha):'—';
  const cliente=r.cliente||'—';
  const tipo=r.tipo||'';
  const cobrar=tipo==='Garantía'?'No':'Si';
  const instaladoresLista=[r.tec1,r.tec2,r.tec3,r.tec4,...(r.tecnicosExtra||[])].filter(Boolean);
  const instaladores=formatListaWhatsapp(instaladoresLista);
  const prodsValidos=(r.productos&&r.productos.length)?r.productos:[];
  const telasLista=prodsValidos.map(p=>{
    const cod=(p.codigo||'').trim();
    return `${p.tipo}${cod?' - Cód: '+cod:''}${p.cantidad?' ('+p.cantidad+' un.)':''}`;
  });
  const telas=formatListaWhatsapp(telasLista);
  const fotoVideo=r.fotoVideo==='Si'?((r.fotografos&&r.fotografos.length)?formatListaWhatsapp(r.fotografos):'Sí'):'No';
  const google=r.google==='Si'?'Enviado':'No';
  const extras=(r.extras&&r.extras.length)?r.extras:[];
  const adicionalUpper=extras.map(e=>e.adicional).filter(Boolean).join(', ').toUpperCase();
  const router=adicionalUpper.includes('HUB')?'Sí':'No';
  const extrasLista=extras.map(e=>[e.adicional,e.cantidad?('x'+e.cantidad):'',e.tipoGar].filter(Boolean).join(' ')).filter(Boolean);
  const extrasDetalle=formatListaWhatsapp(extrasLista);
  const probVals=(r.problema?String(r.problema).split('\n'):[]).filter(v=>v&&!v.toUpperCase().includes('NINGUNO')&&!v.toUpperCase().includes('NO APLICA'));
  const problemas=formatListaWhatsapp(probVals);
  const comuna=r.comuna||'—';
  const nota=r.comentario||'';
  const giftcard=r.giftcard==='Si'
    ?`Sí${r.giftcardCodigo?' - Cód: '+r.giftcardCodigo:''}${(r.giftcardDescuento||r.giftcardDescuento===0)?' - '+r.giftcardDescuento+'% dcto.':''}`
    :'No';
  const adjuntosSubidos=r.adjuntos||[];
  const urlsCortas=await Promise.all(adjuntosSubidos.map(a=>acortarUrl(adjuntoUrl(a))));
  const adjuntosLista=adjuntosSubidos.map((a,i)=>{
    const url=urlsCortas[i];
    return url?`Archivo ${i+1}: ${url}`:`Archivo ${i+1}`;
  });
  const adjuntosTxt=formatListaWhatsapp(adjuntosLista);

  return `*** Hora de llegada ${hinicio} ***

1.💸 Se puede cobrar? ${cobrar}
2.📆 Fecha: ${fecha}
3.😎 Cliente: ${cliente}
4.🖊️ OT Cliente: ${ot}
5.⚠️ Estado: Culminada
6.🛠️ Instaladores: ${instaladores}
7.📜 Telas: ${telas}
8.🧰 Adicional / Garantía: ${extrasDetalle}
9.📷 Fotos y video: ${fotoVideo}
10.💻 Link de google: ${google}
11.👉🏼Se deja router: ${router}
12.🪟Cambio de manilla: No
13.🔴Problemas detectados: ${problemas}
14.📍Comuna: ${comuna}
15.🎁 Giftcard: ${giftcard}
16.📎 Documentos adjuntos: ${adjuntosTxt}

***Hora de salida: ${hsalida}***

Nota: ${nota}`;
}
/* Botón "DE UNA!" del formulario "OT nueva": arma el resumen a partir de lo
   que hay escrito en el formulario todavía sin guardar. Si hay adjuntos
   pendientes de subir, los sube primero para poder armar sus links.
   IMPORTANTE (Safari/iOS): navigator.clipboard.write() solo se puede llamar
   dentro del "gesto del usuario" (el tap en el botón). Como acá hay pasos
   asíncronos largos antes de tener el texto final (subir adjuntos, acortar
   links), armamos una función asyncTextoListo() con todo ese trabajo y se la
   pasamos como PROMESA a copiarTextoAlPortapapeles, que internamente llama a
   clipboard.write() de inmediato (sin esperar la promesa primero). Así el
   copiado sigue "dentro" del gesto del tap aunque el texto tarde en armarse. */
export async function copiarResumenWhatsapp(){
  const btnDeUna=document.querySelector('.btn-deuna');
  const textoOriginalBtn=btnDeUna?btnDeUna.innerHTML:'';
  const asyncTextoListo=(async()=>{
    const ot=g('f-ot').value||'—';
    let adjuntosSubidos=[];
    const habiaPendientes=regAdjuntosPendientes.length>0;
    if(habiaPendientes){
      if(!ot||ot==='—'){throw new Error('Ingresa el N° de OT antes de generar el resumen: se necesita para guardar los archivos adjuntos.');}
      if(btnDeUna)btnDeUna.innerHTML='<i class="ti ti-cloud-upload" aria-hidden="true"></i> Subiendo archivos...';
      const nuevos=await subirRegAdjuntosPendientes(ot);
      regAdjuntosYaSubidos=[...regAdjuntosYaSubidos,...nuevos];
      adjuntosSubidos=regAdjuntosYaSubidos;
    }else{
      adjuntosSubidos=regAdjuntosYaSubidos;
    }
    if(btnDeUna)btnDeUna.innerHTML='<i class="ti ti-cloud-upload" aria-hidden="true"></i> Preparando enlaces...';
    const rTmp={
      ot,hinicio:g('f-hinicio').value,hsalida:g('f-hsalida').value,fecha:g('f-fecha').value,
      cliente:g('f-cliente').value,tipo:rgVals['rg-tipo']||'',
      tec1:g('f-tec1').value,tec2:g('f-tec2').value,tec3:g('f-tec3').value,tec4:g('f-tec4').value,
      tecnicosExtra:tecnicosExtraValidos(),
      productos:productosValidos(),video:rgVals['rg-video']||'No',fotoVideo:rgVals['rg-fotovideo']||'No',
      fotografos:fotografosValidos(),google:rgVals['rg-google']||'No',
      extras:extrasValidos(),
      problema:joinProbField('problema'),
      comuna:g('f-comuna').value,comentario:g('f-comentario').value,
      adjuntos:adjuntosSubidos,
      giftcard:rgVals['rg-giftcard']||'No',
      giftcardCodigo:(g('f-giftcard-codigo')?.value||'').trim(),
      giftcardDescuento:g('f-giftcard-desc')?.value?parseInt(g('f-giftcard-desc').value)||0:null
    };
    return armarTextoResumenWhatsapp(rTmp);
  })();
  if(btnDeUna)btnDeUna.disabled=true;
  try{
    await copiarTextoAlPortapapeles(asyncTextoListo);
  }catch(e){
    console.error('No se pudo generar/copiar el resumen:',e);
    alert(e&&e.message?e.message:'Ocurrió un error al preparar el resumen.');
  }finally{
    if(btnDeUna){btnDeUna.disabled=false;btnDeUna.innerHTML=textoOriginalBtn;}
  }
}
/* Botón "DE UNA!" del detalle de una OT YA GUARDADA (ver verDetalleRegistro):
   permite regenerar el mismo resumen y los mismos links de descarga por si
   el envío original falló, se pegó sin copiar los datos, o hubo un error y
   hay que reenviarlo. Usa el registro tal como quedó guardado en Supabase,
   no el formulario. */
export async function copiarResumenWhatsappDesdeRegistro(id,btnEl){
  const r=registros.find(x=>x.id===id);
  if(!r){alert('No se encontró ese registro.');return;}
  const textoOriginalBtn=btnEl?btnEl.innerHTML:'';
  if(btnEl){btnEl.disabled=true;btnEl.innerHTML='<i class="ti ti-cloud-upload" aria-hidden="true"></i> Preparando enlaces...';}
  try{
    await copiarTextoAlPortapapeles(armarTextoResumenWhatsapp(r));
  }catch(e){
    console.error('No se pudo generar/copiar el resumen:',e);
    alert(e&&e.message?e.message:'Ocurrió un error al preparar el resumen.');
  }finally{
    if(btnEl){btnEl.disabled=false;btnEl.innerHTML=textoOriginalBtn;}
  }
}
/* Copia texto al portapapeles de forma robusta, pensado especialmente para
   Safari/iOS: ese navegador solo permite usar el portapapeles si la llamada
   ocurre "dentro" del gesto del usuario (el tap). Como este resumen se arma
   con pasos asíncronos antes (subir adjuntos, acortar links), para cuando
   el texto está listo Safari ya puede considerar que el gesto "expiró" y
   bloquea silenciosamente el copiado clásico (navigator.clipboard.writeText
   y también el respaldo con execCommand).
   La solución es pasarle a navigator.clipboard.write() un ClipboardItem
   cuyo valor es una PROMESA (que resuelve al texto ya armado) en lugar del
   texto ya resuelto. Safari sí acepta esto: la llamada a clipboard.write()
   se hace en el momento del tap (síncrona), y el contenido se completa
   después cuando la promesa resuelve. Así el copiado automático funciona
   aunque el armado del texto tarde.
   textoPromise: una Promise<string> que resuelve al texto a copiar (para
   poder llamar a clipboard.write ANTES de esperar a que el texto esté listo).
   Solo si esto y los métodos clásicos fallan, se muestra el modal con el
   texto ya armado y un botón "Copiar" para que el técnico lo copie con un
   tap fresco (nunca se usa el prompt() nativo, que es feo y confuso). */
export async function copiarTextoAlPortapapeles(textoPromise){
  // 1) Método preferido en Safari/iOS: ClipboardItem con promesa.
  //    Se debe invocar SIN "await" antes, en el mismo tick del clic.
  try{
    if(navigator.clipboard&&window.ClipboardItem){
      const blobPromise=Promise.resolve(textoPromise).then(t=>new Blob([t],{type:'text/plain'}));
      await navigator.clipboard.write([new ClipboardItem({'text/plain':blobPromise})]);
      alert('¡Copiado! Ya puedes pegarlo en WhatsApp.');
      return;
    }
  }catch(e){
    console.error('ClipboardItem con promesa falló, se intenta con writeText:',e);
  }
  // A partir de acá ya necesitamos el texto resuelto.
  const texto=await Promise.resolve(textoPromise);
  // 2) Método clásico (funciona bien en Chrome/Android y desktop).
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      await navigator.clipboard.writeText(texto);
      alert('¡Copiado! Ya puedes pegarlo en WhatsApp.');
      return;
    }
    throw new Error('navigator.clipboard no disponible');
  }catch(e){
    console.error('Clipboard API falló, se intenta con execCommand:',e);
  }
  // 3) Respaldo con textarea oculto + execCommand (navegadores viejos).
  try{
    const ta=document.createElement('textarea');
    ta.value=texto;
    ta.style.position='fixed';
    ta.style.top='0';
    ta.style.left='0';
    ta.style.opacity='0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok=document.execCommand('copy');
    document.body.removeChild(ta);
    if(ok){
      alert('¡Copiado! Ya puedes pegarlo en WhatsApp.');
      return;
    }
    throw new Error('execCommand copy devolvió false');
  }catch(e){
    console.error('execCommand copy también falló:',e);
  }
  // 4) Último recurso: modal propio con botón "Copiar" (en vez de prompt()).
  mostrarModalCopyFallback(texto);
}
/* Guarda el texto pendiente para el botón "Copiar" del modal de respaldo. */
export let copyFallbackTexto='';
export function mostrarModalCopyFallback(texto){
  copyFallbackTexto=texto;
  const ta=g('modal-copy-fallback-text');
  if(ta)ta.value=texto;
  const modal=g('modal-copy-fallback');
  if(modal)modal.style.display='flex';
}
export function cerrarModalCopyFallback(){
  const modal=g('modal-copy-fallback');
  if(modal)modal.style.display='none';
}
/* Botón "Copiar" del modal de respaldo: como este clic SÍ es un gesto de
   usuario fresco (sin awaits previos), el copiado clásico normalmente
   funciona acá aunque haya fallado antes. Si aun así fallara, selecciona
   el texto del textarea para que el técnico lo copie manualmente con
   "Copiar" del menú de selección de iOS/Android. */
export async function copiarDesdeModalFallback(){
  const btn=g('modal-copy-fallback-btn');
  const textoOriginalBtn=btn?btn.innerHTML:'';
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      await navigator.clipboard.writeText(copyFallbackTexto);
      if(btn){btn.innerHTML='<i class="ti ti-check" aria-hidden="true"></i>¡Copiado!';setTimeout(()=>{if(btn)btn.innerHTML=textoOriginalBtn;},1500);}
      return;
    }
    throw new Error('navigator.clipboard no disponible');
  }catch(e){
    console.error('Copiado desde modal falló, se selecciona el texto:',e);
  }
  const ta=g('modal-copy-fallback-text');
  if(ta){
    ta.focus();
    ta.select();
    ta.setSelectionRange(0,ta.value.length);
    try{
      const ok=document.execCommand('copy');
      if(ok&&btn){btn.innerHTML='<i class="ti ti-check" aria-hidden="true"></i>¡Copiado!';setTimeout(()=>{if(btn)btn.innerHTML=textoOriginalBtn;},1500);return;}
    }catch(e){}
  }
  alert('Selecciona el texto y usa "Copiar" del menú, o mantén presionado sobre el texto.');
}
/* Formatea una lista de textos para el resumen de WhatsApp:
   - vacía -> 'No'
   - un solo elemento -> se muestra en la misma línea, sin guion
   - dos o más -> salto de línea y cada uno en su propia línea con "- " adelante,
     para que cosas como Instaladores, Telas, Problemas o Adicionales que
     tengan varios valores se vean uno debajo del otro y no todo amontonado
     separado por comas o barras. */
export function formatListaWhatsapp(items){
  const lista=(items||[]).filter(Boolean);
  if(!lista.length)return'No';
  if(lista.length===1)return lista[0];
  return'\n'+lista.map(v=>'- '+v).join('\n');
}
/* Botón "Enviar invitación por WhatsApp" que aparece en el formulario "OT nueva"
   apenas se marca "Sí" en Reseña Google (o sea, se le va a pedir al cliente que
   deje su reseña). Usa el nombre del cliente, el técnico principal y el teléfono
   que se haya escrito más arriba en el formulario, y el mismo link/mensaje de
   invitación que se usa en Evaluaciones. */
export function enviarInvitacionRegistro(){
  const cliente=(g('f-cliente').value||'').trim();
  const tecnico=(g('f-tec1').value||'').trim();
  const telefono=(g('f-telefono-cliente').value||'').trim();
  if(!cliente){alert('Escribe el nombre del cliente.');return;}
  if(!telefono){alert('Escribe el teléfono del cliente para poder enviarle el mensaje por WhatsApp.');return;}

  const mensaje=`¡Hola, ${cliente}! Somos el equipo de Rolzzo. ${tecnico||'Nuestro técnico'} nos confirmó que tu instalación quedó lista. Si quedaste conforme, ¿nos ayudarías con una calificación de 5 estrellas en Google? ${GOOGLE_REVIEW_LINK} ¡Gracias por tu confianza!`;

  const telLimpio=telefono.replace(/[^0-9+]/g,'');
  const url=`https://wa.me/${telLimpio.replace(/^\+/,'')}?text=${encodeURIComponent(mensaje)}`;
  window.open(url,'_blank');
}
/* Kilometraje ya registrado para la patente seleccionada (el más alto de
   todos sus registros de Unidad) — es el punto de partida "de fábrica" que
   se sugiere en el campo, para que el chofer no tenga que volver a
   escribirlo cada día: alcanza con confirmar/ajustar y sacar la foto. */
export function kmBaseUnireg(){
  return uniregSelected?(kmActualVeh(uniregSelected)||0):0;
}
/* Muestra el último kilometraje registrado como GUÍA de texto debajo del
   recuadro grande, pero ya NO lo escribe dentro del campo — jefatura pidió
   que el recuadro quede siempre vacío para una entrada nueva (antes, si
   volvían a esa patente, aparecía el número anterior metido en la caja y
   parecía un dato ya cargado). Se llama al elegir patente y al entrar a
   la pestaña. */
export function actualizarKmSugerido(){
  const hint=g('u-km-sugerido');
  const kmEl=g('u-km');
  if(!hint||!kmEl)return;
  const base=kmBaseUnireg();
  if(base>0){
    hint.textContent='Sugerido según el último registro: '+base.toLocaleString('es-CL')+' km. Ajústalo si el odómetro marca otra cosa.';
  }else{
    hint.textContent='Sin registros previos para esta patente — ingresa el kilometraje que marca el odómetro.';
  }
  calcularKmRecorridos();
}
/* Calcula en tiempo real los km recorridos desde el último registro
   (kilometraje ingresado - último kilometraje conocido de la patente),
   mostrándolo en la tarjeta destacada del formulario. */
export function calcularKmRecorridos(){
  const km=parseInt(g('u-km').value)||0;
  const base=kmBaseUnireg();
  const card=g('km-recorridos-card');
  const numEl=g('km-recorridos-num');
  if(!card||!numEl)return;
  const total=km-base;
  if(km>0&&base>0&&total>=0){
    numEl.textContent=total.toLocaleString('es-CL');
    card.style.opacity='1';
    card.classList.remove('km-recorridos-warn');
  }else if(km>0&&base>0&&total<0){
    numEl.textContent='Es menor al último registrado ('+base.toLocaleString('es-CL')+' km)';
    card.classList.add('km-recorridos-warn');
  }else{
    numEl.textContent='0';
    card.style.opacity='.6';
    card.classList.remove('km-recorridos-warn');
  }
}
/* "Más detalles (opcional)": conductor, combustible, gastos y comentario del
   día — colapsado por defecto para que la pantalla principal sea solo
   kilometraje + foto, pero sigue disponible para quien quiera dejarlo
   registrado. */
export let uniregDetallesOpen=false;
export function toggleUniregDetalles(){
  uniregDetallesOpen=!uniregDetallesOpen;
  const body=g('unireg-detalles-body');
  const chevron=g('unireg-detalles-chevron');
  if(body)body.style.display=uniregDetallesOpen?'':'none';
  if(chevron)chevron.classList.toggle('open',uniregDetallesOpen);
}
export async function subirFotoUnidad(u,inputId,carpeta){
  const fileInput=g(inputId);
  let file=fileInput&&fileInput.files[0];
  if(!file)return null;
  if(file.size>15*1024*1024){alert('La foto de '+carpeta+' supera 15MB; el registro se guardará sin esa foto.');return null;}
  file=await comprimirImagenSiHaceFalta(file);
  if(!sbReady())return null;
  const path='unidades/'+String(u.patente||'SIN_PATENTE').replace(/[^a-zA-Z0-9]/g,'_')+'/'+carpeta+'_'+u.id+'_'+file.name;
  try{
    const{error}=await sb.storage.from('vehiculo-documentos').upload(path,file);
    if(error)throw error;
    return path;
  }catch(err){
    alert('No se pudo subir la foto de '+carpeta+': '+((err&&err.message)||'intenta de nuevo.'));
    return null;
  }
}
/* Reemplaza el <input type="file"> único de la foto del odómetro por la
   misma dropzone (cámara / galería / escanear, varias fotos a la vez) que
   usa Registro de OT y Mantenciones — jefatura pidió que se vea y funcione
   igual en toda la app. */
export function renderUFotoKmDropzone(){
  const el=g('u-foto-km-dz');
  if(!el)return;
  el.innerHTML=renderBarraAdjuntos('kmfoto');
}
/* Guarda un registro de kilometraje con un solo número: el kilometraje
   inicial (kmi) no se pide — se toma automáticamente del último kilometraje
   conocido de la patente (kmBaseUnireg), igual que hacía antes con dos
   fotos por día. Así el chofer solo escribe/confirma un número y saca una
   foto, pero "km recorridos" y todo lo que ya usaba kmi/kmf (Historial,
   PDF, Excel, Estado de Flota) sigue funcionando sin cambios. */
export async function guardarUnidad(){
  const km=parseInt(g('u-km').value)||0;
  const fecha=g('u-fecha').value;
  const fotosPendientes=adjPendientes['kmfoto']||[];
  if(!uniregSelected){alert('Selecciona una patente arriba antes de guardar.');return;}
  /* Una sola vez al día por patente: se revisa ANTES de pedir foto/kilometraje
     para no hacer perder tiempo con eso si el registro va a rechazarse igual.
     Es un bloqueo total, no un aviso que se pueda pasar por alto — para
     corregir un dato mal ingresado hay que usar "Editar" en el historial de
     abajo, no crear un segundo registro del mismo día. */
  const yaRegistradoHoy=unidades.some(u=>u.patente===uniregSelected&&u.fecha===fecha);
  if(yaRegistradoHoy){
    alert('Ya ingresaste el kilometraje de hoy para la patente '+uniregSelected+'.\n\nRecuerda: el registro de kilometraje es UNA VEZ AL DÍA POR PATENTE. Si necesitas corregirlo, usa "Editar" en el historial de abajo.');
    return;
  }
  if(!km){alert('Ingresa el kilometraje que marca el odómetro.');return;}
  if(!fotosPendientes.length){alert('La foto del odómetro es obligatoria.');return;}
  const kmi=kmBaseUnireg();
  if(kmi>0&&km<kmi){alert('El kilometraje ingresado ('+km.toLocaleString('es-CL')+' km) es menor al último registrado para esta patente ('+kmi.toLocaleString('es-CL')+' km). Revisa la foto del odómetro antes de guardar.');return;}
  const u={id:Date.now(),fecha,mes:g('u-mes').value,
    conductor:g('u-conductor').value,patente:uniregSelected,
    kmi,kmf:km,total:kmi>0?km-kmi:0,comb:rgVals['rg-comb']||'',recarga:rgVals['rg-recarga']||'',
    monto:parseInt(g('u-monto').value)||0,pago:g('u-pago').value,
    /* i1..i4 quedan vacíos: son los campos viejos (máx. 4 personas, uno por
       input) que ya no se piden en el formulario, mantenidos solo por
       compatibilidad con registros antiguos. Los integrantes de hoy se
       guardan en 'integrantes' (pastillas, sin límite de cantidad). */
    i1:'',i2:'',i3:'',i4:'',
    integrantes:uniIntegrantesValidos(),
    detalle:g('u-detalle').value,
    creadoPor:currentUserName(),fotoPath:null,fotoKmiPath:null,fotoKmfPath:null,fotosKm:[]};
  await subirArchivosACola(uniregSelected,fotosPendientes,'Registro de kilometraje',u.fotosKm);
  if(u.fotosKm.length)u.fotoKmfPath=u.fotosKm[0].storagePath;
  const fileInput=g('u-foto');
  let file=fileInput&&fileInput.files[0];
  if(file){
    if(file.size>15*1024*1024){alert('La foto adicional supera 15MB; el registro se guardará sin esa foto.');}
    else if(sbReady()){
      file=await comprimirImagenSiHaceFalta(file);
      const path='unidades/'+String(u.patente||'SIN_PATENTE').replace(/[^a-zA-Z0-9]/g,'_')+'/'+u.id+'_'+file.name;
      try{const{error}=await sb.storage.from('vehiculo-documentos').upload(path,file);if(error)throw error;u.fotoPath=path;}
      catch(err){alert('No se pudo subir la foto: '+((err&&err.message)||'intenta de nuevo.')+' El registro se guardará sin foto.');}
    }
  }
  unidades.push(u);
  const okU=await dbUpsertUnidad(u);
  if(!okU){
    __set_unidades(unidades.filter(x=>x.id!==u.id));
    return;
  }
  showToast('toast-uni');
  g('u-km').value='';g('u-monto').value='';
  g('u-detalle').value='';
  if(fileInput)fileInput.value='';
  limpiarAdjPendientes('kmfoto');
  limpiarPreviewArchivo('u-foto');
  resetUniIntegrantes();
  actualizarKmSugerido();
  renderUniTable();
}
export function showToast(id){
  const t=g(id);t.style.display='flex';setTimeout(()=>t.style.display='none',3000);
}
/* Aviso grande a pantalla completa que confirma que la OT quedó guardada.
   Se usa además del toast chico, porque en terreno (con poca señal, apuro,
   o si el botón "DE UNA!" se traba copiando el resumen) el toast chico es
   fácil de pasar por alto y genera dudas de si la orden se guardó o no.
   Se cierra solo a los 4 segundos, o antes si el usuario toca la pantalla. */
export let guardadoOkTimer=null;
export function mostrarAvisoGuardadoOk(ot){
  const overlay=g('guardado-ok-overlay');
  if(!overlay)return;
  const otEl=g('guardado-ok-ot');
  if(otEl)otEl.textContent=ot?`OT ${ot}`:'';
  clearTimeout(guardadoOkTimer);
  overlay.classList.add('show');
  guardadoOkTimer=setTimeout(cerrarAvisoGuardadoOk,4000);
}
export function cerrarAvisoGuardadoOk(){
  const overlay=g('guardado-ok-overlay');
  if(overlay)overlay.classList.remove('show');
  clearTimeout(guardadoOkTimer);
}
export let toastBarTimer=null;
/* Toast liviano tipo barra, para avisos que no necesitan tapar toda la
   pantalla (a diferencia de mostrarAvisoGuardadoOk, pensado para el botón
   grande "DE UNA!" de OT en terreno). Se usa en Mantenciones. */
export function mostrarToastBar(msg){
  const bar=g('toast-bar');
  if(!bar)return;
  g('toast-bar-msg').textContent=msg;
  clearTimeout(toastBarTimer);
  bar.classList.add('show');
  toastBarTimer=setTimeout(()=>bar.classList.remove('show'),3200);
}
export function filtered(){
  const rangoMes=mesInputARango(g('fil-mes')?.value||'');
  const tec=g('fil-tec')?.value||'';
  const fecha=g('fil-fecha')?.value||'';
  const tipo=g('fil-tipo')?.value||'';
  return registros.filter(r=>{
    if(!isAdminUser()&&!esMiOT(r))return false;
    if(rangoMes.desde&&(!r.fecha||r.fecha<rangoMes.desde||r.fecha>rangoMes.hasta))return false;
    if(tec&&r.tec1!==tec&&r.tec2!==tec&&r.tec3!==tec&&r.tec4!==tec)return false;
    if(fecha&&r.fecha!==fecha)return false;
    if(tipo&&r.tipo!==tipo)return false;
    if(otContext&&(r.ot||'').toLowerCase()!==otContext.ot.toLowerCase())return false;
    return true;
  });
}
export function clearFil(){g('fil-mes').value='';g('fil-tec').value='';g('fil-fecha').value='';g('fil-tipo').value='';renderDash();}

export const CHART_COLORS=['#2a78d6','#1baf7a','#eda100','#4a3aa7','#e34948','#e87ba4','#eb6834','#008300','#00897B','#546E7A'];
/* Reseñas de Google (y cualquier otro dato que sea propiedad de la OT
   completa, no de cada visita suelta) hay que contarlos UNA sola vez por
   OT, no una vez por fila de registros. Si una misma OT tiene más de una
   fila — una garantía posterior, o un guardado duplicado por doble clic —
   sin este filtro cualquier métrica que dependa de evalFotosOT[ot] queda
   inflada tantas veces como filas tenga esa OT. Se usa la visita MÁS
   ANTIGUA de cada OT como representante, porque normalmente es la que
   gestionó la reseña; así no se le atribuye a quien hizo una visita
   posterior sobre la misma OT. */
export function dedupeOtPrimeraVisita(data){
  const primeraVisitaPorOt={};
  data.forEach(r=>{
    if(!r.ot)return;
    const prev=primeraVisitaPorOt[r.ot];
    if(!prev||(r.id||0)<(prev.id||0))primeraVisitaPorOt[r.ot]=r;
  });
  return data.filter(r=>r.ot&&primeraVisitaPorOt[r.ot]===r);
}
export function calcRankingTecnicos(data){
  const stats={};
  const filasRepresentantes=new Set(dedupeOtPrimeraVisita(data));
  data.forEach(r=>{
    const esRepresentanteGoogle=filasRepresentantes.has(r);
    [r.tec1,r.tec2,r.tec3,r.tec4].filter(Boolean).forEach(t=>{
      if(!stats[t])stats[t]={total:0,sinProblema:0,google:0};
      stats[t].total++;
      if(!r.problema||r.problema.toUpperCase().includes('NINGUNO'))stats[t].sinProblema++;
      if(esRepresentanteGoogle&&evalFotosOT[r.ot]&&evalFotosOT[r.ot].googleReview)stats[t].google++;
    });
  });
  return Object.keys(stats).map(t=>{
    const s=stats[t];
    const pctOk=s.sinProblema/s.total;
    const pctGoogle=s.google/s.total;
    const score=Math.max(0,Math.min(5,(pctOk*3)+(pctGoogle*2)));
    return{nombre:t,stars:score,total:s.total};
  }).sort((a,b)=>b.stars-a.stars);
}
export function starsHtml(n){
  const full=Math.round(n);
  let html='';
  for(let i=1;i<=5;i++)html+=`<i class="ti ti-star${i<=full?'-filled':''}" aria-hidden="true" style="color:${i<=full?'#F5A623':'#D8D5CC'};font-size:21px"></i>`;
  return html;
}
export function destroyCharts(){Object.values(charts).forEach(c=>{try{c.destroy();}catch(e){}});__set_charts({});}
