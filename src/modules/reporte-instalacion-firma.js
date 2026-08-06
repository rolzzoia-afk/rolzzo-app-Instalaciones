import { g } from './form-helpers.js';

/* ===== Firma táctil (Canvas HTML5, sin librerías externas) ===== */
export const finstSigCtx={}; /* canvasId -> {ctx, drawing, lastX, lastY} */
export function finstInitFirmas(){
  ['finst-firma-cliente'].forEach(id=>{
    const canvas=g(id);
    if(!canvas||canvas.dataset.sigInit)return;
    canvas.dataset.sigInit='1';
    finstResizeCanvas(canvas);
    const ctx=canvas.getContext('2d');
    ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#0b0b0b';
    finstSigCtx[id]={ctx,drawing:false,lastX:0,lastY:0};
    const getPos=(e)=>{
      const rect=canvas.getBoundingClientRect();
      const p=e.touches?e.touches[0]:e;
      return{x:(p.clientX-rect.left)*(canvas.width/rect.width),y:(p.clientY-rect.top)*(canvas.height/rect.height)};
    };
    const start=(e)=>{e.preventDefault();const s=finstSigCtx[id];s.drawing=true;const pos=getPos(e);s.lastX=pos.x;s.lastY=pos.y;};
    const move=(e)=>{
      const s=finstSigCtx[id];if(!s.drawing)return;e.preventDefault();
      const pos=getPos(e);
      s.ctx.beginPath();s.ctx.moveTo(s.lastX,s.lastY);s.ctx.lineTo(pos.x,pos.y);s.ctx.stroke();
      s.lastX=pos.x;s.lastY=pos.y;
    };
    const end=()=>{finstSigCtx[id].drawing=false;};
    canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',move);
    window.addEventListener('mouseup',end);
    canvas.addEventListener('touchstart',start,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});
    canvas.addEventListener('touchend',end);
  });
}
export function finstResizeCanvas(canvas){
  const rect=canvas.getBoundingClientRect();
  const ratio=window.devicePixelRatio||1;
  canvas.width=rect.width*ratio;
  canvas.height=parseInt(canvas.getAttribute('height')||160)*ratio;
}
export function finstLimpiarFirma(id){
  const canvas=g(id);if(!canvas)return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
}
export function finstCanvasVacio(canvas){
  const ctx=canvas.getContext('2d');
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  for(let i=3;i<data.length;i+=4){if(data[i]!==0)return false;}
  return true;
}
export function finstFirmaBase64(id){
  const canvas=g(id);if(!canvas||finstCanvasVacio(canvas))return null;
  return canvas.toDataURL('image/png');
}
