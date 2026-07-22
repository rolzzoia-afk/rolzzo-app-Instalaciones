/* ===== EXPORTAR PDF ===== */
export function catCellColor(nivel){
  if(nivel==='BAJA')return{fill:[253,232,232],text:[178,38,30],letter:'B'};
  if(nivel==='MEDIA')return{fill:[237,161,0],text:[40,30,0],letter:'M'};
  if(nivel==='ALTA')return{fill:[27,175,122],text:[255,255,255],letter:'A'};
  return{fill:[238,238,238],text:[150,150,150],letter:'–'};
}
/* Franja negra superior delgada. El logo de Rolzzo va DEBAJO de la franja,
   grande y centrado (no incrustado dentro de la banda). Se dibuja en cada
   página nueva (incluidos los saltos de página automáticos). */
export const PDF_BAND_H=16;
export const PDF_LOGO_H=64;
export function pdfDrawHeader(doc,pageW){
  doc.setFillColor(13,13,13);
  doc.rect(0,0,pageW,PDF_BAND_H,'F');
  try{
    const logoEl=document.getElementById('app-logo-img');
    if(logoEl&&logoEl.complete&&logoEl.naturalWidth){
      const h=PDF_LOGO_H,w=h*(logoEl.naturalWidth/logoEl.naturalHeight);
      doc.addImage(logoEl,'PNG',(pageW-w)/2,PDF_BAND_H+14,w,h);
    }
  }catch(e){}
}
/* Debajo del logo: el identificador principal del documento (N° de patente
   o N° de OT) en grande, negrita y centrado, seguido de una línea divisoria.
   Se dibuja solo en la portada del documento, no en cada salto de página.
   Devuelve el nuevo valor de "y" para continuar. */
export function pdfDrawTitleBlock(doc,pageW,marginX,titulo,subtitulo){
  let y=PDF_BAND_H+14+PDF_LOGO_H+28;
  doc.setFont('helvetica','bold');doc.setFontSize(22);doc.setTextColor(20,20,20);
  doc.text(String(titulo).toUpperCase(),pageW/2,y,{align:'center'});
  y+=8;
  if(subtitulo){
    y+=14;
    doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(110);
    doc.text(subtitulo,pageW/2,y,{align:'center'});
    doc.setTextColor(0);
  }
  y+=16;
  doc.setDrawColor(20,20,20);doc.setLineWidth(1.4);
  doc.line(marginX,y,pageW-marginX,y);
  return y+22;
}
export function pdfCheckPageBreak(doc,y,needed){
  const pageH=doc.internal.pageSize.getHeight();
  const pageW=doc.internal.pageSize.getWidth();
  if(y+needed>pageH-40){
    doc.addPage();
    pdfDrawHeader(doc,pageW);
    return PDF_BAND_H+14+PDF_LOGO_H+30;
  }
  return y;
}
export function clsToRGB(cls){
  if(cls==='alto')return[27,175,122];
  if(cls==='medio')return[237,161,0];
  if(cls==='bajo')return[227,73,72];
  return[100,116,139];
}
/* Barra de sección con línea divisoria completa arriba para separar
   claramente el bloque de información de una sección del de la siguiente
   (ej: "Cambio de aceite" vs "Revisión técnica", o una OT de otra). */
export function pdfSectionBar(doc,y,marginX,pageW,text,rgb){
  y=pdfCheckPageBreak(doc,y,26);
  y+=6;
  doc.setDrawColor(225,225,225);doc.setLineWidth(0.6);
  doc.line(marginX,y,pageW-marginX,y);
  y+=14;
  doc.setDrawColor(rgb[0],rgb[1],rgb[2]);
  doc.setLineWidth(2.2);
  doc.line(marginX,y,marginX+26,y);
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(30,30,30);
  doc.text(text,marginX+33,y+3.5);
  doc.setTextColor(0);doc.setFont('helvetica','normal');
  return y+18;
}
