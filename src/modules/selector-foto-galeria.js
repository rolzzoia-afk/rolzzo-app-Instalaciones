import { GOOGLE_REVIEW_LINK } from './bootstrap.js';
import { personas, registros, session } from './core-data.js';
import { abrirEscaner } from './escaner-documentos.js';
import { CATS_NUEVO, CHECKLIST_INDUCCION, DIAS_SEMANA, PLAN_CAT, avgLabel, diasRestantes, escapeHtml, evalFotosOT, evaluacionesNuevo, formatFecha, generarResumen, nuevoPersonaList, safeId } from './evaluaciones.js';
import { PDF_BAND_H, PDF_LOGO_H, catCellColor, clsToRGB, pdfCheckPageBreak, pdfDrawHeader, pdfDrawTitleBlock, pdfSectionBar } from './evaluaciones-pdf.js';
import { g } from './form-helpers.js';
import { calcRankingTecnicos, filtered } from './registro-adjuntos.js';

/* ===== SELECTOR "Foto / Galería / Escanear"    Reemplaza un <input type="file"> puntual ===== */
export let filesrcCallback=null;
export function abrirSelectorArchivo(anchorEl,onFiles,opts){
  opts=opts||{};
  cerrarSelectorArchivo();
  filesrcCallback=onFiles;
  const rect=anchorEl.getBoundingClientRect();
  const overlay=document.createElement('div');
  overlay.className='filesrc-overlay';
  overlay.onclick=cerrarSelectorArchivo;
  const menu=document.createElement('div');
  menu.className='filesrc-menu';
  menu.id='filesrc-menu';
  menu.style.top=(rect.bottom+window.scrollY+6)+'px';
  menu.style.left=Math.min(rect.left+window.scrollX,window.innerWidth-210)+'px';
  menu.innerHTML=`
    <button onclick="filesrcElegir('camara')"><i class="ti ti-camera" aria-hidden="true"></i> Tomar foto</button>
    <button onclick="filesrcElegir('galeria')"><i class="ti ti-photo" aria-hidden="true"></i> Subir de galería</button>
    <button onclick="filesrcElegir('escanear')"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> Escanear documento</button>`;
  menu.onclick=(e)=>e.stopPropagation();
  document.body.appendChild(overlay);
  document.body.appendChild(menu);
}
export function cerrarSelectorArchivo(){
  const menu=g('filesrc-menu');
  if(menu)menu.remove();
  document.querySelectorAll('.filesrc-overlay').forEach(o=>o.remove());
}
export function filesrcElegir(tipo){
  cerrarSelectorArchivo();
  const cb=filesrcCallback;
  if(tipo==='escanear'){
    abrirEscaner(file=>cb([file]));
    return;
  }
  const input=document.createElement('input');
  input.type='file';
  input.accept='image/*,application/pdf';
  input.multiple=true;
  if(tipo==='camara'){input.accept='image/*';input.capture='environment';}
  /* El input temporal se agrega al DOM (oculto) antes de simular el click.
     Sin esto, en varios navegadores el diálogo nativo de selección puede no
     abrirse, o el evento "change" no dispararse de forma confiable, porque
     el input nunca llegó a estar realmente en el documento — el archivo
     elegido se perdía en silencio y luego aparecía el aviso de "selecciona
     un archivo" aunque la persona sí hubiera elegido uno. */
  input.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(input);
  const limpiar=()=>{input.remove();};
  input.onchange=()=>{
    if(input.files&&input.files.length)cb([...input.files]);
    limpiar();
  };
  /* Si la persona cierra el diálogo sin elegir nada (cancelar), también hay
     que quitar el input temporal para no dejar basura en el DOM. */
  window.addEventListener('focus',function onFocusBack(){
    window.removeEventListener('focus',onFocusBack);
    setTimeout(()=>{if(!input.files||!input.files.length)limpiar();},400);
  });
  input.click();
}
/* Inyecta uno o más archivos ya elegidos (por cámara, galería o escáner) en
   un <input type="file"> real existente, usando DataTransfer, y dispara su
   evento "change" — así el resto del código que ya lee ese input (validaciones,
   subida a Supabase, etc) sigue funcionando exactamente igual sin tocar nada. */
/* Comprime una foto en el navegador antes de subirla: la reduce a un ancho
   máximo razonable y la re-codifica como JPEG con buena calidad. Así una
   foto de 10-25MB de un celular moderno (iPhone en HEIC/alta resolución,
   Android en 48-108MP) queda liviana sin perderse nitidez visible, evitando
   que los límites de tamaño de subida se disparen todo el tiempo. Si el
   archivo no es imagen (ej. PDF) o ya es liviano, lo deja intacto. */
export function comprimirImagenSiHaceFalta(file,maxDim,maxBytesSinComprimir){
  maxDim=maxDim||1800;
  maxBytesSinComprimir=maxBytesSinComprimir||1.5*1024*1024;
  return new Promise((resolve)=>{
    if(!file||!file.type||!file.type.startsWith('image/')||file.size<=maxBytesSinComprimir){resolve(file);return;}
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      let{width,height}=img;
      const scale=Math.min(1,maxDim/Math.max(width,height));
      width=Math.round(width*scale);height=Math.round(height*scale);
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      canvas.getContext('2d').drawImage(img,0,0,width,height);
      canvas.toBlob(blob=>{
        if(!blob){resolve(file);return;}
        const nombre=file.name.replace(/\.(heic|heif|png|webp)$/i,'.jpg');
        resolve(new File([blob],nombre,{type:'image/jpeg'}));
      },'image/jpeg',0.82);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);resolve(file);};
    img.src=url;
  });
}
export function inyectarArchivosEnInput(inputId,files){
  const input=g(inputId);
  if(!input){
    /* Esto no debería pasar en uso normal, pero si ocurre (la fila se cerró
       o se regeneró mientras el diálogo de selección estaba abierto), es
       mejor avisar de inmediato que dejar que el archivo se "pierda" en
       silencio y que la persona vea después un aviso confuso de "selecciona
       un archivo" sin entender por qué. */
    alert('No se pudo adjuntar el archivo elegido porque esta fila cambió mientras elegías el archivo. Vuelve a presionar "Elegir archivo(s)" e inténtalo de nuevo.');
    return;
  }
  const dt=new DataTransfer();
  files.forEach(f=>dt.items.add(f));
  input.files=dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
}
/* Convierte un <input type="file"> simple y visible en un botón "Elegir
   archivo" que abre el selector de Foto/Galería/Escanear. Muestra el nombre
   del archivo elegido (o una miniatura si es imagen) debajo del botón. */
export function convertirInputFileConSelector(inputId,label){
  const input=g(inputId);
  if(!input||input.dataset.filesrcReady)return;
  input.dataset.filesrcReady='1';
  input.style.display='none';
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='btn-sec btn-sm';
  btn.innerHTML=`<i class="ti ti-upload" aria-hidden="true"></i> ${escapeHtml(label||'Elegir archivo')}`;
  const preview=document.createElement('div');
  preview.id=inputId+'-filesrc-preview';
  preview.style.cssText='margin-top:6px;font-size:11.5px;color:var(--text-muted)';
  btn.onclick=()=>abrirSelectorArchivo(btn,(files)=>{
    inyectarArchivosEnInput(inputId,files);
    preview.textContent=files.map(f=>f.name).join(', ');
  });
  input.insertAdjacentElement('afterend',preview);
  input.insertAdjacentElement('afterend',btn);
}
export function limpiarPreviewArchivo(inputId){
  const preview=g(inputId+'-filesrc-preview');
  if(preview)preview.textContent='';
}

/* ---------- Página final de fotos ----------
   Descarga (si hace falta) y convierte a base64 cada foto de una lista de
   URLs, para poder incrustarlas en el PDF con doc.addImage (jsPDF no puede
   usar URLs remotas directamente). Devuelve null si falla una imagen. */
export function pdfUrlToDataURL(url){
  return new Promise((resolve)=>{
    if(!url){resolve(null);return;}
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{
      try{
        const canvas=document.createElement('canvas');
        canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0);
        resolve({dataUrl:canvas.toDataURL('image/jpeg',0.95),w:img.naturalWidth,h:img.naturalHeight});
      }catch(e){resolve(null);}
    };
    img.onerror=()=>resolve(null);
    img.src=url;
  });
}
/* Agrega al final del documento una página nueva POR CADA FOTO (una foto
   grande por página, ocupando casi todo el alto disponible) para que se
   pueda apreciar bien el contenido. Cada grupo (registro/mantención) se
   antecede de una página separadora con su título. */
export async function pdfAddPhotosPage(doc,pageW,pageH,marginX,grupos){
  const gruposConFotos=(grupos||[]).filter(g=>g.fotos&&g.fotos.length);
  if(!gruposConFotos.length)return;
  const headerY=PDF_BAND_H+14+PDF_LOGO_H+30;
  for(const grupo of gruposConFotos){
    doc.addPage();
    pdfDrawHeader(doc,pageW);
    let y=headerY;
    doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(20,20,20);
    doc.text('FOTOGRAFÍAS — '+grupo.titulo,pageW/2,y,{align:'center'});
    doc.setTextColor(0);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(120);
    doc.text(`${grupo.fotos.length} foto${grupo.fotos.length===1?'':'s'}`,pageW/2,y+16,{align:'center'});
    doc.setTextColor(0);

    for(const foto of grupo.fotos){
      const data=await pdfUrlToDataURL(foto.url);
      doc.addPage();
      pdfDrawHeader(doc,pageW);
      let py=headerY;
      /* Nombre de la foto, arriba, a modo de encabezado de la página */
      doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(30,30,30);
      const nameLines=doc.splitTextToSize(foto.nombre||'Fotografía',pageW-marginX*2);
      doc.text(nameLines,pageW/2,py,{align:'center'});
      doc.setTextColor(0);doc.setFont('helvetica','normal');
      py+=nameLines.length*13+10;
      doc.setDrawColor(225,225,225);doc.setLineWidth(0.6);
      doc.line(marginX,py,pageW-marginX,py);
      py+=18;

      const availW=pageW-marginX*2;
      const availH=pageH-py-40;
      if(!data){
        doc.setFontSize(10);doc.setTextColor(150);
        doc.text('No se pudo cargar esta imagen.',pageW/2,py+availH/2,{align:'center'});
        doc.setTextColor(0);
        continue;
      }
      /* Tope de escalado: si la foto tiene menos resolución de la que se
         necesitaría para llenar la página con nitidez, se muestra a su
         tamaño natural (a ~200dpi) en vez de estirarla y verse borrosa. */
      const PT_PER_IN=72,TARGET_DPI=200;
      const naturalW=data.w/TARGET_DPI*PT_PER_IN,naturalH=data.h/TARGET_DPI*PT_PER_IN;
      const ratio=Math.min(availW/naturalW,availH/naturalH,1);
      const w=naturalW*ratio,h=naturalH*ratio;
      try{doc.addImage(data.dataUrl,'JPEG',marginX+(availW-w)/2,py+(availH-h)/2,w,h,undefined,'FAST');}catch(e){}
    }
  }
}
export function generarInvitacionWhatsapp(ot){

  const sid=safeId(String(ot));
  const cliente=(g('inv-cliente-'+sid).value||'').trim();
  const tecnico=(g('inv-tecnico-'+sid).value||'').trim();
  const telInput=g('inv-telefono-'+sid);
  const telefono=telInput?(telInput.value||'').trim():'';
  if(!cliente){alert('Escribe el nombre del cliente.');return;}
  if(!tecnico){alert('Escribe el nombre del técnico.');return;}

  const mensaje=`¡Hola, ${cliente}! Somos el equipo de Rolzzo. ${tecnico} nos confirmó que tu instalación quedó lista. Si quedaste conforme, ¿nos ayudarías con una calificación de 5 estrellas en Google? ${GOOGLE_REVIEW_LINK} ¡Gracias por tu confianza!`;

  const telLimpio=telefono.replace(/[^0-9+]/g,'');
  const url=telLimpio?`https://wa.me/${telLimpio.replace(/^\+/,'')}?text=${encodeURIComponent(mensaje)}`:`https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  window.open(url,'_blank');
}
/* Una vez que el cliente YA dejó su reseña en Google, envía un agradecimiento
   por WhatsApp en vez de seguir invitándolo a dejarla (misma mecánica que
   generarInvitacionWhatsapp, mensaje distinto). */
export function generarAgradecimientoWhatsapp(ot){
  const sid=safeId(String(ot));
  const cliente=(g('inv-cliente-'+sid).value||'').trim();
  const tecnico=(g('inv-tecnico-'+sid).value||'').trim();
  const telInput=g('inv-telefono-'+sid);
  const telefono=telInput?(telInput.value||'').trim():'';
  if(!cliente){alert('Escribe el nombre del cliente.');return;}

  const mensaje=`¡Hola, ${cliente}! Somos el equipo de Rolzzo 😊. Queremos agradecerte de corazón por tomarte un momento para dejarnos tu reseña en Google${tecnico?`, y por la confianza en ${tecnico}`:''}. Nos ayuda muchísimo a seguir mejorando. ¡Fue un placer trabajar contigo! 🙌✨`;

  const telLimpio=telefono.replace(/[^0-9+]/g,'');
  const url=telLimpio?`https://wa.me/${telLimpio.replace(/^\+/,'')}?text=${encodeURIComponent(mensaje)}`:`https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  window.open(url,'_blank');
}
export const CRITERIOS_EVAL_PDF=[
  {titulo:'Calidad técnica',desc:'Correcta instalación, nivelación, fijación firme, uso adecuado de las herramientas.'},
  {titulo:'Productividad',desc:'Tiempo de instalación, cantidad de cortinas instaladas, cumplimiento de plazo, organización del trabajo y espacios.'},
  {titulo:'Atención al cliente',desc:'Trato con el cliente, comunicación clara, presentación personal.'},
  {titulo:'Orden y limpieza',desc:'Limpieza al finalizar, cuidado del espacio de instalación.'},
  {titulo:'Cumplimiento de normativa',desc:'Verificación del área de trabajo, pasos de instalación, uso de equipos EPP.'},
  {titulo:'Puntaje y evaluación final',desc:'Escala de 1 a 5, considerando funciones desempeñadas, nivel de dificultad, nivel de aprendizaje, cantidad de cortinas instaladas y tiempo de ejecución. Resultado final: Aprobado, Destacado o Reforzar.'}
];
export function pdfCriteriosBlock(doc,y,marginX,pageW){
  y=pdfCheckPageBreak(doc,y,90);
  y=pdfSectionBar(doc,y,marginX,pageW,'CRITERIOS DE EVALUACIÓN',[79,70,229]);
  doc.setFont('helvetica','normal');doc.setFontSize(7.6);doc.setTextColor(110);
  const introLines=doc.splitTextToSize('A continuación se detallan los parámetros bajo los cuales se calculó esta evaluación, para que el trabajador comprenda cómo se obtuvo su calificación.',pageW-marginX*2);
  y=pdfCheckPageBreak(doc,y,introLines.length*10+6);
  doc.text(introLines,marginX,y);
  y+=introLines.length*10+8;
  doc.setTextColor(0);
  const colTitulo=128;
  const colDesc=pageW-marginX*2-colTitulo;
  CRITERIOS_EVAL_PDF.forEach(c=>{
    const descLines=doc.splitTextToSize(c.desc,colDesc-8);
    const tituloLines=doc.splitTextToSize(c.titulo,colTitulo-10);
    const rowH=Math.max(20,Math.max(descLines.length,tituloLines.length)*10+8);
    y=pdfCheckPageBreak(doc,y,rowH);
    let x=marginX;
    doc.setDrawColor(224);doc.setLineWidth(0.4);
    doc.rect(x,y,colTitulo,rowH);
    doc.setFont('helvetica','bold');doc.setFontSize(7.6);doc.setTextColor(30,30,30);
    doc.text(tituloLines,x+6,y+11);
    doc.setTextColor(0);doc.setFont('helvetica','normal');
    x+=colTitulo;
    doc.rect(x,y,colDesc,rowH);
    doc.setFontSize(7.3);doc.setTextColor(80);
    doc.text(descLines,x+6,y+11);
    doc.setTextColor(0);
    y+=rowH;
  });
  return y+14;
}
export function buildPersonaPDFBlock(doc,y,persona,dias){
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  const scored={BAJA:1,MEDIA:2,ALTA:3};

  y=pdfCheckPageBreak(doc,y,80);
  y+=8;
  doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(20,20,20);
  doc.text(persona.nombre,marginX,y);
  y+=6;
  doc.setDrawColor(210);doc.setLineWidth(0.8);
  doc.line(marginX,y,pageW-marginX,y);
  y+=13;
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(110);
  const dr=diasRestantes(persona);
  const infoParts=[];
  if(persona.rut)infoParts.push('RUT '+persona.rut);
  infoParts.push(persona.esNuevo&&dr!==null?(dr>0?dr+' días de prueba restantes':'Período de prueba finalizado'):'Evaluación de desempeño');
  doc.text(infoParts.join('   ·   '),marginX,y);
  doc.setTextColor(0);
  const allVals=[];dias.forEach(d=>CATS_NUEVO.forEach(c=>{if(d.cats[c.key])allVals.push(scored[d.cats[c.key]]);}));
  const avgInfo=allVals.length?avgLabel(allVals.reduce((s,v)=>s+v,0)/allVals.length):{label:'Sin datos',cls:'sindata'};
  doc.setFont('helvetica','bold');doc.setFontSize(10);
  doc.setTextColor(...clsToRGB(avgInfo.cls));
  doc.text(`Promedio general: ${avgInfo.label}`,pageW-marginX,y,{align:'right'});
  doc.setTextColor(0);doc.setFont('helvetica','normal');
  y+=22;

  y=pdfCriteriosBlock(doc,y,marginX,pageW);

  const semanas=[...new Set(dias.map(d=>d.semana))].filter(Boolean).sort((a,b)=>a.localeCompare(b));
  if(!semanas.length){
    doc.setFontSize(9);doc.setTextColor(140);
    doc.text('Sin semanas de evaluación registradas.',marginX,y);
    doc.setTextColor(0);y+=20;
  }
  const colDia=56,colCat=40,colCort=40,colTiempo=56,colPunt=46;
  semanas.forEach(sem=>{
    const weekDias=dias.filter(d=>d.semana===sem).sort((a,b)=>DIAS_SEMANA.indexOf(a.dia)-DIAS_SEMANA.indexOf(b.dia));
    y=pdfCheckPageBreak(doc,y,130);
    const monday=new Date(sem+'T12:00:00');const friday=new Date(monday);friday.setDate(monday.getDate()+4);
    y=pdfSectionBar(doc,y,marginX,pageW,`SEMANA ${formatFecha(sem)} – ${formatFecha(friday.toISOString().slice(0,10))}`,[79,70,229]);

    let x=marginX;
    doc.setFillColor(13,27,38);doc.rect(x,y,colDia,16,'F');
    doc.setTextColor(255);doc.setFontSize(6.3);doc.setFont('helvetica','bold');
    doc.text('DÍA',x+colDia/2,y+10,{align:'center'});x+=colDia;
    CATS_NUEVO.forEach(c=>{
      doc.setFillColor(13,27,38);doc.rect(x,y,colCat,16,'F');
      doc.text(c.short.toUpperCase().substring(0,8),x+colCat/2,y+10,{align:'center'});x+=colCat;
    });
    doc.setFillColor(13,27,38);doc.rect(x,y,colCort,16,'F');doc.text('CORT.',x+colCort/2,y+10,{align:'center'});x+=colCort;
    doc.setFillColor(13,27,38);doc.rect(x,y,colTiempo,16,'F');doc.text('TIEMPO',x+colTiempo/2,y+10,{align:'center'});x+=colTiempo;
    doc.setFillColor(13,27,38);doc.rect(x,y,colPunt,16,'F');doc.text('PUNTAJE',x+colPunt/2,y+10,{align:'center'});
    doc.setTextColor(0);doc.setFont('helvetica','normal');
    y+=16;

    const byDia={};weekDias.forEach(d=>byDia[d.dia]=d);
    DIAS_SEMANA.forEach(diaLabel=>{
      y=pdfCheckPageBreak(doc,y,20);
      const d=byDia[diaLabel];
      const rowH=18;
      x=marginX;
      doc.setDrawColor(225);doc.setLineWidth(0.4);
      doc.rect(x,y,colDia,rowH);
      doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(0);
      doc.text(diaLabel.substring(0,3),x+4,y+11);
      x+=colDia;
      if(!d){
        doc.rect(x,y,colCat*6+colCort+colTiempo+colPunt,rowH);
        doc.setFont('helvetica','italic');doc.setFontSize(7);doc.setTextColor(165);
        doc.text('Sin datos',x+8,y+11);
        doc.setTextColor(0);doc.setFont('helvetica','normal');
      }else{
        CATS_NUEVO.forEach(c=>{
          const cell=catCellColor(d.cats[c.key]);
          doc.setFillColor(cell.fill[0],cell.fill[1],cell.fill[2]);
          doc.rect(x,y,colCat,rowH,'F');
          doc.setDrawColor(225);doc.rect(x,y,colCat,rowH);
          doc.setTextColor(cell.text[0],cell.text[1],cell.text[2]);
          doc.setFont('helvetica','bold');doc.setFontSize(8);
          doc.text(cell.letter,x+colCat/2,y+12,{align:'center'});
          doc.setTextColor(0);doc.setFont('helvetica','normal');
          x+=colCat;
        });
        doc.rect(x,y,colCort,rowH);doc.setFontSize(7);
        doc.text(d.cortinas?String(d.cortinas):'–',x+colCort/2,y+11,{align:'center'});x+=colCort;
        doc.rect(x,y,colTiempo,rowH);
        doc.text(d.tiempo||'–',x+colTiempo/2,y+11,{align:'center'});x+=colTiempo;
        const vals=CATS_NUEVO.map(c=>d.cats[c.key]).filter(Boolean);
        const dayAvg=vals.length?avgLabel(vals.reduce((s,v)=>s+scored[v],0)/vals.length):{label:'–',cls:'sindata'};
        const dc=dayAvg.cls==='alto'?[27,175,122]:dayAvg.cls==='medio'?[237,161,0]:dayAvg.cls==='bajo'?[227,73,72]:[235,235,235];
        doc.setFillColor(dc[0],dc[1],dc[2]);doc.rect(x,y,colPunt,rowH,'F');doc.setDrawColor(225);doc.rect(x,y,colPunt,rowH);
        doc.setTextColor(dayAvg.cls==='medio'?0:(dayAvg.cls==='sindata'?150:255));doc.setFont('helvetica','bold');doc.setFontSize(7);
        doc.text(dayAvg.label,x+colPunt/2,y+11,{align:'center'});
        doc.setTextColor(0);doc.setFont('helvetica','normal');
      }
      y+=rowH;
    });
    y+=14;
  });

  const obsRows=dias.filter(d=>d.obs&&d.obs.trim()).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  if(obsRows.length){
    y+=6;
    y=pdfSectionBar(doc,y,marginX,pageW,'COMENTARIOS',[42,120,214]);
    doc.setFont('helvetica','normal');doc.setFontSize(8);
    obsRows.forEach(d=>{
      const lines=doc.splitTextToSize(`${formatFecha(d.fecha)} — ${d.obs}`,pageW-marginX*2);
      y=pdfCheckPageBreak(doc,y,lines.length*11+4);
      doc.text(lines,marginX,y);y+=lines.length*11+4;
    });
    y+=6;
  }

  const resumen=generarResumen(dias);
  y+=4;
  y=pdfSectionBar(doc,y,marginX,pageW,'PUNTOS A MEJORAR',[227,73,72]);
  doc.setFont('helvetica','normal');doc.setFontSize(8);
  if(!resumen.debiles.length){
    const lines=doc.splitTextToSize(resumen.texto,pageW-marginX*2);
    y=pdfCheckPageBreak(doc,y,lines.length*11+4);
    doc.text(lines,marginX,y);y+=lines.length*11+4;
  }else{
    resumen.debiles.forEach(d=>{
      const txt=`•  ${d.label} (${d.BAJA} evaluación${d.BAJA>1?'es':''} baja${d.BAJA>1?'s':''})`;
      const lines=doc.splitTextToSize(txt,pageW-marginX*2);
      y=pdfCheckPageBreak(doc,y,lines.length*11+4);
      doc.text(lines,marginX,y);y+=lines.length*11+4;
    });
    y+=8;
    y=pdfSectionBar(doc,y,marginX,pageW,'PLAN DE ACCIÓN',[27,175,122]);
    doc.setFont('helvetica','normal');doc.setFontSize(8);
    resumen.debiles.forEach(d=>{
      const plan=PLAN_CAT[d.key];
      const txt1=`•  ${d.label} — Ahora: ${plan.inmediato}`;
      const txt2=`    Seguimiento: ${plan.seguimiento}`;
      const lines1=doc.splitTextToSize(txt1,pageW-marginX*2);
      y=pdfCheckPageBreak(doc,y,lines1.length*11+4);
      doc.text(lines1,marginX,y);y+=lines1.length*11+4;
      const lines2=doc.splitTextToSize(txt2,pageW-marginX*2);
      y=pdfCheckPageBreak(doc,y,lines2.length*11+6);
      doc.setTextColor(100);
      doc.text(lines2,marginX,y);y+=lines2.length*11+6;
      doc.setTextColor(0);
    });
  }

  /* Checklist de inducción */
  y+=8;
  y=pdfCheckPageBreak(doc,y,380);
  y=pdfSectionBar(doc,y,marginX,pageW,'CHECKLIST DE INDUCCIÓN',[124,58,237]);
  doc.setFont('helvetica','normal');doc.setFontSize(7.3);doc.setTextColor(110);
  doc.text('El trabajador firma cada inducción para dejar constancia de haber sido instruido en el tema.',marginX,y);
  doc.setTextColor(0);
  y+=14;

  const colEstado=64,colFecha=58,colFirma=100;
  const colTema=pageW-marginX*2-colEstado-colFecha-colFirma;
  let cx=marginX;
  doc.setFillColor(13,27,38);doc.rect(cx,y,colTema,15,'F');
  doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(6.8);
  doc.text('INDUCCIÓN',cx+6,y+10);cx+=colTema;
  doc.setFillColor(13,27,38);doc.rect(cx,y,colEstado,15,'F');
  doc.text('ESTADO',cx+colEstado/2,y+10,{align:'center'});cx+=colEstado;
  doc.setFillColor(13,27,38);doc.rect(cx,y,colFecha,15,'F');
  doc.text('FECHA',cx+colFecha/2,y+10,{align:'center'});cx+=colFecha;
  doc.setFillColor(13,27,38);doc.rect(cx,y,colFirma,15,'F');
  doc.text('FIRMA DEL TRABAJADOR',cx+colFirma/2,y+10,{align:'center'});
  doc.setTextColor(0);doc.setFont('helvetica','normal');
  y+=15;

  const ind=(persona.induccion&&persona.induccion.checklist)?persona.induccion.checklist:(persona.induccion||{});
  CHECKLIST_INDUCCION.forEach(it=>{
    const st=ind[it.key]||{checked:false,comentario:'',fecha:''};
    const lines=doc.splitTextToSize(it.label,colTema-10);
    const rowH=Math.max(22,lines.length*9+8);
    y=pdfCheckPageBreak(doc,y,rowH);
    cx=marginX;
    doc.setDrawColor(220);doc.setLineWidth(0.4);
    doc.rect(cx,y,colTema,rowH);
    doc.setFontSize(7.3);
    doc.text(lines,cx+6,y+11);
    cx+=colTema;
    doc.rect(cx,y,colEstado,rowH);
    doc.setFont('helvetica','bold');
    doc.setTextColor(st.checked?30:150);
    doc.text(st.checked?'Realizado':'Pendiente',cx+colEstado/2,y+rowH/2+3,{align:'center'});
    doc.setTextColor(0);doc.setFont('helvetica','normal');
    cx+=colEstado;
    doc.rect(cx,y,colFecha,rowH);
    doc.setFontSize(7.3);
    doc.text(st.fecha?formatFecha(st.fecha):'—',cx+colFecha/2,y+rowH/2+3,{align:'center'});
    cx+=colFecha;
    doc.rect(cx,y,colFirma,rowH);
    y+=rowH;
  });
  y+=16;

  y=pdfCheckPageBreak(doc,y,270);
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(0);
  doc.text('Declaro haber sido instruido en los temas marcados como "Realizado":',marginX,y,{maxWidth:pageW-marginX*2});
  y+=22;

  doc.setFontSize(8.5);doc.setTextColor(0);
  doc.text('Nombre del trabajador:',marginX,y);
  doc.setFont('helvetica','bold');doc.text(persona.nombre||'',marginX+120,y);
  doc.setFont('helvetica','normal');
  y+=16;
  doc.text('RUT:',marginX,y);
  doc.setFont('helvetica','bold');doc.text(persona.rut||'______________________',marginX+120,y);
  doc.setFont('helvetica','normal');
  y+=16;
  doc.text('Fecha:',marginX,y);
  doc.text('______________________',marginX+120,y);
  y+=100;

  doc.setDrawColor(150);doc.setLineWidth(0.5);
  const sigW=(pageW-marginX*2-30)/2;
  doc.line(marginX,y,marginX+sigW,y);
  doc.line(marginX+sigW+30,y,marginX+sigW+30+sigW,y);
  y+=11;
  doc.setFontSize(7.5);doc.setTextColor(110);
  doc.text('Firma del trabajador',marginX,y);
  doc.text('Firma del supervisor',marginX+sigW+30,y);
  doc.setTextColor(0);
  return y+22;
}
export function exportDashResumenPDF(){
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF.');return;}
  const data=filtered();
  if(!data.length){alert('No hay datos para exportar con los filtros actuales.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'Resumen general',`Generado el ${new Date().toLocaleDateString('es-CL')}`);
  const total=data.length;
  const inst=data.filter(r=>r.tipo==='Instalación').length;
  const gar=data.filter(r=>r.tipo==='Garantía').length;
  const conProb=data.filter(r=>r.problema&&!r.problema.toUpperCase().includes('NINGUNO')).length;
  const conGoogle=data.filter(r=>evalFotosOT[r.ot]&&evalFotosOT[r.ot].googleReview).length;
  const totalCort=data.reduce((s,r)=>s+(r.cantidad||0),0);
  const filas=[
    ['Total de visitas',String(total)],
    ['Instalaciones',`${inst} (${Math.round(inst/total*100)}%)`],
    ['Garantías',`${gar} (${Math.round(gar/total*100)}%)`],
    ['Visitas con problema',`${conProb} (${Math.round(conProb/total*100)}%)`],
    ['Reseñas Google',`${conGoogle} (${Math.round(conGoogle/total*100)}% conversión)`],
    ['Cortinas instaladas',String(totalCort)]
  ];
  y=pdfSectionBar(doc,y,marginX,pageW,'INDICADORES',[42,120,214]);
  doc.setFontSize(9);
  filas.forEach(f=>{y=pdfCheckPageBreak(doc,y,16);doc.text(f[0],marginX,y);doc.text(f[1],pageW-marginX,y,{align:'right'});y+=15;});
  doc.save('Resumen_General.pdf');
}
export function exportDashRankingPDF(){
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF.');return;}
  const data=filtered();
  const ranking=calcRankingTecnicos(data);
  if(!ranking.length){alert('No hay datos suficientes para el ranking.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'Ranking de trabajadores',`Generado el ${new Date().toLocaleDateString('es-CL')}`);
  y=pdfSectionBar(doc,y,marginX,pageW,'RANKING (0 A 5)',[124,58,237]);
  doc.setFontSize(9);
  ranking.forEach(r=>{
    y=pdfCheckPageBreak(doc,y,16);
    doc.text(r.nombre,marginX,y);
    doc.text(`${r.stars.toFixed(1)} / 5  ·  ${r.total} visitas`,pageW-marginX,y,{align:'right'});
    y+=15;
  });
  doc.save('Ranking_Trabajadores.pdf');
}
export function exportDashRegistrosPDF(){
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF.');return;}
  const data=filtered();
  if(!data.length){alert('No hay registros para exportar con los filtros actuales.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'Registros',`Generado el ${new Date().toLocaleDateString('es-CL')}`);
  y=pdfSectionBar(doc,y,marginX,pageW,`REGISTROS (${data.length})`,[237,161,0]);
  doc.setFontSize(7.5);
  data.slice().reverse().forEach(r=>{
    y=pdfCheckPageBreak(doc,y,13);
    const linea=`${r.fecha||'—'}  ·  ${r.tipo||'—'}  ·  OT ${r.ot||'—'}  ·  ${r.tec1||'—'}  ·  ${r.tipoCortina||'—'} (${r.cantidad||0})`;
    doc.text(linea,marginX,y);
    y+=12;
  });
  doc.save('Registros.pdf');
}
export function exportDashTodoPDF(){
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF.');return;}
  const data=filtered();
  if(!data.length){alert('No hay datos para exportar con los filtros actuales.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'Dashboard completo',`Generado el ${new Date().toLocaleDateString('es-CL')}`);

  const total=data.length;
  const inst=data.filter(r=>r.tipo==='Instalación').length;
  const gar=data.filter(r=>r.tipo==='Garantía').length;
  const conProb=data.filter(r=>r.problema&&!r.problema.toUpperCase().includes('NINGUNO')).length;
  const conGoogle=data.filter(r=>evalFotosOT[r.ot]&&evalFotosOT[r.ot].googleReview).length;
  const totalCort=data.reduce((s,r)=>s+(r.cantidad||0),0);

  y=pdfSectionBar(doc,y,marginX,pageW,'RESUMEN GENERAL',[42,120,214]);
  doc.setFontSize(9);
  [['Total de visitas',String(total)],
   ['Instalaciones',`${inst} (${Math.round(inst/total*100)}%)`],
   ['Garantías',`${gar} (${Math.round(gar/total*100)}%)`],
   ['Visitas con problema',`${conProb} (${Math.round(conProb/total*100)}%)`],
   ['Reseñas Google',`${conGoogle} (${Math.round(conGoogle/total*100)}% conversión)`],
   ['Cortinas instaladas',String(totalCort)]
  ].forEach(f=>{y=pdfCheckPageBreak(doc,y,16);doc.text(f[0],marginX,y);doc.text(f[1],pageW-marginX,y,{align:'right'});y+=15;});
  y+=8;

  const ranking=calcRankingTecnicos(data);
  if(ranking.length){
    y=pdfSectionBar(doc,y,marginX,pageW,'RANKING DE TRABAJADORES',[124,58,237]);
    doc.setFontSize(9);
    ranking.forEach(r=>{
      y=pdfCheckPageBreak(doc,y,16);
      doc.text(r.nombre,marginX,y);
      doc.text(`${r.stars.toFixed(1)} / 5  ·  ${r.total} visitas`,pageW-marginX,y,{align:'right'});
      y+=15;
    });
    y+=8;
  }

  if(session){
    const nuevos=nuevoPersonaList();
    if(nuevos.length){
      const scored={BAJA:1,MEDIA:2,ALTA:3};
      y=pdfSectionBar(doc,y,marginX,pageW,'PERSONAL NUEVO',[124,58,237]);
      doc.setFontSize(9);
      nuevos.forEach(p=>{
        const vals=[];
        evaluacionesNuevo.filter(d=>d.persona===p.nombre).forEach(d=>CATS_NUEVO.forEach(c=>{if(d.cats[c.key])vals.push(scored[d.cats[c.key]]);}));
        const info=vals.length?avgLabel(vals.reduce((s,v)=>s+v,0)/vals.length):{label:'Sin datos',cls:'sindata'};
        y=pdfCheckPageBreak(doc,y,16);
        doc.text(p.nombre,marginX,y);
        doc.text(info.label,pageW-marginX,y,{align:'right'});
        y+=15;
      });
      y+=8;
    }
  }

  y=pdfSectionBar(doc,y,marginX,pageW,`REGISTROS (${data.length})`,[237,161,0]);
  doc.setFontSize(7.5);
  data.slice().reverse().forEach(r=>{
    y=pdfCheckPageBreak(doc,y,13);
    const linea=`${r.fecha||'—'}  ·  ${r.tipo||'—'}  ·  OT ${r.ot||'—'}  ·  ${r.tec1||'—'}  ·  ${r.tipoCortina||'—'} (${r.cantidad||0})`;
    doc.text(linea,marginX,y);
    y+=12;
  });
  doc.save('Dashboard_Completo.pdf');
}
export function generatePDF(items,filename){
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF. Revisa tu conexión a internet e intenta de nuevo.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  let y=PDF_BAND_H+14+PDF_LOGO_H+30;
  const pageW=doc.internal.pageSize.getWidth();
  pdfDrawHeader(doc,pageW);

  doc.setFont('helvetica','bold');doc.setFontSize(14);
  doc.text('Rolzzo — Evaluación de Personal Nuevo',marginX,y);
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(120);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')}`,pageW-marginX,y,{align:'right'});
  doc.setTextColor(0);
  doc.setFontSize(7.5);doc.setTextColor(150);
  doc.text('Leyenda: B = Baja · M = Media · A = Alta',marginX,y+13);
  doc.setTextColor(0);
  y+=32;

  items.forEach(item=>{y=buildPersonaPDFBlock(doc,y,item.persona,item.dias);});
  doc.save(filename);
}
export function exportPersonaPDF(personaNombre){
  const p=personas.find(x=>x.nombre===personaNombre);
  if(!p){alert('Persona no encontrada.');return;}
  const dias=evaluacionesNuevo.filter(d=>d.persona===personaNombre);
  generatePDF([{persona:p,dias}],`Evaluacion_${safeId(personaNombre)}.pdf`);
}
export function exportAllPDF(){
  const list=nuevoPersonaList();
  if(!list.length){alert('No hay personal nuevo en período de prueba para exportar.');return;}
  const items=list.map(p=>({persona:p,dias:evaluacionesNuevo.filter(d=>d.persona===p.nombre)}));
  generatePDF(items,'Evaluaciones_Personal_Nuevo.pdf');
}
