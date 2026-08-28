import { MESES, lists, personas, rgVals } from './core-data.js';
import { renderExtraRows } from './form-adicionales-garantia.js';
import { renderProductoRows } from './form-productos.js';
import { renderFotografosRows, renderMaterialRows, renderTecnicosExtra } from './form-tecnicos-extra.js';
import { opcionesMesDashboard } from './periodo-helpers.js';
import { populateRegiones } from './regiones-comunas.js';
import { renderProblemasRows, scheduleRegDraftSave } from './registro-adjuntos.js';
import { convertirInputFileConSelector } from './selector-foto-galeria.js';
import { renderUniregChips } from './unidad-patente-selector.js';

/* ===== FORM HELPERS (from v2) ===== */
export function selRg(grp,el,val){
  document.querySelectorAll(`#${grp} .ro`).forEach(x=>x.classList.remove('sel'));
  el.classList.add('sel');
  rgVals[grp]=val;
  if(grp==='rg-giftcard')actualizarCamposGiftcard();
  if(grp==='rg-google')actualizarWhatsappRegistro();
  if(grp.startsWith('rg-')&&grp!=='rg-comb'&&grp!=='rg-recarga'&&!grp.startsWith('rg-finst-'))scheduleRegDraftSave();
}
/* Muestra el bloque de "Enviar invitación por WhatsApp" cuando se marca que
   se le pedirá al cliente que deje su reseña de Google, con una vista previa
   de a quién y a qué número se le va a enviar (para que quede claro antes
   de mandar el mensaje). */
export function actualizarWhatsappRegistro(){
  const wrap=g('reg-wa-gracias-wrap');
  if(!wrap)return;
  const esSi=rgVals['rg-google']==='Si';
  wrap.style.display=esSi?'':'none';
  if(!esSi)return;
  const preview=g('reg-wa-preview');
  if(!preview)return;
  const cliente=(g('f-cliente').value||'').trim();
  const telefono=(g('f-telefono-cliente').value||'').trim();
  if(!cliente&&!telefono){preview.textContent='Escribe el nombre y teléfono del cliente más arriba.';return;}
  preview.textContent='Se enviará a: '+(cliente||'(sin nombre)')+' · '+(telefono||'(sin teléfono)');
}
/* Muestra/oculta los campos "Código giftcard" y "% Descuento" según si el
   toggle "¿Giftcard?" está en Sí o No. Si se pasa a No, limpia los campos
   para no dejar datos viejos guardados a medias. */
export function actualizarCamposGiftcard(){
  const esSi=rgVals['rg-giftcard']==='Si';
  const wrapCod=g('f-giftcard-codigo-wrap'),wrapDesc=g('f-giftcard-desc-wrap');
  if(wrapCod)wrapCod.style.display=esSi?'':'none';
  if(wrapDesc)wrapDesc.style.display=esSi?'':'none';
  if(!esSi){
    if(g('f-giftcard-codigo'))g('f-giftcard-codigo').value='';
    if(g('f-giftcard-desc'))g('f-giftcard-desc').value='';
  }
}
/* ---------- Anclaje (Pared/Techo): a diferencia de los demás grupos "rg-",
   este permite marcar ambas opciones a la vez (una misma instalación puede
   necesitar anclaje en pared y en techo). Se guarda como texto separado por
   coma en rgVals['rg-anclaje'] (ej: "TECHO,PARED") para no tener que tocar
   el resto del código que ya lee/escribe ese mismo campo. */
export function toggleAnclaje(val){
  const actuales=(rgVals['rg-anclaje']||'').split(',').filter(Boolean);
  const idx=actuales.indexOf(val);
  if(idx>=0)actuales.splice(idx,1);else actuales.push(val);
  if(!actuales.length)actuales.push(val); /* no permitir dejarlo vacío */
  rgVals['rg-anclaje']=actuales.join(',');
  const grp=g('rg-anclaje');
  if(grp){
    grp.querySelectorAll('.ro').forEach(x=>{
      const oc=x.getAttribute('onclick')||'';
      const m=oc.match(/toggleAnclaje\('([^']*)'\)/);
      const btnVal=m?m[1]:null;
      x.classList.toggle('sel',actuales.includes(btnVal));
    });
  }
  scheduleRegDraftSave();
}
export function anclajeLabel(anclaje){
  const vals=(anclaje||'').split(',').filter(Boolean);
  if(!vals.length)return'—';
  return vals.map(v=>v==='TECHO'?'Techo':v==='PARED'?'Pared':v).join(' y ');
}
/* ---------- Nivel/Dificultad: reemplaza los antiguos campos separados
   "Dificultad (1-5)" y "Nivel" (Normal/Media/Alta) por un único selector
   de 5 opciones. Se guarda en rgVals['rg-niveldif'] con estos códigos. */
export const NIVELDIF_LABELS={MUY_BAJO:'Muy bajo',BAJO:'Bajo',MEDIO:'Medio',ALTO:'Alto',MUY_ALTO:'Muy alto'};
export function nivelDifLabel(v){return NIVELDIF_LABELS[v]||v||'—';}
/* Categoría de venta: un único botón grande que alterna A (verde) / B (azul),
   en vez de la lista de opciones .ro que usa selRg(). Se guarda igual en
   rgVals para que el resto del flujo (borrador, guardar, editar OT) lo trate
   como cualquier otro campo rg-. */
export function toggleCategoriaVenta(){
  rgVals['rg-categoria']=rgVals['rg-categoria']==='A'?'B':'A';
  syncCatVentaBtn();
  scheduleRegDraftSave();
}
export function syncCatVentaBtn(){
  const btn=g('btn-cat-venta');
  if(!btn)return;
  const val=rgVals['rg-categoria']||'A';
  btn.textContent=val;
  btn.classList.toggle('cat-b',val==='B');
}
export function initRgValsDefaults(){
  rgVals['rg-categoria']='A';
  rgVals['rg-tipo']='Instalación';
  rgVals['rg-niveldif']='MEDIO';
  rgVals['rg-anclaje']='TECHO';
  rgVals['rg-giftcard']='No';
  rgVals['rg-google']='No';
  rgVals['rg-video']='No';
  rgVals['rg-fotovideo']='No';
  rgVals['rg-danos']='No';
  rgVals['rg-comb']='FULL';
  rgVals['rg-recarga']='NO';
}

export function autoMes(val){
  if(!val)return;
  const d=new Date(val+'T12:00:00');
  document.getElementById('f-mes').value=MESES[d.getMonth()]||'';
}
export function autoMesU(val){
  if(!val)return;
  const d=new Date(val+'T12:00:00');
  document.getElementById('u-mes').value=MESES[d.getMonth()]||'';
}
export function calcDur(){
  const hi=document.getElementById('f-hinicio').value;
  const hs=document.getElementById('f-hsalida').value;
  const el=document.getElementById('dur-display');
  if(!hi||!hs){el.textContent='';return;}
  const [hh,mm]=hi.split(':').map(Number);
  const [sh,sm]=hs.split(':').map(Number);
  let min=(sh*60+sm)-(hh*60+mm);
  if(min<0){el.textContent='La hora de salida es anterior al inicio.';return;}
  const h=Math.floor(min/60),m=min%60;
  el.textContent=`Duración: ${h>0?h+' h ':' '}${m} min (${min} minutos total)`;
}
/* Formatea un RUT chileno a medida que se escribe: el usuario solo tipea
   los dígitos (y opcionalmente la K), y el campo se acomoda solo con puntos
   de miles y el guión antes del dígito verificador (ej: 123456785 → 12.345.678-5). */
export function formatearRutInput(el){
  let v=(el.value||'').replace(/[^0-9kK]/g,'').toUpperCase();
  if(v.length>9)v=v.slice(0,9);
  if(v.length<=1){el.value=v;return;}
  const cuerpo=v.slice(0,-1),dv=v.slice(-1);
  const cuerpoFmt=cuerpo.split('').reverse().join('').match(/.{1,3}/g).join('.').split('').reverse().join('');
  el.value=cuerpoFmt+'-'+dv;
}
export function g(id){return document.getElementById(id);}
/* Dirección → coordenadas GPS, usando el geocodificador público de
   OpenStreetMap (gratis, sin API key). Compartido por el certificado de
   conformidad, el informe de garantía y el creador de rutas. */
export async function consultarNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}
export function fillSel(id,arr,first){
  const el=g(id);
  if(!el)return;
  const cur=el.value;
  el.innerHTML='';
  if(first)el.innerHTML=`<option value="">${first}</option>`;
  arr.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);});
  if(cur)el.value=cur;
}
export function tecnicosList(){return personas.filter(p=>p.rol==='operario').map(p=>p.nombre);}
export function populateForms(){
  const tecs=tecnicosList();
  fillSel('f-tec1',tecs,'Seleccionar...');
  fillSel('f-tec2',tecs,'— Ninguno —');
  fillSel('f-tec3',tecs,'— Ninguno —');
  fillSel('f-tec4',tecs,'— Ninguno —');
  renderExtraRows();
  renderTecnicosExtra();
  renderMaterialRows();
  renderFotografosRows();
  renderProblemasRows();
  renderProductoRows();
  populateRegiones('f-region');
  fillSel('f-traslado',lists.traslados,'');
  fillSel('u-pago',lists.formasPago,'— No aplica —');
  fillSel('u-conductor',tecs,'Seleccionar...');
  renderUniregChips();
  tecs.forEach(t=>{
    ['u-i1','u-i2','u-i3','u-i4'].forEach(id=>{
      const el=g(id);if(!el)return;
      const has=[...el.options].some(o=>o.value===t);
      if(!has){const o=document.createElement('option');o.value=t;o.textContent=t;el.appendChild(o);}
    });
  });
  const filTec=g('fil-tec');
  if(filTec){const cur=filTec.value;filTec.innerHTML='<option value="">Todos</option>';tecs.forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;filTec.appendChild(o);});filTec.value=cur;}
  const filMes=g('fil-mes');
  if(filMes&&filMes.options.length<=1){
    opcionesMesDashboard().forEach(({value,label})=>{const o=document.createElement('option');o.value=value;o.textContent=label;filMes.appendChild(o);});
    /* Arranca mostrando el mes actual (no todo el histórico) — nada se
       pierde, "Todos" sigue disponible para revisar meses anteriores. */
    const hoy=new Date();
    filMes.value=`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  }
  convertirInputFileConSelector('u-foto-km','Elegir foto');
  convertirInputFileConSelector('u-foto','Elegir foto');
}
