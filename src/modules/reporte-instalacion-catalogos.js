import { escapeHtml } from './evaluaciones.js';
import { g } from './form-helpers.js';
import { guardar } from './registro-adjuntos.js';

/* ===== Catálogos fijos (igual que el papel) ===== */
export const FINST_PRODUCTOS=['Blackout','Screen','Dúo Poliéster','Dúo Blackout','Dual','BeeBlack','Soft Light','Dark Roller',
  'Cortina Vertical','Vertical Mot.','Cenefa Ovalada','Cenefa Cuadrada','Motor Inalámbrico','Motor Domótica','Alexa / Google','Sistema Adicional'];
export const FINST_CHECKLIST=[
  '¿Las Cortinas Roller, Verticales o BeeBlack funcionan correctamente?',
  '¿Recibió el producto en buenas condiciones?',
  '¿El color de las Roller, Verticales o BeeBlack es el correcto?',
  '¿El color de los accesorios (mecanismos, pesa inferior, cadena) es el correcto?',
  '¿Se explicó el paso de luz de las Cortinas Roller, Verticales o BeeBlack?',
  '¿La posición de las cadenas está correcta?',
  '¿La posición y sentido de las telas de las cortinas es correcto?',
  '¿Está satisfecho con el producto final? (tipo, alto, ancho, adicionales)',
  '¿Se explica uso correcto de las Cortinas Roller, Verticales o BeeBlack?',
  '¿El instalador explicó posibles desniveles en techos/muros y uso de suplementos?',
  'De llevar motores, ¿se explica que subirán desfasados?',
  '¿El instalador solicitó resguardar mascotas antes de empezar la instalación?',
  '¿El instalador solicitó guardar bienes personales en la zona de trabajo?',
  '¿El instalador informó daños ya existentes antes de empezar a instalar?',
  '¿Se causó algún daño en la instalación por parte de los instaladores?',
  '¿Se explican pasos de luz que pueden generar los "Sistemas Adicionales"?'
];
export const FINST_ENCUESTA=[
  '¿Se cumplió con la fecha de instalación? (fecha programada y rango horario)',
  '¿Le gustó la atención del vendedor(a)?',
  '¿Le gustó la atención general de Cortinas Rolzzo? (ventas e instalación)',
  '¿Recomendarías a Cortinas Rolzzo?'
];
/* Estado en memoria del formulario actual: productos marcados, respuestas
   del checklist (1..16) y de la encuesta (1..4), y las firmas en Base64. */
export let finstProductos=[];
export function __set_finstProductos(v){ finstProductos = v; }
export let finstChecklist={};
export function __set_finstChecklist(v){ finstChecklist = v; }
export let finstEncuesta={};
export function __set_finstEncuesta(v){ finstEncuesta = v; }
export let finstFirmaClienteData=null;
export let finstFirmaInstaladorData=null;

export function finstToggleProducto(p){
  const i=finstProductos.indexOf(p);
  if(i>=0)finstProductos.splice(i,1);else finstProductos.push(p);
  finstRenderProductos();
}
export function finstRenderProductos(){
  const cont=g('finst-productos-grid');
  if(!cont)return;
  cont.innerHTML=FINST_PRODUCTOS.map(p=>{
    const sel=finstProductos.includes(p);
    return `<label class="finst-prod-chip ${sel?'sel':''}" onclick="event.preventDefault();finstToggleProducto('${p.replace(/'/g,"\\'")}')">
      <input type="checkbox" ${sel?'checked':''}>${escapeHtml(p)}
    </label>`;
  }).join('');
}
/* Tabla de checklist / encuesta: cada fila tiene 3 (Sí/No/N-A) o 2 (Sí/No)
   opciones, resaltando en color la que esté seleccionada. */
export function finstRenderCheckTabla(tblId,preguntas,estado,setterName,conNA){
  const tbl=g(tblId);
  if(!tbl)return;
  tbl.innerHTML=preguntas.map((q,i)=>{
    const n=i+1;
    const val=estado[n]||'';
    const opts=conNA?[['SI','SÍ','sel-si'],['NO','NO','sel-no'],['NA','N/A','sel-na']]:[['SI','SÍ','sel-si'],['NO','NO','sel-no']];
    const optsHtml=opts.map(([code,label,cls])=>
      `<span class="finst-opt ${val===code?cls:''}" onclick="${setterName}(${n},'${code}')">${label}</span>`
    ).join('');
    return `<tr><td class="fc-num">${n}</td><td class="fc-q">${escapeHtml(q)}</td><td><div class="finst-check-opts">${optsHtml}</div></td></tr>`;
  }).join('');
}
export function finstSetCheck(n,val){finstChecklist[n]=val;finstRenderChecklist();}
export function finstSetEncuesta(n,val){finstEncuesta[n]=val;finstRenderEncuesta();}
export function finstRenderChecklist(){finstRenderCheckTabla('finst-checklist-tbl',FINST_CHECKLIST,finstChecklist,'finstSetCheck',true);}
export function finstRenderEncuesta(){finstRenderCheckTabla('finst-encuesta-tbl',FINST_ENCUESTA,finstEncuesta,'finstSetEncuesta',false);}
