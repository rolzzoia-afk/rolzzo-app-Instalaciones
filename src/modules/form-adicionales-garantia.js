import { lists } from './core-data.js';
import { g } from './form-helpers.js';
import { probOpts, scheduleRegDraftSave } from './registro-adjuntos.js';

/* ===== Adicionales y garantía (filas dinámicas: Adicional + Cantidad + Tipo de garantía ===== */
export let extraRows=[{adicional:'',cantidad:'',tipoGar:''}];
export function __set_extraRows(v){ extraRows = v; }
export function renderExtraRows(){
  const cont=g('extra-rows');
  if(!cont)return;
  const multi=extraRows.length>1;
  cont.innerHTML=extraRows.map((row,i)=>{
    const num=multi?` ${i+1}`:'';
    const optsAd='<option value="">Ninguno</option>'+probOpts(lists.adicionales,row.adicional);
    const optsGar='<option value="">Sin garantía</option>'+probOpts(lists.garantias,row.tipoGar);
    return `
    <div class="prob-row" style="grid-template-columns:1.4fr .8fr 1.4fr auto">
      <div class="field"><label>Adicional${num}</label><select onchange="setExtraRow(${i},'adicional',this.value)">${optsAd}</select></div>
      <div class="field"><label>Cantidad${num}</label><input type="number" min="0" placeholder="0" value="${row.cantidad||''}" oninput="setExtraRow(${i},'cantidad',this.value)"></div>
      <div class="field"><label>Tipo de garantía${num}</label><select onchange="setExtraRow(${i},'tipoGar',this.value)">${optsGar}</select></div>
      <button type="button" class="btn-del prob-del" title="Quitar" onclick="removeExtraRow(${i})" style="${multi?'':'visibility:hidden'}"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>`;
  }).join('')+`<button type="button" class="btn-sec prob-add" onclick="addExtraRow()" title="Agregar adicional y garantía"><i class="ti ti-plus" aria-hidden="true"></i> Agregar adicional y garantía</button>`;
}
export function setExtraRow(i,key,val){if(extraRows[i])extraRows[i][key]=val;scheduleRegDraftSave();}
export function addExtraRow(){extraRows.push({adicional:'',cantidad:'',tipoGar:''});renderExtraRows();scheduleRegDraftSave();}
export function removeExtraRow(i){extraRows.splice(i,1);if(!extraRows.length)extraRows.push({adicional:'',cantidad:'',tipoGar:''});renderExtraRows();scheduleRegDraftSave();}
export function resetExtraRows(){__set_extraRows([{adicional:'',cantidad:'',tipoGar:''}]);renderExtraRows();}
export function extrasValidos(){return extraRows.filter(e=>(e.adicional&&e.adicional.trim())||(e.cantidad&&String(e.cantidad).trim())||(e.tipoGar&&e.tipoGar.trim()));}
