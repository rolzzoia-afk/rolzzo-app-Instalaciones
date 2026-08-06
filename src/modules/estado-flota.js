import { MANT_PARAMS, lists, vehiculoData } from './core-data.js';
import { escapeHtml, formatFecha, isAdminUser } from './evaluaciones.js';
import { abrirModalDetalleFlota } from './flota-regla-detalle-modal.js';
import { abrirModalAgregarMantencionFlota, eliminarReglaFlota } from './flota-regla-modal.js';
import { g } from './form-helpers.js';
import { ensureVehData, kmActualVeh } from './mantenciones-vehiculos.js';
import { addPatenteChipBtn } from './reportes-unidad.js';

/* ===== ESTADO DE FLOTA ===== */
export let flotaSelected=null;
export function __set_flotaSelected(v){ flotaSelected = v; }
export let flotaEditId=null;
export function __set_flotaEditId(v){ flotaEditId = v; } /* id de la regla que se está editando en el modal, o null si es nueva */
export function getFlotaEditId(){return flotaEditId;}

/* Cada regla vive en vehiculoData[patente].reglasMant = [
     {id, desc, modo:'km'|'tiempo', intervaloKm, intervaloMeses, ultimoKm, ultimaFecha}
   ]
   - modo 'km': se compara contra el kilometraje actual de la patente (kmActualVeh).
   - modo 'tiempo': se compara contra la fecha de hoy.
   Ambos guardan opcionalmente el otro dato por si se quiere mostrar, pero el
   cálculo del semáforo usa solo el modo elegido.

   Desde que Mantenciones pasó a ser un historial (cada subida agrega una
   fila nueva a reglasMant en vez de sobreescribir una ficha única), puede
   haber más de una fila con el mismo "desc" (ej. "Cambio de Aceite" hecho
   dos veces). reglaMasReciente() devuelve la fila más nueva de un tipo, y
   reglasFlota() usa eso para que Estado de Flota siempre muestre el estado
   ACTUAL de cada tipo de mantención, no todo el historial repetido. */
export function reglaMasReciente(reglas,desc){
  const coincidencias=(reglas||[]).filter(r=>r.desc===desc);
  if(!coincidencias.length)return null;
  return coincidencias.slice().sort((a,b)=>(a.ultimaFecha||'').localeCompare(b.ultimaFecha||''))[coincidencias.length-1];
}
export function reglasFlota(patente){
  const vd=ensureVehData(patente);
  if(!vd.reglasMant)vd.reglasMant=[];
  const nombres=[...new Set(vd.reglasMant.map(r=>r.desc))];
  return nombres.map(desc=>reglaMasReciente(vd.reglasMant,desc)).filter(Boolean);
}
/* Calcula % de vida restante, texto de "pendiente" y "restante", y color
   del semáforo para una regla concreta. Cortes de color:
   verde 100–50% · amarillo 49–25% · rojo 24–0% (o vencido). */
export function calcEstadoReglaFlota(regla,patente){
  if(regla.modo==='km'){
    const intervalo=parseInt(regla.intervaloKm)||0;
    const ultimo=parseInt(regla.ultimoKm)||0;
    if(!intervalo)return{estado:'verde',pendiente:'Sin intervalo definido',restante:'—',pct:100,vigenteTexto:'Sin intervalo definido'};
    const proximo=ultimo+intervalo;
    const kmA=kmActualVeh(patente);
    if(kmA===null)return{estado:'verde',pendiente:'Se debe cambiar en '+proximo.toLocaleString('es-CL')+' km',restante:'Sin viajes registrados',pct:100,vigenteTexto:'VIGENTE HASTA: '+proximo.toLocaleString('es-CL')+' km',kmActual:null,inconsistente:false};
    /* Dato mal cargado: si el KM actual real (el más alto registrado en
       Unidad) queda POR DEBAJO del KM que se ingresó como "último cambio",
       significa que hay un viaje con kilometraje mal tipeado antes de esa
       fecha, o que el km del cambio se ingresó mal. En ese caso no tiene
       sentido mostrar "excedido": se avisa la inconsistencia y se muestra
       el estado como vigente (verde) hasta que se corrija el dato. */
    const inconsistente=kmA<ultimo;
    if(inconsistente){
      const faltan=proximo-ultimo;
      return{estado:'verde',pendiente:'Se debe cambiar en '+proximo.toLocaleString('es-CL')+' km',
        restante:faltan.toLocaleString('es-CL')+' km restantes',pct:100,
        vigenteTexto:'VIGENTE HASTA: '+proximo.toLocaleString('es-CL')+' km',
        kmActual:kmA,inconsistente:true};
    }
    const recorrido=kmA-ultimo;
    const restanteKm=proximo-kmA;
    const pct=Math.max(0,Math.min(100,Math.round((restanteKm/intervalo)*100)));
    const pendiente='Se debe cambiar en '+proximo.toLocaleString('es-CL')+' km';
    const restante=restanteKm<=0?(Math.abs(restanteKm).toLocaleString('es-CL')+' km excedidos'):(restanteKm.toLocaleString('es-CL')+' km restantes');
    const vigenteTexto=restanteKm<=0?'VENCIDO · '+Math.abs(restanteKm).toLocaleString('es-CL')+' km excedidos':'VIGENTE HASTA: '+proximo.toLocaleString('es-CL')+' km';
    return{estado:claseSemaforoPct(pct),pendiente,restante,pct,vigenteTexto,kmActual:kmA,inconsistente:false};
  }
  /* modo tiempo (meses) */
  const meses=parseInt(regla.intervaloMeses)||0;
  if(!meses||!regla.ultimaFecha)return{estado:'verde',pendiente:'Sin datos',restante:'—',pct:100,vigenteTexto:'Sin datos',kmActual:null,inconsistente:false};
  const base=new Date(regla.ultimaFecha+'T12:00:00');
  const venc=new Date(base);venc.setMonth(venc.getMonth()+meses);
  const hoy=new Date();hoy.setHours(12,0,0,0);
  const diasTotales=Math.max(1,Math.round((venc-base)/86400000));
  const diasRest=Math.round((venc-hoy)/86400000);
  const pct=Math.max(0,Math.min(100,Math.round((diasRest/diasTotales)*100)));
  const mesesRest=Math.round(diasRest/30);
  const pendiente='Se cambia cada '+meses+(meses===1?' mes':' meses');
  let restante;
  if(diasRest<=0)restante='Vencido hace '+Math.abs(mesesRest)+(Math.abs(mesesRest)===1?' mes':' meses');
  else if(mesesRest>=1)restante='Queda '+mesesRest+(mesesRest===1?' mes':' meses');
  else restante='Queda '+diasRest+(diasRest===1?' día':' días');
  const vigenteTexto=diasRest<=0?'VENCIDO · hace '+Math.abs(mesesRest)+(Math.abs(mesesRest)===1?' mes':' meses'):'VIGENTE HASTA: '+formatFecha(venc.toISOString().slice(0,10));
  return{estado:claseSemaforoPct(pct),pendiente,restante,pct,vigenteTexto,kmActual:null,inconsistente:false};
}
export function claseSemaforoPct(pct){
  if(pct>=50)return'verde';
  if(pct>=25)return'amarillo';
  return'rojo';
}
export function renderFlotaChips(){
  const chipsEl=g('flota-chips');
  if(!chipsEl)return;
  if(!lists.vehiculos.length){
    chipsEl.innerHTML=addPatenteChipBtn('flota');
    return;
  }
  if(!flotaSelected||!lists.vehiculos.includes(flotaSelected))__set_flotaSelected(lists.vehiculos[0]);
  chipsEl.innerHTML=lists.vehiculos.map(p=>`<span class="patente-chip ${flotaSelected===p?'sel':''}" onclick="selectPatenteFlota('${p.replace(/'/g,"\\'")}')">${p}</span>`).join('')+addPatenteChipBtn('flota');
}
export function selectPatenteFlota(p){__set_flotaSelected(p);renderFlotaChips();renderEstadoFlota();}
export const ORDEN_SEMAFORO={rojo:0,amarillo:1,verde:2};
export function renderEstadoFlota(){
  renderFlotaChips();
  const wrap=g('flota-rows');
  if(!wrap)return;
  if(!lists.vehiculos.length){
    wrap.innerHTML='<div class="empty-s" style="padding:1.5rem"><p style="font-size:13px">No hay vehículos cargados.</p><p style="font-size:12px">Agrégalos en Listas → Vehículos (patentes).</p></div>';
    return;
  }
  /* Se muestran TODAS las mantenciones que ya tengan algún dato cargado
     (fecha, km o documento) — antes se filtraban las que no tenían
     intervaloKm/intervaloMeses definido, lo que escondía por error
     mantenciones recién ingresadas (ej. con un nombre sin parámetro fijo en
     MANT_PARAMS). El jefe necesita ver aquí toda mantención ingresada,
     tenga o no un intervalo oficial calculado. */
  const reglas=reglasFlota(flotaSelected).filter(r=>r.ultimoKm||r.ultimaFecha||(r.documentos&&r.documentos.length));
  if(!reglas.length){
    wrap.innerHTML=`<div class="empty-s" style="padding:1.5rem"><p style="font-size:13px">Sin mantenciones registradas para ${escapeHtml(flotaSelected)}.</p><p style="font-size:12px">Se muestran aquí automáticamente apenas se ingresen desde Mantenciones → Ingreso de mantención.</p></div>`;
    return;
  }
  /* Se calcula el estado de cada regla y se ordena con los rojos primero,
     luego amarillos, luego verdes; dentro de cada color, el más urgente
     primero (menor % de vida restante). */
  const calc=reglas.map(r=>({regla:r,est:calcEstadoReglaFlota(r,flotaSelected)}))
    .sort((a,b)=>ORDEN_SEMAFORO[a.est.estado]-ORDEN_SEMAFORO[b.est.estado]||a.est.pct-b.est.pct);
  const admin=isAdminUser();
  wrap.innerHTML=calc.map(({regla,est})=>{
    const kmLine=(regla.modo==='km'&&est.kmActual!==null&&est.kmActual!==undefined)?
      `<div class="flota-row-km">
        <span>Kilometraje actual: ${est.kmActual.toLocaleString('es-CL')} km</span>
        ${est.inconsistente?`<span class="warn"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Revisa el KM del último cambio: el vehículo registra menos km que ese valor</span>`:''}
      </div>`:'';
    /* Datos siempre visibles en la fila, sin tener que abrir el detalle:
       fecha y km en que se hizo la mantención, y quién la registró. */
    const infoLine=`<div class="flota-row-km">
      <span>${regla.ultimaFecha?'Hecha el '+formatFecha(regla.ultimaFecha):'Sin fecha registrada'}${regla.ultimoKm?' · '+Number(regla.ultimoKm).toLocaleString('es-CL')+' km':''}</span>
      ${regla.creadoPor?`<span>Registrado por ${escapeHtml(regla.creadoPor)}</span>`:''}
    </div>`;
    return `
    <div class="flota-row ${est.estado}">
      <span class="flota-row-desc">${escapeHtml(regla.desc||'—')}</span>
      <span class="flota-row-pend">${escapeHtml(est.pendiente)}</span>
      <span class="flota-row-rest">${escapeHtml(est.restante)}</span>
      ${infoLine}
      ${kmLine}
      <div class="flota-row-actions">
        <button class="btn-sec btn-sm" title="Ver detalle completo" onclick="abrirModalDetalleFlota('${regla.id}')"><i class="ti ti-info-circle" aria-hidden="true"></i> Detalle</button>
        ${admin?`<button class="btn-sec btn-sm" onclick="abrirModalAgregarMantencionFlota('${regla.id}')"><i class="ti ti-pencil" aria-hidden="true"></i> Editar</button>`:''}
        ${admin?`<button class="btn-del" style="display:inline-flex" title="Eliminar" onclick="eliminarReglaFlota('${regla.id}')"><i class="ti ti-trash" aria-hidden="true"></i></button>`:''}
      </div>
    </div>`;
  }).join('');
}
