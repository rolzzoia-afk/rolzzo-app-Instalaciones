import { sb } from './bootstrap.js';
import { NAV_ITEMS, __set_currentTab, __set_navGroupOpen, __set_registros, __set_unidades, currentTab, navGroupOpen, otContext, personas, registros, session } from './core-data.js';
import { renderDash, renderUniTable } from './dashboard-kpis.js';
import { renderEstadoFlota } from './estado-flota.js';
import { actualizarKmSugerido, renderUFotoKmDropzone, renderUTipoOptions } from './registro-adjuntos.js';
import { __set_evaluacionesFotos, __set_evaluacionesNuevo, loadEvalFotosOT } from './evaluaciones.js';
import { __set_efAcordeonOtAbierta, __set_segResenaOtActiva, renderEvalFotos, renderEvalNuevo, renderSegResenas } from './evaluaciones-extra.js';
import { renderSegReportes } from './exportacion-excel.js';
import { renderMantenciones } from './flota-regla-modal.js';
import { renderFotografosRows } from './form-tecnicos-extra.js';
import { renderAdmin } from './listas-admin.js';
import { confirmLogout, logout } from './login.js';
import { renderRegReportes } from './periodo-helpers.js';
import { renderPersonas } from './personas.js';
import { finstInitPane } from './reporte-instalacion-selector-ot.js';
import { renderReportes } from './reportes-unidad.js';
import { renderUniregChips } from './unidad-patente-selector.js';

/* ===== NAV ===== */
export const ALL_PERM_ITEMS=[
  {key:'regnew',label:'Registro · Registro (nueva visita)'},{key:'regrep',label:'Registro · Reportes'},{key:'reg_formulario',label:'Registro · Formulario (reporte de instalación)'},{key:'dash',label:'Dashboard'},
  {key:'unireg',label:'Unidad · Registro'},{key:'unimant',label:'Unidad · Mantenciones'},{key:'uniflota',label:'Unidad · Estado de flota'},{key:'unirep',label:'Unidad · Reportes'},
  {key:'seg_resenas',label:'Seguimiento · Reseñas'},{key:'seg_fotos',label:'Seguimiento · Evaluación de Fotos'},{key:'seg_reportes',label:'Seguimiento · Reportes'},
  {key:'evalnuevo',label:'Evaluaciones · Personal Nuevo'},
  {key:'adm',label:'Listas'},{key:'per',label:'Personas'}
];
export function hasAccess(key){
  if(!session)return false;
  if(session.rol==='admin')return true;
  const p=personas.find(x=>x.codigo===session.codigo);
  const permisos=(p&&p.permisos)||['regnew','regrep','reg_formulario','dash','unireg','unimant','uniflota','unirep','seg_resenas','seg_fotos'];
  return permisos.includes(key);
}
export function firstAccessibleTab(){
  for(const n of NAV_ITEMS){
    if(n.children){const c=n.children.find(c=>hasAccess(c.key));if(c)return c.key;}
    else if(hasAccess(n.key))return n.key;
  }
  return 'regnew';
}
export function findNavItem(key){
  for(const n of NAV_ITEMS){
    if(n.key===key)return n;
    if(n.children){const c=n.children.find(c=>c.key===key);if(c)return c;}
  }
  return null;
}
export function buildNav(){
  const nav=document.getElementById('sb-nav');
  let html='';
  NAV_ITEMS.forEach(n=>{
    if(n.children){
      const visibleChildren=n.children.filter(c=>hasAccess(c.key));
      if(!visibleChildren.length)return;
      const open=!!navGroupOpen[n.key];
      html+=`<div class="sb-item sb-parent ${open?'expanded':''}" data-navkey="${n.key}" style="--item-color:${n.color}" onclick="toggleNavGroup('${n.key}', event)"><span class="sb-icon-badge" style="background:${n.color}"><i class="ti ${n.icon}" aria-hidden="true"></i></span><span class="sb-item-sep"></span><span class="sb-item-label" style="--item-color:${n.color}">${n.label}</span><i class="ti ti-chevron-down sb-chevron" aria-hidden="true"></i></div>`;
      html+=`<div class="sb-children-wrap${open?' open':''}" data-navkey="${n.key}">`;
      visibleChildren.forEach(c=>{
        html+=`<div class="sb-item sb-child" data-tab="${c.key}" style="--item-color:${c.color}" onclick="sw('${c.key}')"><span class="sb-dot" style="background:${c.color};color:${c.color}"></span><i class="ti ${c.icon}" aria-hidden="true"></i><span class="sb-item-label" style="--item-color:${c.color}">${c.label}</span></div>`;
      });
      html+=`</div>`;
    }else if(hasAccess(n.key)){
      html+=`<div class="sb-item" data-tab="${n.key}" style="--item-color:${n.color}" onclick="sw('${n.key}')"><span class="sb-icon-badge" style="background:${n.color}"><i class="ti ${n.icon}" aria-hidden="true"></i></span><span class="sb-item-sep"></span><span class="sb-item-label" style="--item-color:${n.color}">${n.label}</span></div>`;
    }
  });
  html+=`<div class="sb-item sb-logout-item" onclick="confirmLogout()" title="Cerrar sesión"><span class="sb-icon-badge sb-logout-badge"><i class="ti ti-logout" aria-hidden="true"></i></span><span class="sb-item-sep"></span><span class="sb-item-label">Cerrar sesión</span></div>`;
  nav.innerHTML=html;
  const item=nav.querySelector(`.sb-item[data-tab="${currentTab}"]`);
  if(item)item.classList.add('active');
}
export function expandNavGroup(key){
  if(!navGroupOpen[key]){navGroupOpen[key]=true;buildNav();}
}
export function toggleNavGroup(key, ev){
  if(ev)ev.stopPropagation();
  const willOpen=!navGroupOpen[key];
  Object.keys(navGroupOpen).forEach(k=>navGroupOpen[k]=false);
  navGroupOpen[key]=willOpen;
  buildNav();
  if(willOpen)positionNavChildren(key);
}
export function closeAllNavGroups(){
  if(!Object.values(navGroupOpen).some(Boolean))return;
  __set_navGroupOpen({});
  buildNav();
}
export function positionNavChildren(key){
  if(window.innerWidth>820)return;
  const btn=document.querySelector(`.sb-parent[data-navkey="${key}"]`);
  const wrap=document.querySelector(`.sb-children-wrap[data-navkey="${key}"]`);
  if(!btn||!wrap)return;
  const r=btn.getBoundingClientRect();
  const gap=8;
  let left=r.left+r.width/2;
  wrap.style.left='0px';
  wrap.style.bottom=(window.innerHeight-r.top+gap)+'px';
  const half=wrap.offsetWidth/2;
  const margin=8;
  left=Math.min(Math.max(left,half+margin),window.innerWidth-half-margin);
  wrap.style.left=(left-half)+'px';
}
window.addEventListener('resize',()=>{
  const openKey=Object.keys(navGroupOpen).find(k=>navGroupOpen[k]);
  if(openKey)positionNavChildren(openKey);
});
document.addEventListener('click',e=>{
  const openKey=Object.keys(navGroupOpen).find(k=>navGroupOpen[k]);
  if(!openKey)return;
  const btn=document.querySelector(`.sb-parent[data-navkey="${openKey}"]`);
  const wrap=document.querySelector(`.sb-children-wrap[data-navkey="${openKey}"]`);
  if(wrap&&wrap.contains(e.target))return;
  if(btn&&btn.contains(e.target))return;
  closeAllNavGroups();
});
export function sw(t){
  __set_currentTab(t);
  closeAllNavGroups();
  const meta=findNavItem(t);
  document.querySelectorAll('.sb-item').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(x=>x.classList.remove('active'));
  const item=document.querySelector(`.sb-item[data-tab="${t}"]`);
  if(item)item.classList.add('active');
  document.getElementById(`pane-${t}`).classList.add('active');
  if(meta){
    document.getElementById('tb-chip').style.background=meta.color;
    document.getElementById('tb-title').textContent=meta.label;
    document.getElementById('tb-title').style.color=meta.color;
    document.getElementById('tb-sub').textContent=meta.sub||'';
  }
  if(t==='regnew')renderFotografosRows();
  if(t==='reg_formulario')finstInitPane();
  if(t==='dash')renderDash();
  if(t==='unireg'){renderUniregChips();renderUniTable();actualizarKmSugerido();renderUTipoOptions();renderUFotoKmDropzone();}
  if(t==='unimant')renderMantenciones();
  if(t==='uniflota')renderEstadoFlota();
  if(t==='unirep')renderReportes();
  if(t==='regrep')renderRegReportes();
  if(t==='adm')renderAdmin();
  if(t==='per')renderPersonas();
  if(t==='seg_resenas'){if(otContext)__set_segResenaOtActiva(String(otContext.ot));renderSegResenas();}
  if(t==='seg_fotos'){
    if(otContext)__set_efAcordeonOtAbierta(String(otContext.ot));
    renderEvalFotos();
  }
  if(t==='seg_reportes')renderSegReportes();
  if(t==='evalnuevo')renderEvalNuevo();
  if(['dash','regrep','unirep','unireg','uniflota','seg_resenas','seg_fotos','seg_reportes','evalnuevo'].includes(t))refreshDatosCompartidos();
  /* Cada vez que se entra a cualquier sección del menú, esta debe verse
     siempre desde su inicio (nunca a mitad o al fondo de donde haya
     quedado el scroll de la sección anterior). El scroll real ocurre
     dentro de .main (ver el media query móvil), así que se resetea ese
     contenedor; también se resetea el scroll del propio panel por si
     tuviera su propio overflow interno. */
  const mainEl=document.querySelector('.main');
  if(mainEl)mainEl.scrollTop=0;
  const paneEl=document.getElementById(`pane-${t}`);
  if(paneEl)paneEl.scrollTop=0;
  window.scrollTo(0,0);
}

/* Recarga desde Supabase las tablas que llenan varios usuarios y refresca
   la vista actual, para ver lo que registraron otros sin recargar la página. */
export let _refreshing=false;
export async function refreshDatosCompartidos(){
  if(!sb||_refreshing)return;
  _refreshing=true;
  try{
    const[reg,uni,ef,en]=await Promise.all([
      sb.from('rolzzo_registros').select('*'),
      sb.from('rolzzo_unidades').select('*'),
      sb.from('rolzzo_eval_fotos').select('*'),
      sb.from('rolzzo_eval_nuevo').select('*')
    ]);
    if(reg.data)__set_registros(reg.data.map(r=>({
      id:r.id,fecha:r.fecha,mes:r.mes,tipo:r.tipo,ot:r.ot,cliente:r.cliente,
      tec1:r.tec1,tec2:r.tec2,tec3:r.tec3,tec4:r.tec4,tecnicosExtra:r.tecnicos_extra||[],
      hinicio:r.hinicio,hsalida:r.hsalida,durMin:r.dur_min,
      traslado:r.traslado,tipoCortina:r.tipo_cortina,cantidad:r.cantidad,productos:r.productos||[],
      adicional:r.adicional,tipoGar:r.tipo_gar,extras:r.extras||[],
      nivelDif:r.nivel_dif||'',
      material:r.material,materiales:r.materiales||[],anclaje:r.anclaje,ubicacion:r.ubicacion,codMotor:r.cod_motor,
      calle:r.calle,numero:r.numero,region:r.region,comuna:r.comuna,
      google:r.google,video:r.video,danos:r.danos,comentarioSeguimiento:r.comentario_seguimiento||'',
      problema:r.problema,solucion:r.solucion,queSol:r.que_sol,comentario:r.comentario,
      adjuntos:r.adjuntos||[],fotografos:r.fotografos||[],
      giftcard:r.giftcard||'No',giftcardCodigo:r.giftcard_codigo||'',giftcardDescuento:r.giftcard_descuento??null,
      creadoPor:r.creado_por
    })));
    if(uni.data)__set_unidades(uni.data.map(u=>({
      id:u.id,fecha:u.fecha,mes:u.mes,conductor:u.conductor,patente:u.patente,
      kmi:u.kmi,kmf:u.kmf,total:u.total,comb:u.comb,recarga:u.recarga,monto:u.monto,pago:u.pago,
      i1:u.i1,i2:u.i2,i3:u.i3,i4:u.i4,
      creadoPor:u.creado_por,fotoPath:u.foto_path,fotoKmiPath:u.foto_kmi_path,fotoKmfPath:u.foto_kmf_path
    })));
    if(ef.data)__set_evaluacionesFotos(ef.data.map(e=>({id:e.id,ot:e.ot,persona:e.persona,fecha:e.fecha,mes:e.mes,nivel:e.nivel})));
    if(en.data)__set_evaluacionesNuevo(en.data.map(d=>({id:d.id,persona:d.persona,fecha:d.fecha,mes:d.mes,semana:d.semana,dia:d.dia,cats:d.cats||{},cortinas:d.cortinas,tiempo:d.tiempo,obs:d.obs})));
    await loadEvalFotosOT();
    if(otContext){const reg2=registros.find(r=>r.ot===otContext.ot);if(reg2)otContext.registro=reg2;}
    if(currentTab==='dash')renderDash();
    if(currentTab==='regrep')renderRegReportes();
    if(currentTab==='unirep')renderReportes();
    if(currentTab==='unireg')renderUniTable();
    if(currentTab==='seg_resenas')renderSegResenas();
    if(currentTab==='seg_fotos')renderEvalFotos();
    if(currentTab==='evalnuevo')renderEvalNuevo();
  }catch(e){console.error('Error refrescando datos compartidos:',e);}
  finally{_refreshing=false;}
}
