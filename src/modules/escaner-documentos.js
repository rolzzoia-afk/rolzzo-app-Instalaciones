import { scanRenderEditStage } from './escaner-edicion.js';
import { escapeHtml } from './evaluaciones.js';
import { g } from './form-helpers.js';

/* ===== ESCÁNER DE DOCUMENTOS    Flujo: abrir cámara -> tomar foto -> detectar los 4 bor ===== */
export let scanState=null; /* {onDone, stream, corners, rawCanvas, pages:[{dataUrl,w,h}], modo:'color'|'bn'} */
export let scanCvReady=false;
export let scanCvLoading=null;

/* Carga OpenCV.js solo la primera vez que se necesita (pesa varios MB),
   para no dejar más lenta el resto de la app. */
export function cargarOpenCV(){
  if(scanCvReady)return Promise.resolve();
  if(scanCvLoading)return scanCvLoading;
  scanCvLoading=new Promise((resolve,reject)=>{
    let settled=false;
    const timeoutId=setTimeout(()=>{
      if(!settled){settled=true;reject(new Error('El motor de escaneo demoró demasiado en cargar. Revisa tu conexión e intenta de nuevo.'));}
    },20000);
    /* OpenCV.js llama a Module.onRuntimeInitialized cuando el WebAssembly
       terminó de compilar y "cv" ya tiene todas sus funciones disponibles;
       es el punto oficial y confiable para saber que está listo. */
    window.Module=window.Module||{};
    window.Module.onRuntimeInitialized=()=>{
      if(!settled){settled=true;clearTimeout(timeoutId);scanCvReady=true;resolve();}
    };
    const script=document.createElement('script');
    script.src='https://docs.opencv.org/4.8.0/opencv.js';
    script.async=true;
    script.onerror=()=>{
      if(!settled){settled=true;clearTimeout(timeoutId);reject(new Error('No se pudo cargar el motor de escaneo. Revisa tu conexión a internet e intenta de nuevo.'));}
    };
    document.head.appendChild(script);
  });
  return scanCvLoading;
}

/* Punto de entrada: cualquier botón "Escanear" de la app llama a esto con
   un callback que recibe un File (PDF) cuando el usuario termina. */
export async function abrirEscaner(onDone){
  scanState={onDone,stream:null,corners:null,rawCanvas:null,pages:[],modo:'color'};
  g('scan-overlay').classList.remove('hidden');
  g('scan-title').innerHTML='<i class="ti ti-camera" aria-hidden="true"></i> Escanear documento';
  g('scan-page-thumbs').style.display='none';
  scanRenderLoadingStage('Preparando cámara…');
  scanRenderShutterBar();
  try{
    await cargarOpenCV();
  }catch(e){
    alert(e.message);
    cerrarEscaner();
    return;
  }
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1920},height:{ideal:1080}}});
    scanState.stream=stream;
    scanRenderCameraStage(stream);
  }catch(e){
    alert('No se pudo acceder a la cámara. Puedes revisar los permisos del navegador, o usar "Subir de galería" en vez de escanear.');
    cerrarEscaner();
  }
}
export function cerrarEscaner(){
  if(scanState&&scanState.stream)scanState.stream.getTracks().forEach(t=>t.stop());
  g('scan-overlay').classList.add('hidden');
  scanState=null;
}
export function scanRenderLoadingStage(msg){
  g('scan-stage').innerHTML=`<div class="scan-loading">${escapeHtml(msg)}</div>`;
}
export function scanRenderShutterBar(){
  g('scan-bottombar').innerHTML=`<button class="scan-btn-sec" onclick="scanElegirGaleria()"><i class="ti ti-photo" aria-hidden="true"></i> Galería</button>
    <button class="scan-shutter" onclick="scanTomarFoto()" title="Tomar foto"></button>
    <span style="width:90px"></span>`;
}
export function scanRenderCameraStage(stream){
  const stage=g('scan-stage');
  stage.innerHTML=`<video id="scan-video" autoplay playsinline muted></video>`;
  const video=g('scan-video');
  video.srcObject=stream;
}
/* Permite escanear una foto ya existente (galería) en vez de usar la cámara
   en vivo — útil si la cámara falla o si el técnico ya tiene la foto tomada. */
export function scanElegirGaleria(){
  const input=document.createElement('input');
  input.type='file';input.accept='image/*';
  input.onchange=()=>{
    const file=input.files[0];
    if(!file)return;
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
      canvas.getContext('2d').drawImage(img,0,0);
      scanState.rawCanvas=canvas;
      if(scanState.stream){scanState.stream.getTracks().forEach(t=>t.stop());scanState.stream=null;}
      scanIniciarDeteccion();
    };
    img.src=URL.createObjectURL(file);
  };
  input.click();
}
export function scanTomarFoto(){
  const video=g('scan-video');
  if(!video)return;
  const canvas=document.createElement('canvas');
  canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  canvas.getContext('2d').drawImage(video,0,0);
  scanState.rawCanvas=canvas;
  if(scanState.stream){scanState.stream.getTracks().forEach(t=>t.stop());scanState.stream=null;}
  scanIniciarDeteccion();
}
/* Usa OpenCV para encontrar el contorno de 4 lados más grande de la imagen
   (asumiendo que es la hoja) y deja las esquinas listas para ajuste manual. */
export function scanIniciarDeteccion(){
  scanRenderLoadingStage('Detectando los bordes de la hoja…');
  setTimeout(()=>{
    const corners=scanDetectarBordes(scanState.rawCanvas)||scanEsquinasPorDefecto(scanState.rawCanvas);
    scanState.corners=corners;
    scanRenderEditStage();
  },30);
}
export function scanEsquinasPorDefecto(canvas){
  const w=canvas.width,h=canvas.height;
  const mx=w*0.08,my=h*0.08;
  return[{x:mx,y:my},{x:w-mx,y:my},{x:w-mx,y:h-my},{x:mx,y:h-my}];
}
export function scanDetectarBordes(canvas){
  if(!window.cv)return null;
  try{
    const cv=window.cv;
    const src=cv.imread(canvas);
    const gray=new cv.Mat();cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
    const blurred=new cv.Mat();cv.GaussianBlur(gray,blurred,new cv.Size(5,5),0);
    const edges=new cv.Mat();cv.Canny(blurred,edges,50,150);
    const dilated=new cv.Mat();const kernel=cv.Mat.ones(5,5,cv.CV_8U);cv.dilate(edges,dilated,kernel);
    const contours=new cv.MatVector();const hierarchy=new cv.Mat();
    cv.findContours(dilated,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    let best=null,bestArea=0;
    for(let i=0;i<contours.size();i++){
      const cnt=contours.get(i);
      const area=cv.contourArea(cnt);
      if(area<(src.cols*src.rows*0.15)){cnt.delete();continue;}
      const peri=cv.arcLength(cnt,true);
      const approx=new cv.Mat();
      cv.approxPolyDP(cnt,approx,0.02*peri,true);
      if(approx.rows===4&&area>bestArea){
        bestArea=area;
        if(best)best.delete();
        best=approx;
      }else approx.delete();
      cnt.delete();
    }
    let corners=null;
    if(best){
      const pts=[];
      for(let i=0;i<4;i++)pts.push({x:best.data32S[i*2],y:best.data32S[i*2+1]});
      corners=scanOrdenarEsquinas(pts);
      best.delete();
    }
    src.delete();gray.delete();blurred.delete();edges.delete();dilated.delete();kernel.delete();contours.delete();hierarchy.delete();
    return corners;
  }catch(e){console.error('Detección de bordes falló:',e);return null;}
}
/* Ordena 4 puntos cualquiera en: [arriba-izq, arriba-der, abajo-der, abajo-izq] */
export function scanOrdenarEsquinas(pts){
  const sum=pts.map(p=>p.x+p.y);
  const diff=pts.map(p=>p.x-p.y);
  const tl=pts[sum.indexOf(Math.min(...sum))];
  const br=pts[sum.indexOf(Math.max(...sum))];
  const tr=pts[diff.indexOf(Math.max(...diff))];
  const bl=pts[diff.indexOf(Math.min(...diff))];
  return[tl,tr,br,bl];
}
