import { escapeHtml } from './evaluaciones.js';
import { finstInitFirmas, finstLimpiarFirma } from './reporte-instalacion-firma.js';
import { g } from './form-helpers.js';

/* ===== Garantías: "Informe de Garantía/Instalación" (calca el PDF en papel) =====
   Catálogo fijo de casilleros "Tipo de garantía o instalación", en el MISMO
   orden que aparecen en la plantilla PDF (public/plantillas/informe-garantia.pdf)
   — ese orden es el que usa garantia-overlay.js para ubicar cada marca. */
export const GAR_PRODUCTOS=[
  'Tela Blackout','Tela Screen','Tela Dúo Poli','Tela Dúo BK','Mecanismo','Cadena','Pin cenefa',
  'Motor Inalamb.','Motor Domót.','Alexa/Google','BeeBlack','Soft Light','Instalación','Otro',
  'Dark Roller','Cenefa Ov.','Cenefa Cuad.','Vertical','Vertical Mot.','Peso inferior'
];
export const GAR_RESUMEN=[
  'De ser tela, ¿hubo cambio de tela?',
  'De ser mecanismo ¿hubo cambio de mecanismo?',
  'De ser instalación, ¿se realizó reinstalación?',
  'De ser cadena, ¿se cambió o arregló?'
];

export let garProductos=[];
export function __set_garProductos(v){ garProductos=v; }
export let garRespuestas={};
export function __set_garRespuestas(v){ garRespuestas=v; }
export let garDetalles={};
export function __set_garDetalles(v){ garDetalles=v; }

export function garToggleProducto(p){
  const i=garProductos.indexOf(p);
  if(i>=0)garProductos.splice(i,1);else garProductos.push(p);
  garRenderProductos();
}
export function garRenderProductos(){
  const cont=g('gar-productos-grid');
  if(!cont)return;
  cont.innerHTML=GAR_PRODUCTOS.map(p=>{
    const sel=garProductos.includes(p);
    return `<label class="finst-prod-chip ${sel?'sel':''}" onclick="event.preventDefault();garToggleProducto('${p.replace(/'/g,"\\'")}')">
      <input type="checkbox" ${sel?'checked':''}>${escapeHtml(p)}
    </label>`;
  }).join('');
}
export function garSetRespuesta(n,val){garRespuestas[n]=val;garRenderResumen();}
export function garSetDetalle(n,val){garDetalles[n]=val;}
export function garRenderResumen(){
  const tbl=g('gar-resumen-tbl');
  if(!tbl)return;
  tbl.innerHTML=GAR_RESUMEN.map((q,i)=>{
    const n=i+1,val=garRespuestas[n]||'';
    const opts=[['SI','SÍ','sel-si'],['NO','NO','sel-no']].map(([code,label,cls])=>
      `<span class="finst-opt ${val===code?cls:''}" onclick="garSetRespuesta(${n},'${code}')">${label}</span>`
    ).join('');
    return `<tr>
      <td class="fc-num">${n}</td>
      <td class="fc-q">${escapeHtml(q)}</td>
      <td><div class="finst-check-opts">${opts}</div></td>
      <td><input type="text" placeholder="Detalle" value="${escapeHtml(garDetalles[n]||'')}" oninput="garSetDetalle(${n},this.value)"></td>
    </tr>`;
  }).join('');
}
/* Deja el formulario completo en blanco (al entrar por primera vez a la
   pestaña y al presionar "En blanco"). */
export function garBlankForm(){
  ['gar-cliente','gar-telefono','gar-comuna','gar-quien-recibe','gar-mail','gar-fecha','gar-ot',
   'gar-especifique','gar-comentario'].forEach(id=>{const el=g(id);if(el)el.value='';});
  __set_garProductos([]);__set_garRespuestas({});__set_garDetalles({});
  garRenderProductos();garRenderResumen();
  finstLimpiarFirma('gar-firma-cliente');
  const post=g('gar-post-pdf');if(post)post.style.display='none';
}
/* Se llama al entrar a la pestaña "Garantías" (ver sw()): inicializa la
   grilla/canvas la primera vez, sin pisar lo que ya se haya escrito si el
   usuario solo estaba navegando entre pestañas. */
export function garInitPane(){
  if(!g('gar-productos-grid').innerHTML)garRenderProductos();
  if(!g('gar-resumen-tbl').innerHTML)garRenderResumen();
  finstInitFirmas();
  if(!g('gar-fecha').value)g('gar-fecha').value=new Date().toISOString().slice(0,10);
}
