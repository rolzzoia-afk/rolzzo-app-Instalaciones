import { scanElegirGaleria, scanRenderCameraStage, scanRenderLoadingStage, scanRenderShutterBar, scanState } from './escaner-documentos.js';
import { scanRenderPreviewStage } from './escaner-revision.js';
import { g } from './form-helpers.js';

/* ===== Etapa de edición: muestra la foto + 4 puntos arrastrables ===== */
export function scanRenderEditStage(){
  const stage=g('scan-stage');
  stage.classList.add('editing');
  const canvas=scanState.rawCanvas;
  const maxW=stage.clientWidth||360,maxH=stage.clientHeight||500;
  const scale=Math.min(maxW/canvas.width,maxH/canvas.height,1);
  const dispW=canvas.width*scale,dispH=canvas.height*scale;
  stage.innerHTML=`<div id="scan-edit-wrap" style="position:relative;width:${dispW}px;height:${dispH}px">
    <canvas id="scan-edit-canvas" width="${dispW}" height="${dispH}"></canvas>
  </div>`;
  scanState.scale=scale;
  scanDibujarEdicion();
  const wrap=g('scan-edit-wrap');
  scanState.corners.forEach((c,i)=>{
    const dot=document.createElement('div');
    dot.className='scan-corner';
    dot.style.left=(c.x*scale)+'px';
    dot.style.top=(c.y*scale)+'px';
    dot.dataset.idx=i;
    scanHacerArrastrable(dot,wrap);
    wrap.appendChild(dot);
  });
  g('scan-bottombar').innerHTML=`<button class="scan-btn-sec" onclick="scanReintentarFoto()"><i class="ti ti-chevron-right" aria-hidden="true" style="transform:scaleX(-1)"></i> Repetir foto</button>
    <button class="scan-btn-primary" onclick="scanConfirmarRecorte()"><i class="ti ti-check" aria-hidden="true"></i> Usar recorte</button>`;
}
export function scanDibujarEdicion(){
  const canvas=g('scan-edit-canvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(scanState.rawCanvas,0,0,canvas.width,canvas.height);
  const c=scanState.corners,s=scanState.scale;
  ctx.beginPath();
  ctx.moveTo(c[0].x*s,c[0].y*s);
  for(let i=1;i<4;i++)ctx.lineTo(c[i].x*s,c[i].y*s);
  ctx.closePath();
  ctx.strokeStyle='#eda100';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='rgba(237,161,0,.18)';ctx.fill();
}
export function scanHacerArrastrable(dot,wrap){
  const idx=+dot.dataset.idx;
  const mover=(clientX,clientY)=>{
    const rect=wrap.getBoundingClientRect();
    let x=(clientX-rect.left)/scanState.scale;
    let y=(clientY-rect.top)/scanState.scale;
    x=Math.max(0,Math.min(scanState.rawCanvas.width,x));
    y=Math.max(0,Math.min(scanState.rawCanvas.height,y));
    scanState.corners[idx]={x,y};
    dot.style.left=(x*scanState.scale)+'px';
    dot.style.top=(y*scanState.scale)+'px';
    scanDibujarEdicion();
  };
  dot.addEventListener('pointerdown',e=>{
    e.preventDefault();
    dot.setPointerCapture(e.pointerId);
    const onMove=ev=>mover(ev.clientX,ev.clientY);
    const onUp=()=>{dot.removeEventListener('pointermove',onMove);dot.removeEventListener('pointerup',onUp);};
    dot.addEventListener('pointermove',onMove);
    dot.addEventListener('pointerup',onUp);
  });
}
export function scanReintentarFoto(){
  g('scan-stage').classList.remove('editing');
  scanRenderLoadingStage('Preparando cámara…');
  scanRenderShutterBar();
  if(scanState.stream){scanRenderCameraStage(scanState.stream);}
  else{
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1920},height:{ideal:1080}}})
      .then(stream=>{scanState.stream=stream;scanRenderCameraStage(stream);})
      .catch(()=>scanElegirGaleria());
  }
}
/* Aplica la corrección de perspectiva con las 4 esquinas actuales y pasa
   a la etapa de revisión (elegir color/BN, agregar más páginas, o terminar). */
export function scanConfirmarRecorte(){
  const cv=window.cv;
  const src=cv.imread(scanState.rawCanvas);
  const c=scanState.corners;
  const widthA=Math.hypot(c[1].x-c[0].x,c[1].y-c[0].y);
  const widthB=Math.hypot(c[2].x-c[3].x,c[2].y-c[3].y);
  const heightA=Math.hypot(c[3].x-c[0].x,c[3].y-c[0].y);
  const heightB=Math.hypot(c[2].x-c[1].x,c[2].y-c[1].y);
  const outW=Math.max(widthA,widthB),outH=Math.max(heightA,heightB);
  const srcTri=cv.matFromArray(4,1,cv.CV_32FC2,[c[0].x,c[0].y,c[1].x,c[1].y,c[2].x,c[2].y,c[3].x,c[3].y]);
  const dstTri=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,outW,0,outW,outH,0,outH]);
  const M=cv.getPerspectiveTransform(srcTri,dstTri);
  const dst=new cv.Mat();
  cv.warpPerspective(src,dst,M,new cv.Size(outW,outH));
  const outCanvas=document.createElement('canvas');
  outCanvas.width=outW;outCanvas.height=outH;
  cv.imshow(outCanvas,dst);
  src.delete();dst.delete();M.delete();srcTri.delete();dstTri.delete();
  scanState.corrected=outCanvas;
  g('scan-stage').classList.remove('editing');
  scanRenderPreviewStage();
}
