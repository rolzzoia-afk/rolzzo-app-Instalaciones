import { lists } from './core-data.js';
import { escapeHtml } from './evaluaciones.js';
import { g } from './form-helpers.js';
import { guardar, probOpts, scheduleRegDraftSave } from './registro-adjuntos.js';

/* ===== Multi-producto (Tipo de cortina + Cantidad + Código de cortina, filas dinámicas) ===== */
export let productoRows=[{tipo:'',cantidad:'',codigo:''}];
export function __set_productoRows(v){ productoRows = v; }
export function renderProductoRows(){
  const cont=g('producto-rows');
  if(!cont)return;
  const multi=productoRows.length>1;
  cont.innerHTML=productoRows.map((row,i)=>{
    const num=multi?` ${i+1}`:'';
    const opts='<option value="">Seleccionar...</option>'+probOpts(lists.tiposCortina,row.tipo);
    return `
    <div class="prob-row" style="grid-template-columns:1fr 1fr 1fr auto">
      <div class="field"><label>Tipo de cortina${num}${i===0?' <span class="req-asterisk">*</span>':''}</label><select onchange="setProductoRow(${i},'tipo',this.value)">${opts}</select></div>
      <div class="field"><label>Cantidad${num}</label><input type="number" min="0" placeholder="0" value="${row.cantidad||''}" oninput="setProductoRow(${i},'cantidad',this.value)"></div>
      <div class="field"><label>Código de cortina${num}</label><input type="text" placeholder="Ej: COD-001" value="${escapeHtml(row.codigo||'')}" oninput="setProductoRow(${i},'codigo',this.value)"></div>
      <button type="button" class="btn-del prob-del" title="Quitar producto" onclick="removeProductoRow(${i})" style="${multi?'':'visibility:hidden'}"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>`;
  }).join('')+`<button type="button" class="btn-sec prob-add" onclick="addProductoRow()" title="Agregar otro producto"><i class="ti ti-plus" aria-hidden="true"></i> Agregar otro producto</button>`;
}
export function setProductoRow(i,key,val){if(productoRows[i])productoRows[i][key]=val;scheduleRegDraftSave();}
export function addProductoRow(){productoRows.push({tipo:'',cantidad:'',codigo:''});renderProductoRows();scheduleRegDraftSave();}
export function removeProductoRow(i){productoRows.splice(i,1);if(!productoRows.length)productoRows.push({tipo:'',cantidad:'',codigo:''});renderProductoRows();scheduleRegDraftSave();}
export function resetProductoRows(){__set_productoRows([{tipo:'',cantidad:'',codigo:''}]);renderProductoRows();}
/* Lista de productos válidos (con tipo elegido) para guardar y para el resumen */
export function productosValidos(){return productoRows.filter(p=>p.tipo&&p.tipo.trim());}
