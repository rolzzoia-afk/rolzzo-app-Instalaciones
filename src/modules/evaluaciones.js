import { dbError, dbUpsertEvalFoto, saveAll, sb, sbReady } from './bootstrap.js';
import { MESES, currentTab, otContext, personas, registros, session } from './core-data.js';
import { renderEvalFotos, renderEvalNuevo, setDiaField } from './evaluaciones-extra.js';
import { g } from './form-helpers.js';
import { ALL_PERM_ITEMS } from './nav.js';
import { renderPersonas } from './personas.js';
import { currentUserName } from './reportes-unidad.js';
import { abrirSelectorArchivo, comprimirImagenSiHaceFalta, generarInvitacionWhatsapp } from './selector-foto-galeria.js';

/* ===== EVALUACIONES ===== */
export let evaluacionesFotos=[];
export function __set_evaluacionesFotos(v){ evaluacionesFotos = v; } // {id, ot, persona, fecha, mes, nivel:null|'BAJA'|'MEDIA'|'ALTA'}
export let evaluacionesNuevo=[];
export function __set_evaluacionesNuevo(v){ evaluacionesNuevo = v; } // {id, persona, fecha, mes, cats:{}, cortinas, tiempo, obs}
export let evalOpen={fotos:new Set(),nuevo:new Set(),historial:new Set(),sub:new Set()};
export let historialOpen=false;

export const CATS_NUEVO=[
  {key:'calidad',label:'Calidad técnica',short:'Calidad'},
  {key:'productividad',label:'Productividad',short:'Product.'},
  {key:'atencion',label:'Atención al cliente',short:'Atención'},
  {key:'orden',label:'Orden y limpieza',short:'Orden'},
  {key:'normas',label:'Cumplimiento de normas',short:'Normas'},
  {key:'aprendizaje',label:'Nivel de aprendizaje',short:'Aprendiz.'}
];
export const DIAS_SEMANA=['Lunes','Martes','Miércoles','Jueves','Viernes'];
export const CHECKLIST_INDUCCION=[
  {key:'herramientas',label:'Uso correcto de herramientas'},
  {key:'motor',label:'Manejo de motor y mecanismos'},
  {key:'medidas',label:'Toma de medidas'},
  {key:'materiales',label:'Instalación en distintos materiales (concreto, madera, etc.)'},
  {key:'anclaje',label:'Anclaje correcto (techo / pared)'},
  {key:'epp',label:'Uso de equipos de protección personal (EPP)'},
  {key:'seguridad',label:'Normas de seguridad en terreno'},
  {key:'atencioncliente',label:'Atención y trato al cliente'},
  {key:'ordenlimpieza',label:'Orden y limpieza al finalizar'},
  {key:'registrosistema',label:'Registro correcto en el sistema (app)'},
  {key:'vehiculo',label:'Manejo del vehículo de la empresa'},
  {key:'reclamos',label:'Protocolo ante problemas o reclamos del cliente'}
];

export function safeId(str){return str.replace(/[^a-zA-Z0-9]/g,'_');}
export function mesFromFecha(fecha){
  if(!fecha)return MESES[new Date().getMonth()];
  const d=new Date(fecha+'T12:00:00');
  return MESES[d.getMonth()]||MESES[new Date().getMonth()];
}
export function formatFecha(fecha){
  const[y,m,d]=fecha.split('-');
  return `${d}/${m}/${y}`;
}
/* Formatea un timestamp ISO completo (ej: "2026-07-17T14:32:10.000Z") como
   fecha y hora local legible: "17/07/2026, 11:32". Se usa para mostrar
   cuándo se subió un documento (subidoEn), no solo qué día. */
export function formatFechaHora(iso){
  if(!iso)return'';
  const d=new Date(iso);
  if(isNaN(d.getTime()))return'';
  const dd=String(d.getDate()).padStart(2,'0');
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const yyyy=d.getFullYear();
  const hh=String(d.getHours()).padStart(2,'0');
  const mi=String(d.getMinutes()).padStart(2,'0');
  return `${dd}/${mm}/${yyyy}, ${hh}:${mi}`;
}
export function avgLabel(avg){
  if(avg>=2.5)return{label:'Alto',cls:'alto'};
  if(avg>=1.5)return{label:'Medio',cls:'medio'};
  return{label:'Bajo',cls:'bajo'};
}
export function starAvgLabel(avg){
  const n=avg.toFixed(1);
  if(avg>=4)return{label:n+' ★',cls:'alto'};
  if(avg>=2.5)return{label:n+' ★',cls:'medio'};
  return{label:n+' ★',cls:'bajo'};
}
export function escapeHtml(str){
  return String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* --- Modal de comentario completo --- */
export let obsModalId=null;
export function openObsEditor(id){
  const d=evaluacionesNuevo.find(x=>x.id===id);if(!d)return;
  obsModalId=id;
  g('obs-modal-text').value=d.obs||'';
  g('obs-modal').style.display='flex';
  g('obs-modal-text').focus();
}
export function closeObsModal(){g('obs-modal').style.display='none';obsModalId=null;}
export function saveObsModal(){
  if(!obsModalId)return;
  setDiaField(obsModalId,'obs',g('obs-modal-text').value);
  closeObsModal();
  renderEvalNuevo();
}

/* --- Resumen automático y comentarios --- */
export const PLAN_CAT={
  calidad:{inmediato:'Acompañar su próxima instalación en terreno y revisar junto a él cada paso del checklist de calidad.',seguimiento:'Volver a evaluar en 2 semanas si logra cumplir el checklist sin apoyo.'},
  productividad:{inmediato:'Fijar una meta clara de cortinas y tiempo para sus próximas 3 visitas, comparando con el promedio del equipo.',seguimiento:'Si no mejora en 2 semanas, revisar si el freno está en la planificación de rutas o en la instalación misma.'},
  atencion:{inmediato:'Repasar con él el protocolo de bienvenida y cierre de visita frente al cliente.',seguimiento:'Pedir feedback puntual del cliente (reseña o comentario) en su próxima visita.'},
  orden:{inmediato:'Pedirle una foto del lugar de trabajo antes de retirarse, como hábito de cierre de cada visita.',seguimiento:'Revisar esas fotos semanalmente durante el próximo mes.'},
  normas:{inmediato:'Agendar una conversación breve con el encargado para repasar normas de seguridad puntuales.',seguimiento:'Hacer una supervisión sorpresa en terreno dentro de las próximas 2 semanas.'},
  aprendizaje:{inmediato:'Asignarle un técnico guía para sus próximas 2 instalaciones.',seguimiento:'Evaluar si puede trabajar de forma más autónoma después de ese acompañamiento.'}
};
export function tallyCatsFromDias(diasList){
  const tally={};CATS_NUEVO.forEach(c=>tally[c.key]={BAJA:0,MEDIA:0,ALTA:0});
  diasList.forEach(d=>CATS_NUEVO.forEach(c=>{if(d.cats[c.key])tally[c.key][d.cats[c.key]]++;}));
  return tally;
}
export function generarResumen(diasList){
  const tally=tallyCatsFromDias(diasList);
  const rows=CATS_NUEVO.map(c=>({key:c.key,label:c.label,...tally[c.key],total:tally[c.key].BAJA+tally[c.key].MEDIA+tally[c.key].ALTA})).filter(r=>r.total>0);
  if(!rows.length)return{debiles:[],texto:'Aún no hay evaluaciones suficientes para generar un resumen.'};
  const debiles=rows.filter(r=>r.BAJA>0).sort((a,b)=>b.BAJA-a.BAJA).slice(0,3);
  if(!debiles.length)return{debiles:[],texto:'Buen desempeño general: no se detectan categorías con evaluación baja en este período.'};
  return{debiles,texto:null};
}
export function renderPuntosAMejorar(diasList){
  const r=generarResumen(diasList);
  if(!r.debiles.length)return `<div class="resumen-block ok" style="margin-top:0"><i class="ti ti-check" aria-hidden="true"></i>${r.texto}</div>`;
  return `
<div class="resumen-block" style="margin-top:0">
  <p class="resumen-title"><i class="ti ti-alert-triangle" aria-hidden="true"></i>Puntos a mejorar</p>
  ${r.debiles.map(d=>`
  <div class="resumen-item">
    <span class="resumen-cat">${d.label}<span style="color:var(--text-muted);font-weight:400"> (${d.BAJA} evaluación${d.BAJA>1?'es':''} baja${d.BAJA>1?'s':''})</span></span>
  </div>`).join('')}
</div>`;
}
export function renderPlanAccion(diasList){
  const r=generarResumen(diasList);
  if(!r.debiles.length)return'';
  return `
<div class="resumen-block">
  <p class="resumen-title"><i class="ti ti-route" aria-hidden="true"></i>Plan de acción</p>
  ${r.debiles.map(d=>{const plan=PLAN_CAT[d.key];return `
  <div class="resumen-item">
    <span class="resumen-cat">${d.label}</span>
    <div class="plan-step"><span class="plan-step-tag">Ahora</span>${plan.inmediato}</div>
    <div class="plan-step"><span class="plan-step-tag seg">Seguimiento</span>${plan.seguimiento}</div>
  </div>`;}).join('')}
</div>`;
}
export function renderDetalleEvalBlock(persona,diasList){
  return subAccordion('detalle',persona,'Detalle de evaluación','ti-clipboard-check',renderPuntosAMejorar(diasList)+renderPlanAccion(diasList));
}
export function renderComentariosBlock(persona,diasList){
  const obs=diasList.filter(d=>d.obs&&d.obs.trim()).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  if(!obs.length)return'';
  const body=obs.map(d=>`<div class="comentario-row"><span class="comentario-fecha">${formatFecha(d.fecha)}</span><span class="comentario-texto">${escapeHtml(d.obs)}</span></div>`).join('');
  return subAccordion('comentarios',persona,'Comentarios de este período','ti-message-2',body);
}
export function subAccordion(kind,persona,title,icon,contentHtml){
  const key=kind+'::'+persona;
  const open=evalOpen.sub.has(key);
  const pSafe=persona.replace(/'/g,"\\'");
  return `
<div class="sub-accordion">
  <div class="sub-accordion-head" onclick="toggleSubAccordion('${kind}','${pSafe}')">
    <span><i class="ti ${icon}" aria-hidden="true"></i>${title}</span>
    <i class="sub-chevron ${open?'open':''}" aria-hidden="true"></i>
  </div>
  ${open?`<div class="sub-accordion-body">${contentHtml}</div>`:''}
</div>`;
}
export function ensureInduccion(p){
  if(!p.induccion||typeof p.induccion!=='object')p.induccion={checklist:{},documentos:[]};
  if(!p.induccion.checklist){
    const legacy={...p.induccion};
    delete legacy.documentos;
    p.induccion={checklist:legacy,documentos:p.induccion.documentos||[]};
  }
  if(!p.induccion.documentos)p.induccion.documentos=[];
  return p.induccion;
}
export function setInduccionEstado(codigo,key,checked){
  const p=personas.find(x=>x.codigo===codigo);if(!p)return;
  const ind=ensureInduccion(p);
  if(!ind.checklist[key])ind.checklist[key]={checked:false,comentario:'',fecha:''};
  ind.checklist[key].checked=checked;
  if(checked&&!ind.checklist[key].fecha)ind.checklist[key].fecha=new Date().toISOString().slice(0,10);
  saveAll();renderEvalNuevo();
}
export function setInduccionComentario(codigo,key,val){
  const p=personas.find(x=>x.codigo===codigo);if(!p)return;
  const ind=ensureInduccion(p);
  if(!ind.checklist[key])ind.checklist[key]={checked:false,comentario:'',fecha:''};
  ind.checklist[key].comentario=val;
  saveAll();
}
export function setInduccionFecha(codigo,key,val){
  const p=personas.find(x=>x.codigo===codigo);if(!p)return;
  const ind=ensureInduccion(p);
  if(!ind.checklist[key])ind.checklist[key]={checked:false,comentario:'',fecha:''};
  ind.checklist[key].fecha=val;
  saveAll();
}
export function renderCapDocsList(p){
  const ind=ensureInduccion(p);
  const docs=ind.documentos||[];
  if(!docs.length)return '<p class="eval-empty" style="text-align:center">Sin documentos de respaldo cargados.</p>';
  return docs.slice().sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).map(d=>`
  <div class="doc-row">
    <i class="ti ti-file-text" aria-hidden="true"></i>
    <div class="doc-info"><span class="doc-tipo">${escapeHtml(d.nombreArchivo)}</span><span class="doc-fecha">${d.fecha?formatFecha(d.fecha):''}</span></div>
    <button class="btn-sec btn-sm" onclick="descargarCapDoc('${p.codigo}','${d.id}','${escapeHtml(d.nombreArchivo)}')"><i class="ti ti-download" aria-hidden="true"></i></button>
    <button class="btn-del" onclick="eliminarCapDoc('${p.codigo}','${d.id}')" title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button>
  </div>`).join('');
}
export async function subirCapDoc(codigo,sid){
  if(!sbReady())return;
  const p=personas.find(x=>x.codigo===codigo);if(!p)return;
  const fileInput=g('capdoc-file-'+sid);
  let file=fileInput.files[0];
  if(!file){alert('Selecciona un archivo primero.');return;}
  if(file.size>15*1024*1024){alert('El archivo es muy grande (máximo 15MB).');return;}
  file=await comprimirImagenSiHaceFalta(file);
  const id=Date.now()+'_'+Math.random().toString(36).slice(2,7);
  const path=codigo+'/'+id+'_'+file.name;
  try{
    const{error}=await sb.storage.from('capacitacion-documentos').upload(path,file);
    if(error)throw error;
  }catch(err){alert('No se pudo subir el archivo: '+(err.message||'intenta de nuevo.'));return;}
  ensureInduccion(p).documentos.push({id,nombreArchivo:file.name,fecha:new Date().toISOString().slice(0,10),storagePath:path});
  saveAll();
  fileInput.value='';
  renderEvalNuevo();
}
export function descargarCapDoc(codigo,id,nombreArchivo){
  if(!sbReady())return;
  const p=personas.find(x=>x.codigo===codigo);if(!p)return;
  const doc=ensureInduccion(p).documentos.find(d=>String(d.id)===String(id));
  if(!doc){alert('No se pudo encontrar el archivo.');return;}
  const{data}=sb.storage.from('capacitacion-documentos').getPublicUrl(doc.storagePath);
  window.open(data.publicUrl,'_blank');
}
export function eliminarCapDoc(codigo,id){
  if(!confirm('¿Eliminar este documento?'))return;
  const p=personas.find(x=>x.codigo===codigo);if(!p)return;
  const ind=ensureInduccion(p);
  const doc=ind.documentos.find(d=>String(d.id)===String(id));
  ind.documentos=ind.documentos.filter(d=>String(d.id)!==String(id));
  saveAll();
  if(doc&&doc.storagePath&&sb)sb.storage.from('capacitacion-documentos').remove([doc.storagePath]).catch(()=>{});
  renderEvalNuevo();
}
export function renderChecklistBlock(persona){
  const p=personas.find(x=>x.nombre===persona);
  if(!p)return'<p class="eval-empty">Persona no encontrada.</p>';
  const ind=ensureInduccion(p);
  const sid=safeId(p.codigo);
  return `
<div class="tbl-wrap">
<table class="checklist-tbl">
  <thead><tr><th>Inducción</th><th style="width:170px">Estado</th><th style="width:120px">Fecha</th></tr></thead>
  <tbody>
  ${CHECKLIST_INDUCCION.map(it=>{
    const st=ind.checklist[it.key]||{checked:false,comentario:'',fecha:''};
    return `
  <tr>
    <td class="checklist-tbl-tema">${it.label}</td>
    <td>
      <div class="checklist-toggle">
        <span class="ct-opt pend ${!st.checked?'sel':''}" onclick="setInduccionEstado('${p.codigo}','${it.key}',false)">Pendiente</span>
        <span class="ct-opt ok ${st.checked?'sel':''}" onclick="setInduccionEstado('${p.codigo}','${it.key}',true)">Realizada</span>
      </div>
    </td>
    <td><input type="date" value="${st.fecha||''}" onchange="setInduccionFecha('${p.codigo}','${it.key}',this.value)"></td>
  </tr>`;
  }).join('')}
  </tbody>
</table>
</div>
<hr class="sep">
<p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#7C3AED;margin:0 0 .6rem">Documentos de respaldo de capacitación</p>
<div id="capdocs-list-${sid}">${renderCapDocsList(p)}</div>
<div class="capdoc-upload-row">
  <input type="file" id="capdoc-file-${sid}" accept=".pdf,.jpg,.jpeg,.png" style="text-transform:none" data-filesrc="Elegir archivo">
  <button class="round-icon-btn" onclick="subirCapDoc('${p.codigo}','${sid}')" title="Subir documento" style="background:var(--surface-1,#f5f4f0)"><i class="ti ti-upload" aria-hidden="true"></i></button>
</div>`;
}

export function diasRestantes(p){
  if(!p.esNuevo||!p.fechaIngreso||!p.diasPrueba)return null;
  const ingreso=new Date(p.fechaIngreso+'T00:00:00');
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const diasPasados=Math.floor((hoy-ingreso)/86400000);
  return p.diasPrueba-diasPasados;
}
export function toggleNuevoField(){
  const chk=g('np-nuevo').checked;
  const diasInput=g('np-dias');
  diasInput.disabled=!chk;
  if(!chk)diasInput.value='';
}
export function toggleNuevoPersona(codigo){
  const p=personas.find(x=>x.codigo===codigo);if(!p)return;
  if(p.esNuevo){
    if(!confirm(`¿Quitar a ${p.nombre} de "Personal Nuevo"? Ya no aparecerá en esa sección.`))return;
    p.esNuevo=false;
  }else{
    const dias=prompt('¿Cuántos días de prueba tiene?','30');
    if(!dias||isNaN(dias)||parseInt(dias)<=0)return;
    p.esNuevo=true;p.diasPrueba=parseInt(dias);p.fechaIngreso=new Date().toISOString().slice(0,10);
  }
  saveAll();renderPersonas();
}
export let permModalCodigo=null;
export function openPermModal(codigo){
  const p=personas.find(x=>x.codigo===codigo);if(!p)return;
  permModalCodigo=codigo;
  const permisos=p.permisos||['regnew','regrep','dash','unireg','unimant','unirep'];
  g('perm-modal-name').textContent=`${p.nombre} · elige a qué secciones puede entrar`;
  g('perm-modal-list').innerHTML=ALL_PERM_ITEMS.map(it=>`
    <label class="perm-row"><input type="checkbox" value="${it.key}" ${permisos.includes(it.key)?'checked':''}>${it.label}</label>
  `).join('');
  g('perm-modal').style.display='flex';
}
export function closePermModal(){g('perm-modal').style.display='none';permModalCodigo=null;}
export function savePermModal(){
  const p=personas.find(x=>x.codigo===permModalCodigo);if(!p)return;
  const checked=[...document.querySelectorAll('#perm-modal-list input:checked')].map(i=>i.value);
  p.permisos=checked;
  saveAll();closePermModal();renderPersonas();
}
export function toggleEvalOpen(kind,persona){
  const s=evalOpen[kind];
  if(s.has(persona))s.delete(persona);else s.add(persona);
  if(kind==='fotos')renderEvalFotos();else renderEvalNuevo();
}
export function toggleSubAccordion(sub,persona){
  const key=sub+'::'+persona;
  const s=evalOpen.sub;
  if(s.has(key))s.delete(key);else s.add(key);
  renderEvalNuevo();
}
export function toggleAllEval(kind,open){
  const s=evalOpen[kind];s.clear();
  if(open){
    const names=kind==='fotos'?personas.filter(p=>p.rol==='operario').map(p=>p.nombre):nuevoPersonaList().map(p=>p.nombre);
    names.forEach(n=>s.add(n));
  }
  if(kind==='fotos')renderEvalFotos();else renderEvalNuevo();
}
export function toggleHistorial(){historialOpen=!historialOpen;renderEvalNuevo();}
export function nuevoPersonaList(){
  return personas.filter(p=>p.esNuevo&&diasRestantes(p)>0).sort((a,b)=>a.nombre.localeCompare(b.nombre));
}
export function graduadosList(){
  return personas.filter(p=>p.esNuevo&&diasRestantes(p)!==null&&diasRestantes(p)<=0).sort((a,b)=>a.nombre.localeCompare(b.nombre));
}

/* --- Metadata, seguimiento y fotos por OT ---
   Todo se persiste en Supabase: la ficha (seguimientos, reseña Google,
   comentarios, metadatos de fotos) en la tabla rolzzo_eval_fotos_ot, y los
   archivos reales (fotos y videos) en el bucket de Storage 'evaluacion-fotos'.
   Así lo que sube un instalador desde su celular lo ve el admin desde el PC. */
export let evalFotosOT={};
export function ensureEvalFotosOT(ot){
  if(!evalFotosOT[ot])evalFotosOT[ot]={seg1:'',seg1c:'',seg2:'',seg2c:'',seg3:'',seg3c:'',googleReview:false,comentarioGoogle:'',comentarioOperador:'',comentarioAdmin:'',adminNivel:0,tecnicosEvaluados:[],fotos:[],clasificacionContenido:null,seguimientoAlertaResuelto:false,seguimientoAlertaHecho:false,seguimientoAlertaFecha:''};
  if(!evalFotosOT[ot].fotos)evalFotosOT[ot].fotos=[];
  if(!evalFotosOT[ot].tecnicosEvaluados)evalFotosOT[ot].tecnicosEvaluados=[];
  if(evalFotosOT[ot].clasificacionContenido===undefined)evalFotosOT[ot].clasificacionContenido=null;
  if(evalFotosOT[ot].seguimientoAlertaResuelto===undefined)evalFotosOT[ot].seguimientoAlertaResuelto=false;
  if(evalFotosOT[ot].seguimientoAlertaHecho===undefined)evalFotosOT[ot].seguimientoAlertaHecho=false;
  return evalFotosOT[ot];
}
export async function dbUpsertEvalFotosOT(ot){
  if(!sbReady())return;
  const m=ensureEvalFotosOT(ot);
  try{
    const{error}=await sb.from('rolzzo_eval_fotos_ot').upsert([{
      ot,seg1_fecha:m.seg1||null,seg1_comentario:m.seg1c||'',
      seg2_fecha:m.seg2||null,seg2_comentario:m.seg2c||'',
      seg3_fecha:m.seg3||null,seg3_comentario:m.seg3c||'',
      google_review:!!m.googleReview,google_comentario:m.comentarioGoogle||'',
      comentario_operador:m.comentarioOperador||'',comentario_admin:m.comentarioAdmin||'',
      admin_nivel:m.adminNivel||0,tecnicos_evaluados:m.tecnicosEvaluados||[],
      clasificacion_contenido:m.clasificacionContenido||null,
      fotos:m.fotos||[],
      seguimiento_alerta_resuelto:!!m.seguimientoAlertaResuelto,
      seguimiento_alerta_hecho:!!m.seguimientoAlertaHecho,
      seguimiento_alerta_fecha:m.seguimientoAlertaFecha||null,
      updated_at:new Date().toISOString()
    }]);
    if(error)throw error;
  }catch(e){dbError('ficha de OT',e);}
}
export async function loadEvalFotosOT(){
  if(!sb)return;
  try{
    const{data}=await sb.from('rolzzo_eval_fotos_ot').select('*');
    if(!data)return;
    const next={};
    data.forEach(r=>{
      next[r.ot]={
        seg1:r.seg1_fecha||'',seg1c:r.seg1_comentario||'',
        seg2:r.seg2_fecha||'',seg2c:r.seg2_comentario||'',
        seg3:r.seg3_fecha||'',seg3c:r.seg3_comentario||'',
        googleReview:!!r.google_review,comentarioGoogle:r.google_comentario||'',
        comentarioOperador:r.comentario_operador||'',comentarioAdmin:r.comentario_admin||'',
        adminNivel:r.admin_nivel||0,tecnicosEvaluados:r.tecnicos_evaluados||[],
        clasificacionContenido:r.clasificacion_contenido||null,
        fotos:r.fotos||[],
        seguimientoAlertaResuelto:!!r.seguimiento_alerta_resuelto,
        seguimientoAlertaHecho:!!r.seguimiento_alerta_hecho,
        seguimientoAlertaFecha:r.seguimiento_alerta_fecha||''
      };
    });
    evalFotosOT=next;
  }catch(e){console.error('Error cargando fichas de OT:',e);}
}
export function setEvalFotosOTField(ot,field,val){ensureEvalFotosOT(ot)[field]=val;dbUpsertEvalFotosOT(ot);}
export function fotoOTUrl(f){
  if(f.storagePath&&sbReady()){try{return sb.storage.from('evaluacion-fotos').getPublicUrl(f.storagePath).data.publicUrl;}catch(e){}}
  return '';
}
export function isAdminUser(){return !!(session&&session.rol==='admin');}
/* Cantidad total de fotos/videos subidos por un instalador, en todas las OTs */
export function operatorFotoCount(nombre){
  let n=0;
  for(const ot in evalFotosOT){(evalFotosOT[ot].fotos||[]).forEach(f=>{if(f.uploadedBy===nombre)n++;});}
  return n;
}
/* Nota promedio general (estrellas que le ha puesto la jefatura) */
export function operatorNotaGeneral(nombre){
  const evs=evaluacionesFotos.filter(e=>e.persona===nombre&&e.nivel);
  if(!evs.length)return{avg:0,count:0};
  return{avg:evs.reduce((s,e)=>s+e.nivel,0)/evs.length,count:evs.length};
}
/* Último feedback de jefatura para ese instalador, buscando en todas las fichas de OT */
export function operatorUltimoFeedback(nombre){
  let best=null;
  for(const ot in evalFotosOT){
    const m=evalFotosOT[ot];
    if(m.comentarioAdmin&&(m.tecnicosEvaluados||[]).includes(nombre)){
      if(!best||(m.seg1||'')>(best.fecha||''))best={fecha:m.seg1||'',texto:m.comentarioAdmin,ot};
    }
  }
  return best;
}
export function renderFotosOT(ot,isAdmin){
  const fotos=ensureEvalFotosOT(ot).fotos||[];
  if(!fotos.length)return '<p class="eval-empty">Aún no se han subido fotos ni videos para esta OT.</p>';
  const otJs=String(ot).replace(/'/g,"\\'");
  return '<div class="ef-fotos-grid">'+fotos.slice().sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).map(f=>{
    const src=fotoOTUrl(f);
    const isImg=(f.mimeType||'').startsWith('image/');
    const isVid=(f.mimeType||'').startsWith('video/');
    let media;
    if(isImg&&src)media=`<img src="${src}" alt="${escapeHtml(f.nombreArchivo)}" onclick="verFotoOT('${otJs}','${f.id}')">`;
    else if(isVid&&src)media=`<video src="${src}" muted onclick="verFotoOT('${otJs}','${f.id}')" style="width:100%;height:96px;object-fit:cover;cursor:pointer"></video>`;
    else media=`<div class="ef-foto-ph" onclick="verFotoOT('${otJs}','${f.id}')"><i class="ti ti-file" aria-hidden="true"></i></div>`;
    return `
    <div class="ef-foto-card">
      ${isVid?'<i class="ti ti-player-play" aria-hidden="true" style="position:absolute;margin:38px 0 0 42px;color:#fff;font-size:18px;pointer-events:none"></i>':''}
      ${media}
      <span class="ef-foto-cat ${f.categoria==='redes'?'cat-redes':'cat-tec'}" title="${f.categoria==='redes'?'Material para redes sociales':'Respaldo técnico'}">${f.categoria==='redes'?'<i class="ti ti-palette" aria-hidden="true"></i>':'<i class="ti ti-tool" aria-hidden="true"></i>'}</span>
      ${f.uploadedBy?`<div class="ef-foto-by"><i class="ti ti-user" aria-hidden="true"></i>${escapeHtml(f.uploadedBy)}</div>`:''}
      <div class="ef-foto-meta"><span class="ef-foto-name" title="${escapeHtml(f.nombreArchivo)}">${escapeHtml(f.nombreArchivo)}</span><button class="btn-del" onclick="eliminarFotoOT('${otJs}','${f.id}')"><i class="ti ti-trash" aria-hidden="true"></i></button></div>
    </div>`;
  }).join('')+'</div>';
}
/* --- Selección pendiente (drag&drop) antes de subir --- */
export let pendingFilesOT={};
export function pendingKey(ot){return safeId(String(ot));}
export function handleFilesSelected(ot,fileList,categoria){
  const key=pendingKey(ot);
  if(!pendingFilesOT[key])pendingFilesOT[key]=[];
  [...fileList].forEach(f=>pendingFilesOT[key].push({file:f,categoria:categoria||'tecnico'}));
  renderPendingPreview(ot);
}
export function renderPendingPreview(ot){
  const key=pendingKey(ot);
  const el=g('ot-pending-'+key);
  if(!el)return;
  const items=pendingFilesOT[key]||[];
  if(!items.length){el.innerHTML='';return;}
  el.innerHTML='<div class="ot-pending-grid">'+items.map((it,i)=>{
    const f=it.file;
    const url=URL.createObjectURL(f);
    const isVid=f.type.startsWith('video/');
    const catLabel=it.categoria==='redes'?'REDES SOCIALES':'RESPALDO TÉCNICO';
    return `<div class="ot-pending-card">${isVid?`<video src="${url}" muted></video><span class="ot-pending-tag">VIDEO</span>`:`<img src="${url}">`}<span class="ot-pending-cat" title="${catLabel}">${it.categoria==='redes'?'<i class="ti ti-palette" aria-hidden="true"></i>':'<i class="ti ti-tool" aria-hidden="true"></i>'}</span><button class="rm" onclick="removePendingFile('${key}',${i})" title="Quitar"></button></div>`;
  }).join('')+'</div>';
}
export function removePendingFile(key,i){
  pendingFilesOT[key].splice(i,1);
  if(otContext)renderPendingPreview(otContext.ot);
}
export async function subirFotosOT(ot){
  const key=pendingKey(ot);
  const items=pendingFilesOT[key]||[];
  if(!items.length){alert('Arrastra o selecciona una o más fotos/videos primero.');return;}
  if(!sbReady())return;
  const meta=ensureEvalFotosOT(ot);
  const by=currentUserName();
  let omitidas=0;
  for(const it of items){
    let file=it.file;
    if(file.size>25*1024*1024){omitidas++;continue;}
    file=await comprimirImagenSiHaceFalta(file);
    const id=Date.now()+'_'+Math.random().toString(36).slice(2,7);
    const path='OT_'+String(ot).replace(/[^a-zA-Z0-9]/g,'_')+'/'+id+'_'+file.name;
    try{
      const{error}=await sb.storage.from('evaluacion-fotos').upload(path,file);
      if(error)throw error;
      meta.fotos.push({id,nombreArchivo:file.name,fecha:new Date().toISOString().slice(0,10),mimeType:file.type,storagePath:path,uploadedBy:by,categoria:it.categoria||'tecnico'});
    }catch(err){omitidas++;console.error('Error subiendo archivo:',err);}
  }
  await dbUpsertEvalFotosOT(ot);
  pendingFilesOT[key]=[];
  if(omitidas)alert(omitidas+' archivo(s) no se pudieron subir (revisa tamaño <25MB o tu conexión).');
  searchOT();
}
export function verFotoOT(ot,id){
  const f=(ensureEvalFotosOT(ot).fotos||[]).find(x=>String(x.id)===String(id));
  if(!f)return;
  const url=fotoOTUrl(f);
  if(url)window.open(url,'_blank');
  else alert('No se pudo abrir el archivo.');
}
export function eliminarFotoOT(ot,id){
  if(!confirm('¿Eliminar este archivo?'))return;
  const meta=ensureEvalFotosOT(ot);
  const f=meta.fotos.find(x=>String(x.id)===String(id));
  meta.fotos=meta.fotos.filter(x=>String(x.id)!==String(id));
  if(f&&f.storagePath&&sbReady())sb.storage.from('evaluacion-fotos').remove([f.storagePath]).catch(()=>{});
  dbUpsertEvalFotosOT(ot);
  searchOT();
}
export function toggleGoogleReview(ot,val){
  const m=ensureEvalFotosOT(ot);
  m.googleReview=val;
  if(!val)m.comentarioGoogle='';
  dbUpsertEvalFotosOT(ot);
  searchOT();
}
export function toggleTecEvaluado(ot,nombre){
  const m=ensureEvalFotosOT(ot);
  const i=m.tecnicosEvaluados.indexOf(nombre);
  if(i>=0)m.tecnicosEvaluados.splice(i,1);else m.tecnicosEvaluados.push(nombre);
  searchOT();
}
export function setAdminNivel(ot,n){
  ensureEvalFotosOT(ot).adminNivel=n;
  searchOT();
}
export async function guardarNotaAdmin(ot){
  const m=ensureEvalFotosOT(ot);
  if(!m.adminNivel){alert('Elige una calificación de 1 a 5 estrellas.');return;}
  if(!m.tecnicosEvaluados.length){alert('Selecciona al menos un técnico al que aplica esta nota.');return;}
  const r=registros.find(x=>x.ot===ot);
  const fecha=(r&&r.fecha)||new Date().toISOString().slice(0,10);
  for(const persona of m.tecnicosEvaluados){
    let e=evaluacionesFotos.find(e=>e.ot===ot&&e.persona===persona);
    if(e){e.nivel=m.adminNivel;}
    else{e={id:Date.now()+'_'+Math.random().toString(36).slice(2,7),ot,persona,fecha,mes:mesFromFecha(fecha),nivel:m.adminNivel};evaluacionesFotos.push(e);}
    await dbUpsertEvalFoto(e);
  }
  await dbUpsertEvalFotosOT(ot);
  if(currentTab==='seg_fotos'){searchOT();renderEvalFotos();}
  alert('Evaluación guardada para: '+m.tecnicosEvaluados.join(', '));
}

/* --- Evaluación de Fotos (por OT) — flujo por roles --- */
export function esMiOT(r){
  if(!r)return false;
  if(isAdminUser())return true;
  const nombre=currentUserName();
  return [r.tec1,r.tec2,r.tec3,r.tec4,...(r.tecnicosExtra||[])].filter(Boolean).includes(nombre);
}
export function searchOT(otValArg,resultElIdArg){
  const otVal=(otValArg!==undefined?otValArg:g('ef-ot-search').value).trim();
  const resultEl=g(resultElIdArg||'ef-ot-result');
  if(!resultEl)return;
  if(!otVal){resultEl.innerHTML='';return;}
  const regs=registros.filter(r=>(r.ot||'').toLowerCase()===otVal.toLowerCase()).sort((a,b)=>(b.id||0)-(a.id||0));
  if(!regs.length){
    resultEl.innerHTML=`<div class="eval-empty" style="margin-top:.8rem">No se encontró la OT "${escapeHtml(otVal)}" en los registros. Verifica el número o que el técnico ya haya guardado la visita.</div>`;
    return;
  }
  if(!esMiOT(regs[0])){
    resultEl.innerHTML=`<div class="eval-empty" style="margin-top:.8rem">Esta OT no está asignada a ti, así que no puedes ver su ficha. Si crees que es un error, avisa a un administrador.</div>`;
    return;
  }
  const r=regs[0];
  const ot=r.ot;
  const otJs=String(ot).replace(/'/g,"\\'");
  const sid=safeId(String(ot));
  const key=pendingKey(ot);
  const tecs=[...new Set(regs.flatMap(x=>[x.tec1,x.tec2,x.tec3,x.tec4,...(x.tecnicosExtra||[])]).filter(Boolean))];
  const meta=ensureEvalFotosOT(ot);
  const instaladores=tecs.join(', ')||'—';
  const isAdmin=isAdminUser();

  /* ---------- BLOQUE 1: cabecera horizontal de la OT ---------- */
  const bloque1=`
  <div class="ot-block" style="--bc:#4F46E5">
    <div class="ot-header-strip">
      <div class="ot-header-cell"><label>OT</label><span>${escapeHtml(String(ot))}</span></div>
      <div class="ot-header-cell"><label>Cliente</label><span>${escapeHtml(r.cliente||'—')}</span></div>
      <div class="ot-header-cell"><label>Tipo de cortina</label><span>${escapeHtml(r.tipoCortina||'—')}</span></div>
      <div class="ot-header-cell"><label>Cantidad</label><span>${r.cantidad||'—'}</span></div>
      <div class="ot-header-cell"><label>Técnico principal</label><span>${escapeHtml(r.tec1||'—')}</span></div>
      <div class="ot-header-cell"><label>Fecha</label><span>${r.fecha?formatFecha(r.fecha):'—'}</span></div>
    </div>
  </div>`;

  /* ---------- BLOQUE 2: evidencia multimedia ---------- */
  const dropzone=`
    <div class="ef-dz-grid">
      <div>
        <p class="sec-lbl" style="--sec-color:#4F46E5;margin-top:0"><i class="ti ti-tool" aria-hidden="true"></i>Fotos de Respaldo Técnico</p>
        <div class="ot-dropzone" id="ot-dz-tec-${sid}"
          onclick="abrirSelectorArchivo(this,(files)=>handleFilesSelected('${otJs}',files,'tecnico'))"
          ondragover="event.preventDefault();this.classList.add('drag')"
          ondragleave="this.classList.remove('drag')"
          ondrop="event.preventDefault();this.classList.remove('drag');handleFilesSelected('${otJs}',event.dataTransfer.files,'tecnico')">
          <i class="ti ti-cloud-upload" aria-hidden="true"></i>
          <p>Evidencia técnica del trabajo</p>
          <small>JPG, PNG, WEBP o MP4 · máx. 25MB</small>
        </div>
      </div>
      <div>
        <p class="sec-lbl" style="--sec-color:#C2427A;margin-top:0"><i class="ti ti-palette" aria-hidden="true"></i>Material para Redes Sociales</p>
        <div class="ot-dropzone" id="ot-dz-redes-${sid}"
          onclick="abrirSelectorArchivo(this,(files)=>handleFilesSelected('${otJs}',files,'redes'))"
          ondragover="event.preventDefault();this.classList.add('drag')"
          ondragleave="this.classList.remove('drag')"
          ondrop="event.preventDefault();this.classList.remove('drag');handleFilesSelected('${otJs}',event.dataTransfer.files,'redes')">
          <i class="ti ti-cloud-upload" aria-hidden="true"></i>
          <p>Foto/video atractivo para difundir</p>
          <small>JPG, PNG, WEBP o MP4 · máx. 25MB</small>
        </div>
      </div>
    </div>
    <div id="ot-pending-${key}"></div>
    <button class="dl-btn" style="background:#4F46E5;margin-top:.8rem" onclick="subirFotosOT('${otJs}')"><i class="ti ti-upload" aria-hidden="true"></i>Subir a la ficha</button>`;

  const comentarioOperador=isAdmin?`
    <div class="field" style="margin-top:.7rem"><label>Comentario del instalador</label>
      <div class="ef-readbox">${meta.comentarioOperador?escapeHtml(meta.comentarioOperador):'<span style="color:var(--text-muted)">Sin comentario del instalador.</span>'}</div>
    </div>`:`
    <div class="field" style="margin-top:.7rem"><label>Comentario del instalador</label><textarea rows="2" oninput="setEvalFotosOTField('${otJs}','comentarioOperador',this.value)" placeholder="Cuéntale a la jefatura cómo quedó el trabajo...">${escapeHtml(meta.comentarioOperador||'')}</textarea></div>`;

  const bloque2=`
  <div class="ot-block" style="--bc:#4F46E5">
    <div class="ot-block-head"><span class="ot-block-title"><span class="ot-block-num">2</span><i class="ti ti-photo" aria-hidden="true"></i>Evidencia multimedia</span></div>
    <div id="ef-fotos-list-${sid}">${renderFotosOT(ot,isAdmin)}</div>
    ${dropzone}
    ${comentarioOperador}
  </div>`;

  /* ---------- BLOQUE 3: seguimiento del cliente + reseña Google ---------- */
  const segCard=(n,fechaVal,comVal)=>`
    <div class="seg-card">
      <label>Seguimiento ${n} · Fecha</label>
      <input type="date" value="${fechaVal||''}" onchange="setEvalFotosOTField('${otJs}','seg${n}',this.value)" style="margin-bottom:.5rem">
      <label>Comentario</label>
      <textarea rows="2" oninput="setEvalFotosOTField('${otJs}','seg${n}c',this.value)" placeholder="Notas del seguimiento ${n}...">${escapeHtml(comVal||'')}</textarea>
    </div>`;

  const googleBlock=meta.googleReview?`
    <div class="google-toggle">
      <button class="gt-btn sel-si" onclick="toggleGoogleReview('${otJs}',true)"><i class="ti ti-check" aria-hidden="true"></i> Sí, dejó reseña</button>
      <button class="gt-btn" onclick="toggleGoogleReview('${otJs}',false)">No</button>
    </div>
    <textarea rows="3" oninput="setEvalFotosOTField('${otJs}','comentarioGoogle',this.value)" placeholder="Pega aquí exactamente el comentario que dejó el cliente en Google...">${escapeHtml(meta.comentarioGoogle||'')}</textarea>`:`
    <div class="google-toggle">
      <button class="gt-btn" onclick="toggleGoogleReview('${otJs}',true)">Sí, dejó reseña</button>
      <button class="gt-btn sel-no" onclick="toggleGoogleReview('${otJs}',false)"><i class="ti ti-x" aria-hidden="true"></i> No, todavía</button>
    </div>`;

  const bloque3=`
  <div class="ot-block" style="--bc:#eda100">
    <div class="ot-block-head"><span class="ot-block-title"><span class="ot-block-num" style="background:#eda100">3</span><i class="ti ti-message-star" aria-hidden="true"></i>Seguimiento del cliente y reseña Google</span></div>
    <div class="seg-grid">
      ${segCard(1,meta.seg1,meta.seg1c)}
      ${segCard(2,meta.seg2,meta.seg2c)}
      ${segCard(3,meta.seg3,meta.seg3c)}
    </div>
    <hr class="sep">
    <p class="sec-lbl" style="--sec-color:#eda100">¿El cliente terminó de dejar su reseña en Google?</p>
    ${googleBlock}
  </div>`;

  /* ---------- BLOQUE 4: feedback de jefatura (solo admin) ---------- */
  const starPicker=`
    <div class="stars-picker">
      ${[1,2,3,4,5].map(n=>`<button data-n="${n}" class="${meta.adminNivel===n?'sel':''}" onclick="setAdminNivel('${otJs}',${n})"><i class="ti ti-star${meta.adminNivel>=n?'-filled':''}" aria-hidden="true"></i>${n} Estrella${n>1?'s':''}</button>`).join('')}
    </div>`;
  const tecCheck=`
    <p class="sec-lbl" style="--sec-color:#C2427A;margin-top:0">¿A quién aplica esta nota?</p>
    <div class="tec-check-grid">
      ${tecs.map(t=>{const sel=meta.tecnicosEvaluados.includes(t);const tJs=t.replace(/'/g,"\\'");return `<label class="tec-check ${sel?'sel':''}" onclick="event.preventDefault();toggleTecEvaluado('${otJs}','${tJs}')"><input type="checkbox" ${sel?'checked':''}>${escapeHtml(t)}</label>`;}).join('')}
      ${tecs.length>1?`<label class="tec-check" onclick="event.preventDefault();tecs_selectAll_${sid}()">Marcar todos</label>`:''}
    </div>`;

  const bloqueAdmin=isAdmin?`
  <div class="ot-block" style="--bc:#C2427A">
    <div class="ot-block-head"><span class="ot-block-title"><span class="ot-block-num" style="background:#C2427A">4</span><i class="ti ti-shield-star" aria-hidden="true"></i>Feedback de jefatura</span></div>
    <p class="sec-lbl" style="--sec-color:#C2427A;margin-top:0">Calidad general del trabajo</p>
    ${starPicker}
    ${tecCheck}
    <div class="field"><label>Comentario final / coaching de calidad</label><textarea rows="3" oninput="setEvalFotosOTField('${otJs}','comentarioAdmin',this.value)" placeholder="Retroalimentación para el equipo...">${escapeHtml(meta.comentarioAdmin||'')}</textarea></div>
    <button class="btn" style="margin-top:.7rem" onclick="guardarNotaAdmin('${otJs}')"><i class="ti ti-device-floppy" aria-hidden="true"></i>Guardar evaluación</button>
  </div>`:`
  <div class="ot-block" style="--bc:#C2427A;opacity:.85">
    <div class="ot-block-head"><span class="ot-block-title"><span class="ot-block-num" style="background:#C2427A">4</span><i class="ti ti-shield-star" aria-hidden="true"></i>Feedback de jefatura</span></div>
    <div class="ef-waiting"><i class="ti ti-clock-hour-4" aria-hidden="true"></i>
      ${meta.comentarioAdmin?`<div><b>Retroalimentación de administración:</b><br>${escapeHtml(meta.comentarioAdmin)}${meta.adminNivel?` · ${'★'.repeat(meta.adminNivel)}${'☆'.repeat(5-meta.adminNivel)}`:''}</div>`:'Esperando evaluación de administración...'}
    </div>
  </div>`;

  /* ---------- BLOQUE 5: invitación a reseña de Google (directo por WhatsApp) ---------- */
  const bloque5=`
  <div class="ot-block" style="--bc:#1D6F42">
    <div class="ot-block-head"><span class="ot-block-title"><span class="ot-block-num" style="background:#1D6F42">5</span><i class="ti ti-brand-whatsapp" aria-hidden="true"></i>Invitación a reseña para el cliente</span></div>
    <p style="font-size:11.5px;color:var(--text-muted);margin:-.3rem 0 1rem;text-align:center">Completa los datos y abre WhatsApp con el mensaje ya escrito, listo para enviar.</p>
    <div class="fg" style="max-width:640px;margin:0 auto">
      <div class="field"><label>Nombre cliente</label><input type="text" id="inv-cliente-${sid}" value="${escapeHtml(r.cliente||'')}"></div>
      <div class="field"><label>Nombre técnico</label><input type="text" id="inv-tecnico-${sid}" value="${escapeHtml(r.tec1||'')}"></div>
    </div>
    <div style="text-align:center;margin-top:1.1rem">
      <button class="btn" style="background:#1D6F42;border-color:#1D6F42" onclick="generarInvitacionWhatsapp('${otJs}')"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i>Enviar por WhatsApp</button>
    </div>
  </div>`;

  resultEl.innerHTML=`
<div style="margin-top:.9rem">
  <div class="eval-section-head" style="margin-bottom:.6rem">
    <span class="eval-section-title" style="font-size:14px">OT ${escapeHtml(String(ot))}<span class="eval-section-date">${r.cliente?escapeHtml(r.cliente)+' · ':''}Instaladores: ${escapeHtml(instaladores)}</span></span>
    <span class="eval-role-tag">${isAdmin?'<i class="ti ti-shield-check" aria-hidden="true"></i> Administración':'<i class="ti ti-user" aria-hidden="true"></i> Instalador'}</span>
  </div>
  <div class="ot-blocks">
    ${bloque1}
    ${bloque2}
    ${bloque3}
    ${bloqueAdmin}
    ${bloque5}
  </div>
</div>`;
  window['tecs_selectAll_'+sid]=function(){tecs.forEach(t=>{if(!meta.tecnicosEvaluados.includes(t))meta.tecnicosEvaluados.push(t);});searchOT();};
  renderPendingPreview(ot);
}
