import { lists } from './core-data.js';
import { escapeHtml } from './evaluaciones.js';
import { g, tecnicosList } from './form-helpers.js';
import { probOpts, scheduleRegDraftSave } from './registro-adjuntos.js';

/* ===== Técnicos adicionales (más allá de los 4 fijos) ===== */
export let tecnicosExtra=[];
export function __set_tecnicosExtra(v){ tecnicosExtra = v; }
export function renderTecnicosExtra(){
  const cont=g('tecnicos-extra-rows');
  if(!cont)return;
  const tecs=tecnicosList();
  cont.innerHTML=tecnicosExtra.map((val,i)=>{
    const opts='<option value="">— Ninguno —</option>'+probOpts(tecs,val);
    return `
    <div class="prob-row" style="grid-template-columns:1fr auto">
      <div class="field"><label>Técnico ${5+i}</label><select onchange="setTecnicoExtra(${i},this.value)">${opts}</select></div>
      <button type="button" class="btn-del prob-del" title="Quitar técnico" onclick="removeTecnicoExtra(${i})"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>`;
  }).join('')+`<button type="button" class="btn-sec prob-add" onclick="addTecnicoExtra()" title="Agregar técnico"><i class="ti ti-plus" aria-hidden="true"></i> Agregar técnico</button>`;
}
export function setTecnicoExtra(i,val){tecnicosExtra[i]=val;renderFotografosRows();scheduleRegDraftSave();}
export function addTecnicoExtra(){tecnicosExtra.push('');renderTecnicosExtra();renderFotografosRows();scheduleRegDraftSave();}
export function removeTecnicoExtra(i){tecnicosExtra.splice(i,1);renderTecnicosExtra();renderFotografosRows();scheduleRegDraftSave();}
export function resetTecnicosExtra(){__set_tecnicosExtra([]);renderTecnicosExtra();}
export function tecnicosExtraValidos(){return tecnicosExtra.filter(t=>t&&t.trim());}

/* ---------- Material donde se instala (filas dinámicas): a veces una
   misma instalación usa más de un material (ej: concreto y madera), por
   eso se permite agregar más de una fila. Mismo patrón que Producto/Extras. */
export let materialRows=[''];
export function __set_materialRows(v){ materialRows = v; }
export function renderMaterialRows(){
  const cont=g('material-rows');
  if(!cont)return;
  const multi=materialRows.length>1;
  cont.innerHTML=materialRows.map((val,i)=>{
    const num=multi?` ${i+1}`:'';
    const opts='<option value="">Seleccionar...</option>'+probOpts(lists.materiales,val);
    return `
    <div class="prob-row" style="grid-template-columns:1fr auto">
      <div class="field"><label>Material${num}</label><select onchange="setMaterialRow(${i},this.value)">${opts}</select></div>
      <button type="button" class="btn-del prob-del" title="Quitar material" onclick="removeMaterialRow(${i})" style="${multi?'':'visibility:hidden'}"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>`;
  }).join('')+`<button type="button" class="btn-sec prob-add" onclick="addMaterialRow()" title="Agregar otro material"><i class="ti ti-plus" aria-hidden="true"></i> Agregar otro material</button>`;
}
export function setMaterialRow(i,val){materialRows[i]=val;scheduleRegDraftSave();}
export function addMaterialRow(){materialRows.push('');renderMaterialRows();scheduleRegDraftSave();}
export function removeMaterialRow(i){materialRows.splice(i,1);if(!materialRows.length)materialRows.push('');renderMaterialRows();scheduleRegDraftSave();}
export function resetMaterialRows(){__set_materialRows(['']);renderMaterialRows();}
export function materialesValidos(){return materialRows.filter(m=>m&&m.trim());}

/* ---------- Fotógrafos (quiénes sacaron las fotos de la OT): se eligen
   de entre los técnicos ya ingresados en esta misma visita (tec1..tec4 +
   técnicos extra), marcando cada uno como Sí/No. Se guarda como lista de
   nombres marcados con "Sí". */
export let fotografos=[];
export function __set_fotografos(v){ fotografos = v; }
export function tecnicosDeLaOTActual(){
  return [g('f-tec1')?.value,g('f-tec2')?.value,g('f-tec3')?.value,g('f-tec4')?.value,...tecnicosExtra]
    .filter(t=>t&&t.trim());
}
export function renderFotografosRows(){
  const cont=g('fotografos-rows');
  if(!cont)return;
  const tecs=tecnicosDeLaOTActual();
  if(!tecs.length){
    cont.innerHTML='<p class="eval-empty" style="margin:0">Ingresa primero los técnicos de esta OT para poder elegir quiénes sacaron las fotos.</p>';
    return;
  }
  cont.innerHTML=`<div class="fotografo-chips">`+tecs.map(t=>{
    const sel=fotografos.includes(t);
    return `<span class="fotografo-chip ${sel?'sel':''}" onclick="toggleFotografo('${escapeHtml(t).replace(/'/g,"\\'")}')">${escapeHtml(t)}</span>`;
  }).join('')+`</div>`;
}
export function toggleFotografo(nombre){
  const idx=fotografos.indexOf(nombre);
  if(idx>=0)fotografos.splice(idx,1);else fotografos.push(nombre);
  renderFotografosRows();
  scheduleRegDraftSave();
}
export function resetFotografos(){__set_fotografos([]);renderFotografosRows();}
export function fotografosValidos(){
  const tecsActuales=tecnicosDeLaOTActual();
  return fotografos.filter(f=>tecsActuales.includes(f));
}

/* ---------- Integrantes de la camioneta (Unidad → Registro de kilometraje):
   a diferencia de los fotógrafos (que se eligen entre los técnicos YA
   ingresados en esa visita), acá se elige libremente de entre TODOS los
   técnicos, porque este formulario no tiene un tec1..tec4 propio. */
export let uniIntegrantes=[];
export function __set_uniIntegrantes(v){ uniIntegrantes = v; }
export function renderUniIntegrantesRows(){
  const cont=g('uni-integrantes-rows');
  if(!cont)return;
  const tecs=tecnicosList();
  if(!tecs.length){
    cont.innerHTML='<p class="eval-empty" style="margin:0">No hay técnicos cargados en Listas → Personas.</p>';
    return;
  }
  cont.innerHTML=`<div class="fotografo-chips">`+tecs.map(t=>{
    const sel=uniIntegrantes.includes(t);
    return `<span class="fotografo-chip ${sel?'sel':''}" onclick="toggleUniIntegrante('${escapeHtml(t).replace(/'/g,"\\'")}')">${escapeHtml(t)}</span>`;
  }).join('')+`</div>`;
}
export function toggleUniIntegrante(nombre){
  const idx=uniIntegrantes.indexOf(nombre);
  if(idx>=0)uniIntegrantes.splice(idx,1);else uniIntegrantes.push(nombre);
  renderUniIntegrantesRows();
}
export function resetUniIntegrantes(){__set_uniIntegrantes([]);renderUniIntegrantesRows();}
export function uniIntegrantesValidos(){
  const tecsActuales=tecnicosList();
  return uniIntegrantes.filter(n=>tecsActuales.includes(n));
}
