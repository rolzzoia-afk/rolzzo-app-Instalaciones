import { saveAll, sb } from './bootstrap.js';
import { COLOR_PRESETS, __set_themeColor, themeColor } from './core-data.js';
import { g } from './form-helpers.js';

/* ===== COLOR DEL SISTEMA (popover en sidebar) ===== */
export function applyTheme(hex){
  document.documentElement.style.setProperty('--brand',hex);
  document.documentElement.style.setProperty('--brand-light',hex+'1A');
}
export function renderColorPopover(){
  const el=g('color-grid-sb');
  if(!el)return;
  el.innerHTML=COLOR_PRESETS.map(c=>`
<div class="swatch-wrap">
  <div class="color-swatch ${c.hex===themeColor?'active':''}" style="background:${c.hex}" onclick="setTheme('${c.hex}')"><i class="ti ti-check" aria-hidden="true"></i></div>
  <div class="color-name">${c.name}</div>
</div>`).join('');
}
export function setTheme(hex){
  __set_themeColor(hex);
  applyTheme(hex);
  saveAll();
  renderColorPopover();
  document.getElementById('color-popover').style.display='none';
}
