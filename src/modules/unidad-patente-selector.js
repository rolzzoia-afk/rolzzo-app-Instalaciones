import { lists } from './core-data.js';
import { renderUniTable } from './dashboard-kpis.js';
import { g } from './form-helpers.js';
import { addPatenteChipBtn } from './reportes-unidad.js';

/* ===== REGISTRO DE UNIDAD: selector de patente arriba (pastillas) ===== */
export let uniregSelected=null;
export function __set_uniregSelected(v){ uniregSelected = v; }
export function renderUniregChips(){
  const chipsEl=g('unireg-chips');
  if(!chipsEl)return;
  if(!lists.vehiculos.length){
    chipsEl.innerHTML=addPatenteChipBtn('reg');
    return;
  }
  if(!uniregSelected||!lists.vehiculos.includes(uniregSelected))__set_uniregSelected(lists.vehiculos[0]);
  chipsEl.innerHTML=lists.vehiculos.map(p=>`<span class="patente-chip ${uniregSelected===p?'sel':''}" onclick="selectPatenteUnireg('${p.replace(/'/g,"\\'")}')">${p}</span>`).join('')+addPatenteChipBtn('reg');
}
export function selectPatenteUnireg(p){__set_uniregSelected(p);renderUniregChips();renderUniTable();}
