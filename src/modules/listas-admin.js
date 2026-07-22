import { saveAll } from './bootstrap.js';
import { CAT_META, CORE_KEYS, customLists, lists } from './core-data.js';
import { g, populateForms } from './form-helpers.js';

/* ===== LISTAS / ADMIN ===== */
export function allCategories(){
  return CORE_KEYS.map(k=>({key:k,label:CAT_META[k].label,icon:CAT_META[k].icon,core:true}))
    .concat(Object.keys(customLists).map(k=>({key:k,label:customLists[k].label,icon:customLists[k].icon,core:false})));
}
export function catItems(key){
  return CORE_KEYS.includes(key)?lists[key]:customLists[key].items;
}
export function renderAdmin(){
  const el=g('admin-grid');
  el.innerHTML=allCategories().map(cat=>`
<div class="list-mgr" style="--sec-color:#6B4AA7">
  <p class="list-mgr-title"><span><i class="ti ${cat.icon}" aria-hidden="true"></i> ${cat.label}</span>${cat.core?'':`<button class="btn-del" onclick="removeCategory('${cat.key}')" title="Eliminar categoría"><i class="ti ti-trash" aria-hidden="true"></i></button>`}</p>
  <div class="list-items">
    ${catItems(cat.key).map(v=>`<div class="list-item"><span>${v}</span>
      <button class="btn-del" onclick="removeItem('${cat.key}','${v.replace(/'/g,"\\'")}')" title="Quitar"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>`).join('')||'<span style="font-size:11px;color:var(--text-muted)">Sin opciones aún</span>'}
  </div>
  <div class="list-add">
    <input type="text" id="new-${cat.key}" placeholder="Nueva opción..." onkeydown="if(event.key==='Enter')addItem('${cat.key}')">
    <button class="btn btn-sm" onclick="addItem('${cat.key}')"><i class="ti ti-plus" aria-hidden="true"></i>Agregar</button>
  </div>
</div>`).join('');
}
export function addItem(key){
  const inp=g('new-'+key);
  const val=inp.value.trim();
  if(!val)return;
  const arr=catItems(key);
  if(arr.includes(val))return;
  arr.push(val);
  inp.value='';
  saveAll();renderAdmin();populateForms();
}
export function removeItem(key,val){
  const arr=catItems(key);
  const idx=arr.indexOf(val);
  if(idx>-1)arr.splice(idx,1);
  saveAll();renderAdmin();populateForms();
}
export function addCategory(){
  const label=prompt('Nombre de la nueva categoría (ej: Tipos de anclaje):');
  if(!label||!label.trim())return;
  let key='cat_'+label.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  if(!key||key==='cat_')key='cat_'+Date.now();
  if(customLists[key]||CORE_KEYS.includes(key))key=key+'_'+Date.now();
  customLists[key]={label:label.trim(),icon:'ti-tag',items:[]};
  saveAll();renderAdmin();
}
export function removeCategory(key){
  if(!confirm('¿Eliminar esta categoría y todas sus opciones?'))return;
  delete customLists[key];
  saveAll();renderAdmin();
}
