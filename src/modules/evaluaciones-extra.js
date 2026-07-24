import { dbDeleteEvalFoto, dbDeleteEvalNuevo, dbDeleteEvalNuevoIds, dbUpsertEvalFoto, dbUpsertEvalNuevo, dbUpsertEvalNuevoMany } from './bootstrap.js';
import { MESES, registros } from './core-data.js';
import { CATS_NUEVO, DIAS_SEMANA, __set_evaluacionesFotos, __set_evaluacionesNuevo, avgLabel, dbUpsertEvalFotosOT, diasRestantes, ensureEvalFotosOT, esMiOT, escapeHtml, evalFotosOT, evalOpen, evaluacionesFotos, evaluacionesNuevo, formatFecha, graduadosList, historialOpen, isAdminUser, mesFromFecha, nuevoPersonaList, openObsEditor, renderChecklistBlock, renderComentariosBlock, renderDetalleEvalBlock, safeId, searchOT, setEvalFotosOTField, subAccordion, toggleEvalOpen } from './evaluaciones.js';
import { g } from './form-helpers.js';
import { exportPersonaPDF, generarAgradecimientoWhatsapp, generarInvitacionWhatsapp } from './selector-foto-galeria.js';

/* ===== BLOQUE 5: invitación a reseña de Google (directo por WhatsApp) ===== */
export function starRow(ot,persona,fecha,current){
  const pSafe=persona.replace(/'/g,"\\'");
  let html='<div class="star-row">';
  for(let i=1;i<=5;i++){
    html+=`<button class="star-btn ${current&&i<=current?'on':''}" onclick="rateOT('${ot}','${pSafe}','${fecha}',${i})" title="${i} estrella${i>1?'s':''}"><i class="ti ti-star${current&&i<=current?'-filled':''}" aria-hidden="true"></i></button>`;
  }
  html+='</div>';
  return html;
}
export function rateOT(ot,persona,fecha,nivel){
  let e=evaluacionesFotos.find(e=>e.ot===ot&&e.persona===persona);
  if(e){e.nivel=nivel;}
  else{e={id:Date.now()+'_'+Math.random().toString(36).slice(2,7),ot,persona,fecha,mes:mesFromFecha(fecha),nivel};evaluacionesFotos.push(e);}
  dbUpsertEvalFoto(e);searchOT();renderEvalFotos();
}
export function removeEvalFotos(id){
  if(!confirm('¿Quitar esta evaluación?'))return;
  __set_evaluacionesFotos(evaluacionesFotos.filter(e=>e.id!==id));
  dbDeleteEvalFoto(id);renderEvalFotos();
}
export function renderEvalFotos(){
  renderEvalFotosAcordeon();
}

/* --- Evaluación de Fotos: acordeón puro dividido en Pendientes / Historial --- */
export let efAcordeonOtAbierta=null;
export function __set_efAcordeonOtAbierta(v){ efAcordeonOtAbierta = v; }
export function computeAcordeonFotosOTs(){
  const byOt={};
  registros.forEach(r=>{
    if(!r.ot)return;
    if(!esMiOT(r))return;
    const prev=byOt[r.ot];
    if(!prev||(r.id||0)>(prev.id||0))byOt[r.ot]=r;
  });
  return Object.values(byOt).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
}
/* Todos los campos del panel (estrellas, técnico, clasificación) llenos —
   pero eso YA NO mueve la OT a Historial por sí solo. Jefatura pidió que el
   paso a "Ya evaluadas" ocurra únicamente al presionar "Guardar evaluación"
   (ver evaluacionGuardada/guardarNotaAdminAcc), porque antes cada estrella
   que tocaban movía la fila de sección en el momento y los hacía perder el
   lugar donde estaban parados. */
export function evaluacionCompleta(m){
  return !!(m&&m.adminNivel&&m.tecnicosEvaluados&&m.tecnicosEvaluados.length&&m.clasificacionContenido);
}
/* Único gatillo real para pasar de Pendientes a Historial: que exista un
   registro guardado (botón "Guardar evaluación") para esa OT. evaluacionesFotos
   solo se llena ahí (ver guardarNotaAdminAcc), nunca al tocar un campo suelto. */
export function evaluacionGuardada(ot){
  return evaluacionesFotos.some(e=>e.ot===ot);
}
/* Jefatura pidió que "Solo Respaldo Técnico" NO cuente como evaluación real:
   solo lo clasificado "Apta para Redes Sociales" debe sumar en el reporte de
   calidad y en los rankings (nota fotográfica promedio, top fotografía, etc). */
export function cuentaComoEvaluada(m,ot){
  return evaluacionGuardada(ot)&&!!(m&&m.clasificacionContenido==='redes');
}
/* Una evaluación "iniciada pero no completa": jefatura alcanzó a tocar algo
   del panel (puso estrellas, clasificó el contenido, dejó comentario o
   marcó un técnico) pero le faltó terminar el resto — el caso más común es
   poner las estrellas y no llegar a marcar el técnico ni guardar. Se marca
   distinto de "Pendiente" (nadie la ha tocado) para que no quede a medio
   camino sin que nadie se dé cuenta. */
export function evaluacionIniciada(m){
  if(!m||evaluacionCompleta(m))return false;
  return !!(m.adminNivel||m.clasificacionContenido||m.comentarioAdmin||(m.tecnicosEvaluados&&m.tecnicosEvaluados.length));
}
export function computeAcordeonFotosPendientes(){
  return computeAcordeonFotosOTs().filter(r=>!evaluacionGuardada(r.ot));
}
export function computeAcordeonFotosHistorial(){
  return computeAcordeonFotosOTs().filter(r=>evaluacionGuardada(r.ot));
}
export function renderEvalFotosAccRow(r){
  const otJs=String(r.ot).replace(/'/g,"\\'");
  const abierta=efAcordeonOtAbierta===String(r.ot);
  const m=evalFotosOT[r.ot];
  const guardada=evaluacionGuardada(r.ot);
  const evaluada=cuentaComoEvaluada(m,r.ot);
  const soloTecnico=guardada&&!evaluada;
  const listaParaGuardar=!guardada&&evaluacionCompleta(m);
  const iniciada=!guardada&&!listaParaGuardar&&evaluacionIniciada(m);
  const badgeCls=evaluada?'b-ok':(soloTecnico?'b-inst':((listaParaGuardar||iniciada)?'b-err':'badge-pendiente'));
  const badgeIcon=evaluada?'ti-circle-check':(soloTecnico?'ti-tool':(listaParaGuardar?'ti-device-floppy':(iniciada?'ti-alert-triangle':'ti-clock-hour-4')));
  const badgeTxt=evaluada?'Evaluada':(soloTecnico?'Respaldo Técnico':(listaParaGuardar?'Falta guardar':(iniciada?'Incompleta':'Pendiente')));
  return `<div class="ef-acc-item${abierta?' ef-acc-item-open':''}">
    <div class="reg-row resena-row" onclick="toggleEvalFotosAcordeonItem('${otJs}')">
      <div class="reg-row-info">
        <span class="reg-row-fecha">${r.fecha?formatFecha(r.fecha):'—'}</span>
        <span class="reg-row-ot">OT ${escapeHtml(String(r.ot))}</span>
        <span class="reg-row-cliente">${escapeHtml(r.cliente||'—')}</span>
        <span class="reg-row-tec">${r.tec1?escapeHtml(r.tec1):'—'}</span>
      </div>
      <div class="reg-row-actions">
        <span class="badge ${badgeCls}" ${listaParaGuardar?'title="Estrellas, técnico y clasificación listos: presiona \'Guardar evaluación\' para que pase al Historial."':(iniciada?'title="Se clasificó o comentó, pero faltan las estrellas y/o marcar el técnico."':(soloTecnico?'title="Guardada como Respaldo Técnico: no cuenta en el reporte de calidad ni en los rankings."':''))}><i class="ti ${badgeIcon}" aria-hidden="true"></i> ${badgeTxt}</span>
        <i class="ti ti-chevron-${abierta?'down':'right'}" aria-hidden="true" style="color:var(--text-muted);font-size:14px"></i>
      </div>
    </div>
    <div class="ef-acc-body" id="ef-acc-body-${safeId(String(r.ot))}">${abierta?renderEvalFotosAccContent(r.ot):''}</div>
  </div>`;
}
export function renderEvalFotosAcordeon(){
  const listEl=g('ef-acordeon-list');
  const histEl=g('ef-acordeon-hist-list');
  if(!listEl||!histEl)return;
  const pendientes=computeAcordeonFotosPendientes();
  const historial=computeAcordeonFotosHistorial();
  listEl.innerHTML=pendientes.length
    ?pendientes.map(renderEvalFotosAccRow).join('')
    :'<div class="empty-s"><i class="ti ti-circle-check" aria-hidden="true" style="font-size:28px;display:block;margin-bottom:.5rem;color:#1D6F42"></i><p style="font-size:13px;font-weight:500">Sin pendientes</p><p style="font-size:12px">No hay OTs pendientes de evaluación de fotos por ahora.</p></div>';
  histEl.innerHTML=historial.length
    ?historial.map(renderEvalFotosAccRow).join('')
    :'<div class="empty-s"><i class="ti ti-inbox" aria-hidden="true" style="font-size:28px;display:block;margin-bottom:.5rem;opacity:.4"></i><p style="font-size:13px;font-weight:500">Sin historial todavía</p><p style="font-size:12px">Cuando la jefatura evalúe una OT, aparecerá aquí.</p></div>';
}
export function toggleEvalFotosAcordeonItem(ot){
  __set_efAcordeonOtAbierta((efAcordeonOtAbierta===String(ot))?null:String(ot));
  renderEvalFotosAcordeon();
}
export function renderEvalFotosAccContent(ot){
  const regs=registros.filter(r=>(r.ot||'')===String(ot)).sort((a,b)=>(b.id||0)-(a.id||0));
  const r=regs[0];
  if(!r||!esMiOT(r))return '<div class="eval-empty">No se pudo abrir esta OT.</div>';
  const otJs=String(ot).replace(/'/g,"\\'");
  const meta=ensureEvalFotosOT(ot);
  const isAdmin=isAdminUser();
  const tecs=[...new Set(regs.flatMap(x=>[x.tec1,x.tec2,x.tec3,x.tec4,...(x.tecnicosExtra||[])]).filter(Boolean))];

  const starPicker=`
    <div class="stars-picker">
      ${[1,2,3,4,5].map(n=>`<button data-n="${n}" class="${meta.adminNivel===n?'sel':''}" ${isAdmin?`onclick="setAdminNivelAcc('${otJs}',${n})"`:'disabled'}><i class="ti ti-star${meta.adminNivel>=n?'-filled':''}" aria-hidden="true"></i>${n} Estrella${n>1?'s':''}</button>`).join('')}
    </div>`;
  const tecCheck=`
    <p class="sec-lbl" style="--sec-color:#C2427A;margin-top:0">¿A quién aplica esta nota?</p>
    <div class="tec-check-grid">
      ${tecs.map(t=>{const sel=meta.tecnicosEvaluados.includes(t);const tJs=t.replace(/'/g,"\\'");return `<label class="tec-check ${sel?'sel':''}" onclick="event.preventDefault();${isAdmin?`toggleTecEvaluadoAcc('${otJs}','${tJs}')`:''}">${isAdmin?`<input type="checkbox" ${sel?'checked':''}>`:(sel?'<i class="ti ti-check" aria-hidden="true" style="font-size:12px"></i> ':'')}${escapeHtml(t)}</label>`;}).join('')}
    </div>`;
  const clasifBlock=`
    <p class="sec-lbl" style="--sec-color:#C2427A;margin-top:1rem">Clasificación del contenido</p>
    <div class="google-toggle">
      <button class="gt-btn gt-gris${meta.clasificacionContenido==='tecnico'?' sel-gris':''}" ${isAdmin?`onclick="setClasificacionContenido('${otJs}','tecnico')"`:'disabled'}><i class="ti ti-tool" aria-hidden="true"></i> Solo Respaldo Técnico</button>
      <button class="gt-btn gt-gris${meta.clasificacionContenido==='redes'?' sel-gris':''}" ${isAdmin?`onclick="setClasificacionContenido('${otJs}','redes')"`:'disabled'}><i class="ti ti-palette" aria-hidden="true"></i> Apta para Redes Sociales</button>
    </div>`;

  if(isAdmin){
    return `
    <div class="ot-block" style="--bc:#C2427A;margin:0;border-top:none;border-radius:0">
      <div class="ot-block-head"><span class="ot-block-title"><span class="ot-block-num" style="background:#C2427A">•</span><i class="ti ti-shield-star" aria-hidden="true"></i>Feedback de jefatura</span></div>
      <p class="sec-lbl" style="--sec-color:#C2427A;margin-top:0">Calidad general del trabajo</p>
      ${starPicker}
      ${tecCheck}
      ${clasifBlock}
      <div class="field" style="margin-top:.8rem"><label>Comentario final / coaching de calidad</label><textarea rows="3" oninput="setEvalFotosOTFieldAcc('${otJs}',this.value)" placeholder="Retroalimentación para el equipo...">${escapeHtml(meta.comentarioAdmin||'')}</textarea></div>
      <button class="btn" style="margin-top:.7rem" onclick="guardarNotaAdminAcc('${otJs}')"><i class="ti ti-device-floppy" aria-hidden="true"></i>Guardar evaluación</button>
    </div>`;
  }
  return `
    <div class="ot-block" style="--bc:#C2427A;margin:0;border-top:none;border-radius:0;opacity:.92">
      <div class="ot-block-head"><span class="ot-block-title"><span class="ot-block-num" style="background:#C2427A">•</span><i class="ti ti-shield-star" aria-hidden="true"></i>Feedback de jefatura</span></div>
      ${meta.adminNivel?`
      <p class="sec-lbl" style="--sec-color:#C2427A;margin-top:0">Calidad general del trabajo</p>
      ${starPicker}
      ${tecCheck}
      ${clasifBlock}
      <div class="field" style="margin-top:.8rem"><label>Comentario final de jefatura</label><div class="ef-readbox">${meta.comentarioAdmin?escapeHtml(meta.comentarioAdmin):'<span style="color:var(--text-muted)">Sin comentario.</span>'}</div></div>
      `:`<div class="ef-waiting"><i class="ti ti-clock-hour-4" aria-hidden="true"></i>Esperando evaluación de administración...</div>`}
    </div>`;
}
/* Tocar estrellas/técnico/clasificación se auto-guarda en segundo plano
   (para no perder el trabajo si cierran sin querer) pero YA NO mueve la fila
   de "Pendientes" a "Historial" ni muestra ningún aviso — eso confundía a
   jefatura porque la fila desaparecía de la lista apenas ponían la 5ta
   estrella. El único que mueve la OT es el botón "Guardar evaluación"
   (guardarNotaAdminAcc), que además exige tener los 3 campos listos. */
export function setAdminNivelAcc(ot,n){
  if(!isAdminUser())return;
  ensureEvalFotosOT(ot).adminNivel=n;
  dbUpsertEvalFotosOT(ot);
  renderEvalFotosAcordeon();
}
export function toggleTecEvaluadoAcc(ot,nombre){
  if(!isAdminUser())return;
  const m=ensureEvalFotosOT(ot);
  const i=m.tecnicosEvaluados.indexOf(nombre);
  if(i>=0)m.tecnicosEvaluados.splice(i,1);else m.tecnicosEvaluados.push(nombre);
  dbUpsertEvalFotosOT(ot);
  renderEvalFotosAcordeon();
}
export function setClasificacionContenido(ot,val){
  if(!isAdminUser())return;
  const m=ensureEvalFotosOT(ot);
  m.clasificacionContenido=(m.clasificacionContenido===val)?null:val;
  dbUpsertEvalFotosOT(ot);
  renderEvalFotosAcordeon();
}
export function setEvalFotosOTFieldAcc(ot,val){
  if(!isAdminUser())return;
  ensureEvalFotosOT(ot).comentarioAdmin=val;
  dbUpsertEvalFotosOT(ot);
}
export async function guardarNotaAdminAcc(ot){
  if(!isAdminUser())return;
  const m=ensureEvalFotosOT(ot);
  if(!m.adminNivel){alert('Elige una calificación de 1 a 5 estrellas.');return;}
  if(!m.tecnicosEvaluados.length){alert('Selecciona al menos un técnico al que aplica esta nota.');return;}
  if(!m.clasificacionContenido){alert('Indica si es "Solo Respaldo Técnico" o "Apta para Redes Sociales" antes de guardar.');return;}
  const eraGuardada=evaluacionGuardada(ot);
  const r=registros.find(x=>x.ot===ot);
  const fecha=(r&&r.fecha)||new Date().toISOString().slice(0,10);
  for(const persona of m.tecnicosEvaluados){
    let e=evaluacionesFotos.find(e=>e.ot===ot&&e.persona===persona);
    if(e){e.nivel=m.adminNivel;}
    else{e={id:Date.now()+'_'+Math.random().toString(36).slice(2,7),ot,persona,fecha,mes:mesFromFecha(fecha),nivel:m.adminNivel};evaluacionesFotos.push(e);}
    await dbUpsertEvalFoto(e);
  }
  await dbUpsertEvalFotosOT(ot);
  renderEvalFotosAcordeon();
  const esRedes=m.clasificacionContenido==='redes';
  if(eraGuardada){
    alert('Evaluación actualizada para: '+m.tecnicosEvaluados.join(', ')+'.');
  }else if(esRedes){
    alert('¡Evaluación guardada para: '+m.tecnicosEvaluados.join(', ')+'! Se movió a "Historial · Ya evaluadas".');
  }else{
    alert('Evaluación guardada para: '+m.tecnicosEvaluados.join(', ')+' como "Respaldo Técnico". Se movió al Historial, pero no cuenta en el reporte de calidad ni en los rankings.');
  }
}

/* --- Seguimiento · Reseñas: acordeón puro dividido en Pendientes / Alerta / Historial.
   A diferencia de la ficha de evaluación completa, este panel es compartido: cualquier
   usuario logueado ve el seguimiento/reseñas de TODAS las OT (no solo las propias),
   para que el equipo tenga visibilidad conjunta de cómo van las reseñas de Google. */
export function computeResenasTodas(){
  const byOt={};
  registros.forEach(r=>{
    if(!r.ot)return;
    const prev=byOt[r.ot];
    if(!prev||(r.id||0)>(prev.id||0))byOt[r.ot]=r;
  });
  return Object.values(byOt).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
}
/* Días transcurridos entre la fecha de ingreso de la OT y hoy. Devuelve null si la
   OT no tiene fecha válida. */
export function diasDesdeFechaOT(fechaStr){
  if(!fechaStr)return null;
  const fechaOT=new Date(fechaStr+'T00:00:00');
  if(isNaN(fechaOT.getTime()))return null;
  const hoy=new Date();
  hoy.setHours(0,0,0,0);
  const diffMs=hoy-fechaOT;
  return Math.floor(diffMs/86400000);
}
export const SEG_ALERTA_DIAS=7;
/* Filtro de mes vigente: por defecto solo se muestran las OT del mes actual.
   Si se marca "Ver historial completo" o se elige un mes específico en el filtro,
   se accede al resto de los datos. */
export function segResenasMesActivo(){
  const chk=g('seg-resenas-ver-todo');
  if(chk&&chk.checked)return null;
  const sel=g('seg-resenas-fil-mes');
  if(sel&&sel.value)return sel.value;
  return MESES[new Date().getMonth()];
}
export function computeResenasTodasFiltradas(){
  const mes=segResenasMesActivo();
  const todas=computeResenasTodas();
  if(!mes)return todas;
  return todas.filter(r=>r.mes===mes);
}
/* Pendientes recientes: sin reseña Google REAL todavía (evalFotosOT.googleReview,
   que se marca en el módulo de Seguimiento cuando el cliente efectivamente la
   dejó), con menos de 7 días desde el ingreso. El campo r.google del formulario
   de OT nueva NO cuenta acá: ese campo solo indica si ya se le avisó al
   cliente que debe dejar la reseña, no que la haya dejado. */
export function computeResenasPendientes(){
  return computeResenasTodasFiltradas().filter(r=>{
    const meta=evalFotosOT[r.ot];
    if(meta&&meta.googleReview)return false;
    const dias=diasDesdeFechaOT(r.fecha);
    return dias===null||dias<SEG_ALERTA_DIAS;
  });
}
/* Alerta de seguimiento: sin reseña Google REAL, con 7 días o más desde el ingreso,
   y todavía sin respuesta de seguimiento (sí/no). Misma regla de roles que el
   resto del sistema (esMiOT). Una vez respondida, sale de esta lista.
   A propósito NO se filtra por el mes vigente: una OT puede quedar atrasada
   en un mes anterior y debe seguir apareciendo aquí hasta que se resuelva. */
export function computeResenasAlerta(){
  return computeResenasTodas().filter(r=>{
    const meta=evalFotosOT[r.ot];
    if(meta&&meta.googleReview)return false;
    const dias=diasDesdeFechaOT(r.fecha);
    if(dias===null||dias<SEG_ALERTA_DIAS)return false;
    return !(meta&&meta.seguimientoAlertaResuelto);
  }).sort((a,b)=>(diasDesdeFechaOT(b.fecha)||0)-(diasDesdeFechaOT(a.fecha)||0));
}
/* Historial: reseñas ya obtenidas de verdad (googleReview, respetando el filtro
   de mes vigente), más las OT que vinieron de una Alerta de Seguimiento ya
   resuelta (haya sido "Sí" o "No"). Estas últimas se muestran siempre, sin
   importar el mes, para no perder trazabilidad de una alerta que quedó
   pendiente de un mes anterior. */
export function computeResenasHistorial(){
  const conResenaDelMes=computeResenasTodasFiltradas().filter(r=>{
    const meta=evalFotosOT[r.ot];
    return !!(meta&&meta.googleReview);
  });
  const deAlertaResuelta=computeResenasTodas().filter(r=>{
    const meta=evalFotosOT[r.ot];
    if(meta&&meta.googleReview)return false;
    return !!(meta&&meta.seguimientoAlertaResuelto);
  });
  const vistos=new Set();
  const combinado=[];
  [...conResenaDelMes,...deAlertaResuelta].forEach(r=>{
    if(vistos.has(r.ot))return;
    vistos.add(r.ot);
    combinado.push(r);
  });
  return combinado.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
}
export function clearSegResenasFil(){
  const sel=g('seg-resenas-fil-mes');if(sel)sel.value='';
  const chk=g('seg-resenas-ver-todo');if(chk)chk.checked=false;
  renderSegResenas();
}
/* Registra si se hizo o no seguimiento a una OT en Alerta. Cualquiera de las dos
   respuestas resuelve la alerta y la OT pasa a ordenarse en el Historial de abajo,
   sin desplegar el acordeón completo de seguimiento. */
export function marcarSeguimientoAlerta(ot,hecho){
  const m=ensureEvalFotosOT(ot);
  m.seguimientoAlertaResuelto=true;
  m.seguimientoAlertaHecho=hecho;
  m.seguimientoAlertaFecha=new Date().toISOString().slice(0,10);
  dbUpsertEvalFotosOT(ot);
  renderSegResenas();
}
export let segResenaOtActiva=null;
export function __set_segResenaOtActiva(v){ segResenaOtActiva = v; }
export function renderSegResenaRow(r,pendiente){
  const otJs=String(r.ot).replace(/'/g,"\\'");
  const abierta=segResenaOtActiva===String(r.ot);
  const sid=safeId(String(r.ot));
  const meta=evalFotosOT[r.ot];
  const tieneResena=!!(meta&&meta.googleReview);
  const vinoDeAlerta=!tieneResena&&meta&&meta.seguimientoAlertaResuelto;
  let badgeCls='badge-pendiente',badgeIcon='ti-clock-hour-4',badgeTxt='Pendiente';
  if(!pendiente){
    if(tieneResena){badgeCls='b-ok';badgeIcon='ti-circle-check';badgeTxt='Reseña obtenida';}
    else if(vinoDeAlerta){badgeCls=meta.seguimientoAlertaHecho?'b-ok':'badge-alerta';badgeIcon=meta.seguimientoAlertaHecho?'ti-circle-check':'ti-x';badgeTxt=meta.seguimientoAlertaHecho?'Seguimiento realizado':'Sin seguimiento · sin reseña';}
  }
  return `<div class="ef-acc-item${abierta?' ef-acc-item-open':''}">
    <div class="reg-row resena-row" onclick="toggleSegResenaItem('${otJs}')">
      <div class="reg-row-info">
        <span class="reg-row-fecha">${r.fecha?formatFecha(r.fecha):'—'}</span>
        <span class="reg-row-ot">OT ${escapeHtml(String(r.ot))}</span>
        <span class="reg-row-cliente">${escapeHtml(r.cliente||'—')}</span>
        <span class="reg-row-tec">${r.tec1?escapeHtml(r.tec1):'—'}</span>
      </div>
      <div class="reg-row-actions">
        <span class="badge ${badgeCls}"><i class="ti ${badgeIcon}" aria-hidden="true"></i> ${badgeTxt}</span>
        <i class="ti ti-chevron-${abierta?'down':'right'}" aria-hidden="true" style="color:var(--text-muted);font-size:14px"></i>
      </div>
    </div>
    <div class="ef-acc-body" id="seg-resenas-body-${sid}">${abierta?renderSegResenaAccContent(r.ot):''}</div>
  </div>`;
}
/* Fila de la sección "Alerta de Seguimiento": prioriza N° de OT, operador responsable
   y fecha de ingreso original, con los días de atraso bien visibles. A diferencia de
   las filas de Pendientes e Historial, esta fila NO se despliega en acordeón: solo
   muestra dos botones (No / Sí) para registrar si ya se hizo seguimiento. Cualquiera
   de las dos respuestas envía la OT al Historial de abajo, ordenada por fecha. */
export function renderSegResenaAlertaRow(r){
  const otJs=String(r.ot).replace(/'/g,"\\'");
  const dias=diasDesdeFechaOT(r.fecha);
  return `<div class="reg-row resena-row resena-row-alerta">
      <div class="reg-row-info">
        <span class="reg-row-ot"><i class="ti ti-alert-triangle" aria-hidden="true" style="color:#C22C2C;margin-right:2px"></i>OT ${escapeHtml(String(r.ot))}</span>
        <span class="reg-row-tec"><i class="ti ti-user" aria-hidden="true"></i> ${r.tec1?escapeHtml(r.tec1):'—'}</span>
        <span class="reg-row-fecha">Ingreso: ${r.fecha?formatFecha(r.fecha):'—'}</span>
        <span class="reg-row-cliente" style="font-weight:400;color:var(--text-muted)">${escapeHtml(r.cliente||'—')}</span>
      </div>
      <div class="reg-row-actions">
        <span class="badge badge-alerta"><i class="ti ti-clock-exclamation" aria-hidden="true"></i> ${dias!==null?dias:'?'} días sin cerrar</span>
        <span class="resena-alerta-seg-btns">
          <span style="font-size:10.5px;color:var(--text-muted);margin-right:2px">¿Seguimiento hecho?</span>
          <button class="resena-seg-btn seg-no" onclick="marcarSeguimientoAlerta('${otJs}',false)" title="No se ha hecho seguimiento"><i class="ti ti-x" aria-hidden="true"></i>No</button>
          <button class="resena-seg-btn seg-si" onclick="marcarSeguimientoAlerta('${otJs}',true)" title="Sí, ya se hizo seguimiento"><i class="ti ti-check" aria-hidden="true"></i>Sí</button>
        </span>
      </div>
    </div>`;
}
export function renderSegResenas(){
  const listEl=g('seg-resenas-list');
  const alertaEl=g('seg-resenas-alerta-list');
  const histEl=g('seg-resenas-hist-list');
  if(!listEl||!histEl)return;
  const filMesEl=g('seg-resenas-fil-mes');
  if(filMesEl&&filMesEl.options.length===0){
    filMesEl.innerHTML='<option value="">Mes vigente</option>'+MESES.map(m=>`<option value="${m}">${m}</option>`).join('');
  }
  const pendientes=computeResenasPendientes();
  const alerta=computeResenasAlerta();
  const historial=computeResenasHistorial();
  listEl.innerHTML=pendientes.length
    ?pendientes.map(r=>renderSegResenaRow(r,true)).join('')
    :'<div class="empty-s"><i class="ti ti-circle-check" aria-hidden="true" style="font-size:28px;display:block;margin-bottom:.5rem;color:#1D6F42"></i><p style="font-size:13px;font-weight:500">Sin pendientes</p><p style="font-size:12px">No hay OTs pendientes de reseña de Google por ahora.</p></div>';
  if(alertaEl){
    alertaEl.innerHTML=alerta.length
      ?alerta.map(r=>renderSegResenaAlertaRow(r)).join('')
      :'<div class="empty-s"><i class="ti ti-shield-check" aria-hidden="true" style="font-size:28px;display:block;margin-bottom:.5rem;color:#1D6F42"></i><p style="font-size:13px;font-weight:500">Sin alertas</p><p style="font-size:12px">No hay OTs estancadas por más de 7 días sin reseña.</p></div>';
  }
  const alertaCountEl=g('seg-resenas-alerta-count');
  if(alertaCountEl)alertaCountEl.textContent=alerta.length?`${alerta.length}`:'0';
  histEl.innerHTML=historial.length
    ?historial.map(r=>renderSegResenaRow(r,false)).join('')
    :'<div class="empty-s"><i class="ti ti-inbox" aria-hidden="true" style="font-size:28px;display:block;margin-bottom:.5rem;opacity:.4"></i><p style="font-size:13px;font-weight:500">Sin historial todavía</p><p style="font-size:12px">Cuando una OT obtenga su reseña de Google, aparecerá aquí.</p></div>';
}
export function toggleSegResenaItem(ot){
  __set_segResenaOtActiva((segResenaOtActiva===String(ot))?null:String(ot));
  renderSegResenas();
}
export function renderSegResenaAccContent(ot){
  const r=registros.filter(x=>(x.ot||'')===String(ot)).sort((a,b)=>(b.id||0)-(a.id||0))[0];
  if(!r)return '<div class="eval-empty">No se pudo abrir esta OT.</div>';
  const otJs=String(ot).replace(/'/g,"\\'");
  const sid=safeId(String(ot));
  const meta=ensureEvalFotosOT(ot);

  const segCard=(n,fechaVal,comVal)=>`
    <div class="seg-card">
      <label>Seguimiento ${n} · Fecha</label>
      <input type="date" value="${fechaVal||''}" onchange="setEvalFotosOTField('${otJs}','seg${n}',this.value)" style="margin-bottom:.5rem">
      <label>Comentario</label>
      <textarea rows="2" oninput="setEvalFotosOTField('${otJs}','seg${n}c',this.value)" placeholder="Notas del seguimiento ${n}...">${escapeHtml(comVal||'')}</textarea>
    </div>`;

  const googleBlock=meta.googleReview?`
    <div class="google-toggle">
      <button class="gt-btn sel-si" onclick="toggleSegResenaGoogle('${otJs}',true)"><i class="ti ti-check" aria-hidden="true"></i> Sí, la dejó</button>
      <button class="gt-btn" onclick="toggleSegResenaGoogle('${otJs}',false)">No todavía</button>
    </div>
    <textarea rows="3" oninput="setEvalFotosOTField('${otJs}','comentarioGoogle',this.value)" placeholder="Pega aquí exactamente el comentario que dejó el cliente en Google...">${escapeHtml(meta.comentarioGoogle||'')}</textarea>`:`
    <div class="google-toggle">
      <button class="gt-btn" onclick="toggleSegResenaGoogle('${otJs}',true)"><i class="ti ti-check" aria-hidden="true"></i> Sí, la dejó</button>
      <button class="gt-btn sel-no" onclick="toggleSegResenaGoogle('${otJs}',false)"><i class="ti ti-x" aria-hidden="true"></i> No todavía</button>
    </div>`;

  return `
  <div class="ot-blocks" style="margin:0">
    <div class="ot-block" style="--bc:#eda100;margin:0;border-top:none;border-radius:0">
      <div class="ot-block-head"><span class="ot-block-title"><span class="ot-block-num" style="background:#eda100">1</span><i class="ti ti-message-star" aria-hidden="true"></i>Seguimiento del cliente y reseña Google</span></div>
      <div class="seg-grid">
        ${segCard(1,meta.seg1,meta.seg1c)}
        ${segCard(2,meta.seg2,meta.seg2c)}
        ${segCard(3,meta.seg3,meta.seg3c)}
      </div>
      <hr class="sep">
      <p class="sec-lbl" style="--sec-color:#eda100">¿El cliente terminó de dejar su reseña en Google?</p>
      ${googleBlock}
    </div>
    <div class="ot-block ot-block-wa${meta.googleReview?' ot-block-wa-gracias':''}" style="--bc:#1D6F42;margin:0;border-top:none;border-radius:0">
      <div class="ot-block-head"><span class="ot-block-title"><span class="ot-block-num" style="background:#1D6F42">2</span><i class="ti ti-brand-whatsapp" aria-hidden="true"></i>${meta.googleReview?'Agradecimiento por su reseña':'Invitación a reseña para el cliente'}</span></div>
      <p style="font-size:11.5px;color:var(--text-muted);margin:-.3rem 0 1rem;text-align:center">${meta.googleReview?'El cliente ya dejó su reseña — envíale un agradecimiento con un mensaje ya escrito, listo para mandar.':'Completa los datos y abre WhatsApp con el mensaje ya escrito, listo para enviar.'}</p>
      <div class="fg" style="max-width:640px;margin:0 auto">
        <div class="field"><label>Nombre cliente</label><input type="text" id="inv-cliente-${sid}" value="${escapeHtml(r.cliente||'')}"></div>
        <div class="field"><label>Nombre técnico</label><input type="text" id="inv-tecnico-${sid}" value="${escapeHtml(r.tec1||'')}"></div>
        <div class="field"><label>Teléfono cliente (WhatsApp)</label><input type="tel" id="inv-telefono-${sid}" value="${escapeHtml(r.telefono||'')}" placeholder="Ej: +56912345678"></div>
      </div>
      <div style="text-align:center;margin-top:1.1rem">
        ${meta.googleReview
          ?`<button class="btn wa-send-btn" onclick="generarAgradecimientoWhatsapp('${otJs}')"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i>Enviar agradecimiento por WhatsApp</button>`
          :`<button class="btn" style="background:#1D6F42;border-color:#1D6F42" onclick="generarInvitacionWhatsapp('${otJs}')"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i>Enviar por WhatsApp</button>`}
      </div>
    </div>
  </div>`;
}
export function toggleSegResenaGoogle(ot,val){
  const m=ensureEvalFotosOT(ot);
  m.googleReview=val;
  if(!val)m.comentarioGoogle='';
  dbUpsertEvalFotosOT(ot);
  renderSegResenas();
}
/* --- Evaluación de Personal Nuevo (días de prueba) --- */
export function clearEvalNuevoFil(){
  g('en-fil-persona').value='';g('en-fil-mes').value='';g('en-fil-fecha').value='';
  renderEvalNuevo();
}
export function mondayOf(dateStr){
  const d=new Date(dateStr+'T12:00:00');
  const day=d.getDay();
  const diff=(day===0?-6:1-day);
  d.setDate(d.getDate()+diff);
  return d.toISOString().slice(0,10);
}
export function addSemana(persona,sid){
  const dateVal=g('en-week-'+sid).value;
  if(!dateVal){alert('Elige una fecha dentro de la semana que quieres agregar.');return;}
  const monday=mondayOf(dateVal);
  if(evaluacionesNuevo.some(d=>d.persona===persona&&d.semana===monday)){alert('Esa semana ya está agregada para esta persona.');return;}
  const m=new Date(monday+'T12:00:00');
  const nuevos=[];
  DIAS_SEMANA.forEach((diaLabel,i)=>{
    const f=new Date(m);f.setDate(m.getDate()+i);
    const fechaStr=f.toISOString().slice(0,10);
    const d={id:Date.now()+'_'+i+'_'+Math.random().toString(36).slice(2,5),persona,semana:monday,dia:diaLabel,fecha:fechaStr,mes:mesFromFecha(fechaStr),cats:{},cortinas:'',tiempo:'',obs:''};
    evaluacionesNuevo.push(d);nuevos.push(d);
  });
  dbUpsertEvalNuevoMany(nuevos);renderEvalNuevo();
}
export function setDiaCat(id,key,val){
  const d=evaluacionesNuevo.find(x=>x.id===id);if(!d)return;
  d.cats[key]=(d.cats[key]===val)?null:val;
  dbUpsertEvalNuevo(d);renderEvalNuevo();
}
export function setDiaField(id,field,val){
  const d=evaluacionesNuevo.find(x=>x.id===id);if(!d)return;
  d[field]=val;dbUpsertEvalNuevo(d);
}
export function removeDiaNuevo(id){
  if(!confirm('¿Eliminar esta evaluación diaria?'))return;
  __set_evaluacionesNuevo(evaluacionesNuevo.filter(x=>x.id!==id));
  dbDeleteEvalNuevo(id);renderEvalNuevo();
}
export function removeSemana(persona,semana){
  if(!confirm('¿Eliminar toda esta semana de evaluación?'))return;
  const ids=evaluacionesNuevo.filter(x=>x.persona===persona&&x.semana===semana).map(x=>x.id);
  __set_evaluacionesNuevo(evaluacionesNuevo.filter(x=>!(x.persona===persona&&x.semana===semana)));
  dbDeleteEvalNuevoIds(ids);renderEvalNuevo();
}
export function catDots(dayId,key,current){
  return `<div class="cat-dots">
    <button class="dot d-baja ${current==='BAJA'?'on':''}" onclick="setDiaCat('${dayId}','${key}','BAJA')" title="Baja"></button>
    <button class="dot d-media ${current==='MEDIA'?'on':''}" onclick="setDiaCat('${dayId}','${key}','MEDIA')" title="Media"></button>
    <button class="dot d-alta ${current==='ALTA'?'on':''}" onclick="setDiaCat('${dayId}','${key}','ALTA')" title="Alta"></button>
  </div>`;
}
export function renderSemanaTable(persona,semana,weekDias){
  const scored={BAJA:1,MEDIA:2,ALTA:3};
  const byDia={};weekDias.forEach(d=>byDia[d.dia]=d);
  const monday=new Date(semana+'T12:00:00');
  const friday=new Date(monday);friday.setDate(monday.getDate()+4);
  const rangeLabel=`${formatFecha(semana)} – ${formatFecha(friday.toISOString().slice(0,10))}`;
  const allVals=[];weekDias.forEach(d=>CATS_NUEVO.forEach(c=>{if(d.cats[c.key])allVals.push(scored[d.cats[c.key]]);}));
  const semAvg=allVals.length?avgLabel(allVals.reduce((s,v)=>s+v,0)/allVals.length):{label:'Sin datos',cls:'sindata'};
  return `
<div class="week-block">
  <div class="week-block-head">
    <span class="week-range"><i class="ti ti-calendar-week" aria-hidden="true"></i>Semana ${rangeLabel}</span>
    <div style="display:flex;gap:6px;align-items:center">
      <span class="eval-avg-badge ${semAvg.cls}">Promedio semanal: ${semAvg.label}</span>
      <button class="btn-del" onclick="removeSemana('${persona.replace(/'/g,"\\'")}','${semana}')"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>
  </div>
  <div class="tbl-wrap">
  <table class="week-tbl">
    <thead><tr>
      <th>Día</th>${CATS_NUEVO.map(c=>`<th>${c.short}</th>`).join('')}<th>Cortinas</th><th>Tiempo</th><th>Obs.</th><th>Puntaje</th>
    </tr></thead>
    <tbody>
    ${DIAS_SEMANA.map(diaLabel=>{
      const d=byDia[diaLabel];
      if(!d)return `<tr><td><b>${diaLabel}</b></td><td colspan="${CATS_NUEVO.length+4}" style="color:var(--text-muted);font-size:11px">Sin datos</td></tr>`;
      const vals=CATS_NUEVO.map(c=>d.cats[c.key]).filter(Boolean);
      const dayAvg=vals.length?avgLabel(vals.reduce((s,v)=>s+scored[v],0)/vals.length):{label:'—',cls:'sindata'};
      return `
    <tr>
      <td><b>${diaLabel}</b><br><span style="font-size:9.5px;color:var(--text-muted)">${formatFecha(d.fecha)}</span></td>
      ${CATS_NUEVO.map(c=>`<td>${catDots(d.id,c.key,d.cats[c.key])}</td>`).join('')}
      <td><input type="number" min="0" value="${d.cortinas||''}" onchange="setDiaField('${d.id}','cortinas',this.value)" style="width:52px;padding:4px 5px;font-size:11px;text-align:center" placeholder="0"></td>
      <td><input type="text" value="${d.tiempo||''}" onchange="setDiaField('${d.id}','tiempo',this.value)" style="width:82px;padding:4px 5px;font-size:11px" placeholder="09:00–11:30"></td>
      <td><div class="obs-chip" onclick="openObsEditor('${d.id}')" title="${escapeHtml(d.obs||'Agregar comentario')}">${d.obs?escapeHtml(d.obs.length>9?d.obs.substring(0,9)+'…':d.obs):'<i class="ti ti-message-plus" aria-hidden="true"></i>'}</div></td>
      <td><span class="eval-avg-badge ${dayAvg.cls}" style="padding:3px 8px;font-size:9px">${dayAvg.label}</span></td>
    </tr>`;
    }).join('')}
    </tbody>
  </table>
  </div>
</div>`;
}
export function renderPersonaEvalCard(p,mes,fecha,kindOpen){
  const dr=diasRestantes(p);
  const scored={BAJA:1,MEDIA:2,ALTA:3};
  let dias=evaluacionesNuevo.filter(d=>d.persona===p.nombre);
  if(mes)dias=dias.filter(d=>d.mes===mes);
  if(fecha)dias=dias.filter(d=>d.fecha===fecha);
  const semanas=[...new Set(dias.map(d=>d.semana))].sort((a,b)=>b.localeCompare(a));
  const allVals=[];
  evaluacionesNuevo.filter(d=>d.persona===p.nombre).forEach(d=>CATS_NUEVO.forEach(c=>{if(d.cats[c.key])allVals.push(scored[d.cats[c.key]]);}));
  const avgInfo=allVals.length?avgLabel(allVals.reduce((s,v)=>s+v,0)/allVals.length):{label:'Sin datos',cls:'sindata'};
  const open=evalOpen[kindOpen].has(p.nombre);
  const sid=safeId(p.codigo);
  const nSafe=p.nombre.replace(/'/g,"\\'");
  const trialTag=dr!==null?(dr>0?`<span class="role-badge trial-badge" style="margin-left:2px">${dr} días</span>`:`<span class="role-badge" style="margin-left:2px;background:#EEE;color:#666">Prueba finalizada</span>`):'';
  return `
<div class="eval-worker">
  <div class="eval-worker-head" style="cursor:pointer;${open?'':'margin-bottom:0;padding-bottom:0;border-bottom:none'}" onclick="toggleEvalOpen('${kindOpen}','${nSafe}')">
    <div class="eval-worker-name"><i class="ti ti-chevron-${open?'down':'right'}" aria-hidden="true" style="font-size:14px;color:var(--text-muted)"></i><i class="ti ti-user-circle" aria-hidden="true" style="color:#7C3AED;font-size:19px"></i>${p.nombre}${trialTag}</div>
    <div style="display:flex;gap:8px;align-items:center">
      <span class="eval-avg-badge ${avgInfo.cls}">Promedio: ${avgInfo.label}</span>
      <button class="dl-btn" onclick="event.stopPropagation();exportPersonaPDF('${nSafe}')" title="Descargar PDF de ${nSafe}"><i class="ti ti-download" aria-hidden="true"></i>PDF</button>
    </div>
  </div>
  ${open?`
  ${kindOpen==='nuevo'?`
  <div class="eval-add-row">
    <div class="field"><label>Cualquier fecha de la semana a agregar</label><input type="date" id="en-week-${sid}" value="${new Date().toISOString().slice(0,10)}"></div>
    <button class="btn btn-sm" onclick="addSemana('${nSafe}','${sid}')"><i class="ti ti-calendar-plus" aria-hidden="true"></i>Agregar semana</button>
  </div>
  <hr class="sep">`:''}
  ${semanas.length?semanas.map(s=>renderSemanaTable(p.nombre,s,dias.filter(d=>d.semana===s))).join(''):'<p class="eval-empty">Sin semanas cargadas todavía.</p>'}
  ${renderDetalleEvalBlock(p.nombre,dias)}
  ${renderComentariosBlock(p.nombre,dias)}
  ${subAccordion('checklist',p.nombre,'Checklist de inducción','ti-checklist',renderChecklistBlock(p.nombre))}`:''}
</div>`;
}
export function renderEvalNuevo(){
  const filMesEl=g('en-fil-mes');
  if(filMesEl&&filMesEl.options.length===0)filMesEl.innerHTML='<option value="">Todos los meses</option>'+MESES.map(m=>`<option value="${m}">${m}</option>`).join('');
  const filPerEl=g('en-fil-persona');
  const list=nuevoPersonaList();
  if(filPerEl){const cur=filPerEl.value;filPerEl.innerHTML='<option value="">Todas</option>'+list.map(p=>`<option value="${p.nombre}">${p.nombre}</option>`).join('');filPerEl.value=cur;}
  const mes=filMesEl?filMesEl.value:'';
  const per=filPerEl?filPerEl.value:'';
  const fecha=g('en-fil-fecha')?g('en-fil-fecha').value:'';

  let filtList=per?list.filter(p=>p.nombre===per):list;
  const el=g('en-list');
  if(!filtList.length){el.innerHTML='<div class="empty-s"><i class="ti ti-user-plus" aria-hidden="true" style="font-size:26px;display:block;margin-bottom:.5rem;opacity:.4"></i><p style="font-size:13px;font-weight:500">No hay personal en período de prueba</p><p style="font-size:12px">Márcalos como "nuevo" desde la sección Personas.</p></div>';}
  else{
    el.innerHTML=filtList.map(p=>renderPersonaEvalCard(p,mes,fecha,'nuevo')).join('');
  }
  renderHistorial();
}
export function renderHistorial(){
  const wrap=g('en-historial-body');
  if(!wrap)return;
  g('en-hist-toggle-btn').innerHTML=`<i class="ti ti-chevron-${historialOpen?'down':'right'}" aria-hidden="true"></i> Historial de personal (período de prueba finalizado)`;
  if(!historialOpen){wrap.style.display='none';return;}
  wrap.style.display='block';
  const grads=graduadosList();
  const filPerEl=g('en-hist-fil-persona');
  if(filPerEl){const cur=filPerEl.value;filPerEl.innerHTML='<option value="">Todas</option>'+grads.map(p=>`<option value="${p.nombre}">${p.nombre}</option>`).join('');filPerEl.value=cur;}
  const per=filPerEl?filPerEl.value:'';
  const list=per?grads.filter(p=>p.nombre===per):grads;
  const listEl=g('en-hist-list');
  if(!list.length){listEl.innerHTML='<div class="empty-s"><p style="font-size:12.5px">Aún no hay personal con período de prueba finalizado.</p></div>';return;}
  listEl.innerHTML=list.map(p=>renderPersonaEvalCard(p,'','','historial')).join('');
}
