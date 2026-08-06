import { registros, rgVals } from './core-data.js';
import { escapeHtml } from './evaluaciones.js';
import { g } from './form-helpers.js';
import { sw } from './nav.js';
import { FINST_PRODUCTOS, __set_finstChecklist, __set_finstEncuesta, __set_finstProductos, finstRenderChecklist, finstRenderEncuesta, finstRenderProductos } from './reporte-instalacion-catalogos.js';
import { finstInitFirmas, finstLimpiarFirma } from './reporte-instalacion-firma.js';

/* Registro (OT) que quedó vinculado tras una búsqueda exitosa — se usa para
   sacar la dirección de instalación (calle/número/comuna/región) al
   generar el certificado, sin tener que pedirla de nuevo en este
   formulario. null si no se ha buscado nada o no se encontró la OT. */
let finstRegistroActual=null;
export function finstRegistroEncontrado(){ return finstRegistroActual; }

/* En el certificado el instalador debe verse solo por su nombre de pila
   (sin apellidos), aunque en el registro esté guardado como nombre completo. */
function soloPrimerNombre(nombreCompleto){
  return (nombreCompleto||'').trim().split(/\s+/)[0]||'';
}

/* ===== Selector de OT: recicla los datos que ya existen en el registro ===== */
export function finstBuscarOT(){
  const val=(g('finst-ot-input').value||'').trim();
  if(!val){alert('Ingresa un número de OT para buscar.');return;}
  const reg=registros.find(r=>(r.ot||'').toLowerCase()===val.toLowerCase());
  finstRegistroActual=reg||null;
  const found=g('finst-ot-found');
  if(!reg){
    found.style.display='flex';
    found.className='finst-ot-found';
    found.style.background='#fdecec';found.style.borderColor='#e34948';
    found.innerHTML=`<i class="ti ti-alert-triangle" aria-hidden="true" style="color:#e34948"></i><span>No se encontró la OT "${escapeHtml(val)}" en los registros. Puedes llenar el formulario en blanco de todas formas.</span>`;
    g('finst-ot').value=val;
    return;
  }
  const tecs=[reg.tec1,reg.tec2,reg.tec3,reg.tec4].filter(Boolean).map(soloPrimerNombre).join(', ');
  g('finst-nombre').value=reg.cliente||'';
  g('finst-ot').value=reg.ot||'';
  g('finst-fecha').value=reg.fecha||'';
  g('finst-fecha-conforme').value=reg.fecha||'';
  g('finst-instalador').value=tecs;
  g('finst-encargado').value=reg.tec1||'';
  g('finst-llegada').value=reg.hinicio||'';
  g('finst-salida').value=reg.hsalida||'';
  if(reg.materiales&&reg.materiales.length)g('finst-material').value=reg.materiales.join(', ');
  else if(reg.material)g('finst-material').value=reg.material;
  /* Marca automáticamente en el punto 2 los productos que coincidan por
     nombre con lo instalado en el registro (tipos de cortina, adicionales),
     sin obligar al instalador a repetir la selección si ya coincide. */
  const nombresInstalados=[reg.tipoCortina,reg.adicional].filter(Boolean).join(', ').toUpperCase();
  __set_finstProductos(FINST_PRODUCTOS.filter(p=>nombresInstalados.includes(p.toUpperCase())));
  finstRenderProductos();
  found.style.display='flex';
  found.className='finst-ot-found';
  found.style.background='#e8f7f0';found.style.borderColor='#1baf7a';
  found.innerHTML=`<i class="ti ti-circle-check" aria-hidden="true"></i><span>Datos recuperados de la OT ${escapeHtml(reg.ot)} (${escapeHtml(reg.cliente||'sin cliente')}). El teléfono, email y el resto del reporte quedan a completar aquí.</span>`;
}
export function finstNuevoDesdeCero(){
  g('finst-ot-input').value='';
  g('finst-ot-found').style.display='none';
  finstRegistroActual=null;
  finstBlankForm();
}
/* Deja el formulario completo en blanco (usado al entrar por primera vez
   a la pestaña y al presionar "En blanco"). */
export function finstBlankForm(){
  ['finst-nombre','finst-ot','finst-telefono','finst-fecha','finst-email','finst-instalador','finst-rut-cliente',
   'finst-material','finst-observacion','finst-mejorarias','finst-comentario-encuesta',
   'finst-llegada','finst-salida','finst-encargado','finst-fecha-conforme'].forEach(id=>{const el=g(id);if(el)el.value='';});
  ['finst-fotos','finst-rrss','finst-rodapie','finst-guardapolvo'].forEach(id=>{const el=g(id);if(el)el.checked=false;});
  rgVals['rg-finst-instalacion']='Si';rgVals['rg-finst-cortar']='No';
  document.querySelectorAll('#rg-finst-instalacion .ro').forEach(x=>x.classList.toggle('sel',x.getAttribute('onclick').includes("'Si'")));
  document.querySelectorAll('#rg-finst-cortar .ro').forEach(x=>x.classList.toggle('sel',x.getAttribute('onclick').includes("'No'")));
  __set_finstProductos([]);__set_finstChecklist({});__set_finstEncuesta({});
  finstRenderProductos();finstRenderChecklist();finstRenderEncuesta();
  finstLimpiarFirma('finst-firma-cliente');
  g('finst-post-pdf').style.display='none';
}
/* Se llama al entrar a la pestaña "Formulario" (ver sw()): inicializa las
   tablas/canvas la primera vez y no pisa lo que ya se haya escrito si el
   instalador solo estaba navegando entre pestañas. */
export function finstInitPane(){
  if(!g('finst-productos-grid').innerHTML)finstRenderProductos();
  if(!g('finst-checklist-tbl').innerHTML)finstRenderChecklist();
  if(!g('finst-encuesta-tbl').innerHTML)finstRenderEncuesta();
  finstInitFirmas();
  if(!g('finst-fecha').value)g('finst-fecha').value=new Date().toISOString().slice(0,10);
  if(!g('finst-fecha-conforme').value)g('finst-fecha-conforme').value=new Date().toISOString().slice(0,10);
}
