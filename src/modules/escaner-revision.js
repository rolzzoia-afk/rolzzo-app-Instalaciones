import { cerrarEscaner, scanState } from './escaner-documentos.js';
import { scanReintentarFoto } from './escaner-edicion.js';
import { g } from './form-helpers.js';

/* ===== Etapa de revisión: elegir color/BN y confirmar la página ===== */
export function scanRenderPreviewStage(){
  scanAplicarModoColor();
  g('scan-bottombar').innerHTML=`
    <div class="scan-mode-toggle">
      <button class="${scanState.modo==='color'?'sel':''}" onclick="scanCambiarModo('color')">Color</button>
      <button class="${scanState.modo==='bn'?'sel':''}" onclick="scanCambiarModo('bn')">Blanco y negro</button>
    </div>
    <button class="scan-btn-sec" onclick="scanReintentarFoto()"><i class="ti ti-chevron-right" aria-hidden="true" style="transform:scaleX(-1)"></i> Repetir</button>
    <button class="scan-btn-sec" onclick="scanAgregarPagina()"><i class="ti ti-plus" aria-hidden="true"></i> Agregar otra página</button>
    <button class="scan-btn-primary" onclick="scanFinalizarPDF()"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> Guardar PDF (${scanState.pages.length+1} pág.)</button>`;
}
export function scanCambiarModo(modo){
  scanState.modo=modo;
  scanAplicarModoColor();
  scanRenderPreviewStage();
}
export function scanAplicarModoColor(){
  const stage=g('scan-stage');
  const src=scanState.corrected;
  let outCanvas=src;
  if(scanState.modo==='bn'){
    const cv=window.cv;
    const mat=cv.imread(src);
    const gray=new cv.Mat();cv.cvtColor(mat,gray,cv.COLOR_RGBA2GRAY);
    const bin=new cv.Mat();
    cv.adaptiveThreshold(gray,bin,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY,25,15);
    outCanvas=document.createElement('canvas');
    outCanvas.width=src.width;outCanvas.height=src.height;
    cv.imshow(outCanvas,bin);
    mat.delete();gray.delete();bin.delete();
  }
  scanState.previewCanvas=outCanvas;
  stage.innerHTML='';
  const img=document.createElement('img');
  img.src=outCanvas.toDataURL('image/jpeg',0.97);
  img.style.maxWidth='100%';img.style.maxHeight='100%';img.style.objectFit='contain';
  stage.appendChild(img);
}
/* Guarda la página actual (con su color elegido) y vuelve a la cámara para
   escanear la siguiente hoja, si el documento tiene más de una. */
export function scanAgregarPagina(){
  scanState.pages.push({dataUrl:scanState.previewCanvas.toDataURL('image/jpeg',0.97),w:scanState.previewCanvas.width,h:scanState.previewCanvas.height});
  scanRenderThumbs();
  scanReintentarFoto();
}
export function scanRenderThumbs(){
  const wrap=g('scan-page-thumbs');
  if(!scanState.pages.length){wrap.style.display='none';return;}
  wrap.style.display='flex';
  wrap.innerHTML=scanState.pages.map((p,i)=>`<div class="scan-page-thumb"><img src="${p.dataUrl}"><button class="rm" onclick="scanQuitarPagina(${i})">×</button></div>`).join('');
}
export function scanQuitarPagina(i){
  scanState.pages.splice(i,1);
  scanRenderThumbs();
}
/* Arma el PDF final (todas las páginas escaneadas) como un objeto File, y
   se lo entrega al callback que abrió el escáner — se comporta exactamente
   igual que un archivo elegido desde la galería. */
export function scanFinalizarPDF(){
  const pages=scanState.pages.concat([{dataUrl:scanState.previewCanvas.toDataURL('image/jpeg',0.97),w:scanState.previewCanvas.width,h:scanState.previewCanvas.height}]);
  const{jsPDF}=window.jspdf;
  /* Antes, la imagen recortada se estiraba siempre hasta "rellenar" la hoja
     A4 completa (ratio = availW/p.w, sin tope). Si el recorte de perspectiva
     daba una imagen con menos píxeles de los necesarios para cubrir una A4
     con nitidez, el resultado quedaba pixelado/borroso. Ahora se calcula el
     tamaño "natural" de la imagen a una densidad razonable (200 DPI) y jamás
     se agranda más allá de eso (ratio tope 1): si la imagen ya alcanza para
     verse nítida a ese tamaño, se centra tal cual; si es más grande, se
     reduce para caber en la hoja (sin pérdida visible). */
  const PT_PER_IN=72,TARGET_DPI=200;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight();
  pages.forEach((p,i)=>{
    if(i>0)doc.addPage();
    const margin=24;
    const availW=pageW-margin*2,availH=pageH-margin*2;
    const naturalW=p.w/TARGET_DPI*PT_PER_IN;
    const naturalH=p.h/TARGET_DPI*PT_PER_IN;
    const ratio=Math.min(availW/naturalW,availH/naturalH,1);
    const w=naturalW*ratio,h=naturalH*ratio;
    doc.addImage(p.dataUrl,'JPEG',(pageW-w)/2,(pageH-h)/2,w,h,undefined,'FAST');
  });
  const blob=doc.output('blob');
  const file=new File([blob],'Documento_escaneado_'+Date.now()+'.pdf',{type:'application/pdf'});
  const onDone=scanState.onDone;
  cerrarEscaner();
  onDone(file);
}
