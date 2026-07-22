import { rgVals } from './core-data.js';
import { formatFecha } from './evaluaciones.js';
import { pdfCheckPageBreak, pdfDrawHeader, pdfDrawTitleBlock, pdfSectionBar } from './evaluaciones-pdf.js';
import { g } from './form-helpers.js';
import { FINST_CHECKLIST, FINST_ENCUESTA, finstChecklist, finstEncuesta, finstProductos } from './reporte-instalacion-catalogos.js';
import { finstFirmaBase64 } from './reporte-instalacion-firma.js';

/* ===== Generación del PDF (2 páginas, igual que el papel institucional) ===== */
export async function finstGenerarPDF(){
  if(!g('finst-nombre').value.trim()||!g('finst-ot').value.trim()||!g('finst-fecha').value||!g('finst-instalador').value.trim()){
    alert('Completa al menos Nombre, OT, Fecha e Instalador antes de generar el PDF.');
    return;
  }
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'Reporte de Instalación & Certificado de Conformidad');

  const fila=(label,val,colW)=>{
    doc.setFontSize(8.5);
    doc.setFont('helvetica','bold');doc.text(label,marginX,y);
    doc.setFont('helvetica','normal');doc.text(String(val||'—'),marginX+(colW||95),y);
  };
  const dosCol=(l1,v1,l2,v2)=>{
    y=pdfCheckPageBreak(doc,y,16);
    doc.setFontSize(8.5);
    doc.setFont('helvetica','bold');doc.text(l1,marginX,y);
    doc.setFont('helvetica','normal');doc.text(String(v1||'—'),marginX+70,y);
    const midX=pageW/2+10;
    doc.setFont('helvetica','bold');doc.text(l2,midX,y);
    doc.setFont('helvetica','normal');doc.text(String(v2||'—'),midX+70,y);
    y+=15;
  };

  y=pdfSectionBar(doc,y,marginX,pageW,'1. INFORMACIÓN DEL CLIENTE Y SERVICIO',[42,120,214]);
  dosCol('Nombre:',g('finst-nombre').value,'OT N°:',g('finst-ot').value);
  dosCol('Teléfono:',g('finst-telefono').value,'Fecha:',g('finst-fecha').value?formatFecha(g('finst-fecha').value):'');
  dosCol('E-mail:',g('finst-email').value,'Instalación:',rgVals['rg-finst-instalacion']||'—');
  const respaldo=[g('finst-fotos').checked?'Fotos: Sí':'Fotos: No',g('finst-rrss').checked?'RRSS: Sí':'RRSS: No'].join(' | ');
  dosCol('Instalador:',g('finst-instalador').value,'Respaldo:',respaldo);
  y+=4;

  y=pdfSectionBar(doc,y,marginX,pageW,'2. ESPECIFICACIÓN DE PRODUCTOS INSTALADOS',[27,175,122]);
  doc.setFontSize(8.5);doc.setFont('helvetica','normal');
  const prodTxt=finstProductos.length?finstProductos.join(' · '):'—';
  const prodLines=doc.splitTextToSize(prodTxt,pageW-marginX*2);
  prodLines.forEach(line=>{y=pdfCheckPageBreak(doc,y,13);doc.text(line,marginX,y);y+=13;});
  y+=4;

  y=pdfSectionBar(doc,y,marginX,pageW,'3. REPORTE DE INSTALACIÓN (CONTROL DE CALIDAD)',[237,161,0]);
  doc.setFontSize(8);
  FINST_CHECKLIST.forEach((q,i)=>{
    const n=i+1;
    const val=finstChecklist[n]||'—';
    const qLines=doc.splitTextToSize(`${n}. ${q}`,pageW-marginX*2-46);
    const alto=Math.max(12,qLines.length*10)+4;
    y=pdfCheckPageBreak(doc,y,alto);
    doc.setFont('helvetica','normal');
    qLines.forEach((line,li)=>{doc.text(line,marginX,y+li*10);});
    doc.setFont('helvetica','bold');
    const color=val==='SI'?[27,175,122]:val==='NO'?[227,73,72]:[100,116,139];
    doc.setTextColor(color[0],color[1],color[2]);
    doc.text(val==='SI'?'SÍ':val==='NO'?'NO':val==='NA'?'N/A':'—',pageW-marginX-24,y);
    doc.setTextColor(0);
    y+=alto;
  });
  y+=4;

  y=pdfSectionBar(doc,y,marginX,pageW,'4. INFORMACIÓN ADICIONAL Y OBSERVACIONES',[124,58,237]);
  const rodGuard=[g('finst-rodapie').checked?'Rodapié':null,g('finst-guardapolvo').checked?'Guardapolvo':null].filter(Boolean).join(', ')||'—';
  dosCol('¿Rodapié/guardapolvo?:',rodGuard,'Material:',g('finst-material').value);
  dosCol('¿Se puede cortar?:',rgVals['rg-finst-cortar']||'—','','');
  doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text('Observación de instalación:',marginX,y);y+=13;
  doc.setFont('helvetica','normal');
  const obsLines=doc.splitTextToSize(g('finst-observacion').value||'—',pageW-marginX*2);
  obsLines.forEach(line=>{y=pdfCheckPageBreak(doc,y,12);doc.text(line,marginX,y);y+=12;});
  y+=4;

  y=pdfSectionBar(doc,y,marginX,pageW,'5. ENCUESTA DE SATISFACCIÓN',[42,120,214]);
  doc.setFontSize(8);
  FINST_ENCUESTA.forEach((q,i)=>{
    const n=i+1;
    const val=finstEncuesta[n]||'—';
    const qLines=doc.splitTextToSize(`${n}. ${q}`,pageW-marginX*2-40);
    const alto=Math.max(12,qLines.length*10)+4;
    y=pdfCheckPageBreak(doc,y,alto);
    doc.setFont('helvetica','normal');
    qLines.forEach((line,li)=>{doc.text(line,marginX,y+li*10);});
    doc.setFont('helvetica','bold');
    const color=val==='SI'?[27,175,122]:val==='NO'?[227,73,72]:[100,116,139];
    doc.setTextColor(color[0],color[1],color[2]);
    doc.text(val==='SI'?'SÍ':val==='NO'?'NO':'—',pageW-marginX-24,y);
    doc.setTextColor(0);
    y+=alto;
  });
  y+=2;
  doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text('¿Qué mejorarías?:',marginX,y);y+=12;
  doc.setFont('helvetica','normal');
  doc.splitTextToSize(g('finst-mejorarias').value||'—',pageW-marginX*2).forEach(line=>{y=pdfCheckPageBreak(doc,y,11);doc.text(line,marginX,y);y+=11;});
  doc.setFont('helvetica','bold');doc.text('Comentario adicional:',marginX,y);y+=12;
  doc.setFont('helvetica','normal');
  doc.splitTextToSize(g('finst-comentario-encuesta').value||'—',pageW-marginX*2).forEach(line=>{y=pdfCheckPageBreak(doc,y,11);doc.text(line,marginX,y);y+=11;});
  y+=4;

  y=pdfSectionBar(doc,y,marginX,pageW,'6. CONFIRMACIÓN DE RECEPCIÓN CONFORME',[27,175,122]);
  doc.setFontSize(7.6);doc.setTextColor(90);
  const legal='CLIENTE RECIBE CONFORME LA INSTALACIÓN: Confirmo haber revisado y estar conforme con el producto final como tipo de cortinas, pasos de luz, colores de telas y accesorios (en caso de aplicar). Revisé todos los accesorios adicionales como motores, cenefas, BeeBlack, Dark Roller y/o sistema Soft Light. Todos están funcionando correctamente por lo que recibí un producto en óptimas condiciones. Son productos fabricados a la medida, una vez confeccionadas e instaladas pese a alguna condición adversa explicada en terreno y posteriormente vía mail, Cortinas Rolzzo no se hace responsable por malos estados o calidad de techos, muros y/o paredes. Entendiendo esto Cortinas Rolzzo no realizará devolución de dinero según Ley 19496 Artículo 3º bis "B" (productos o servicios a medida).';
  doc.splitTextToSize(legal,pageW-marginX*2).forEach(line=>{y=pdfCheckPageBreak(doc,y,10);doc.text(line,marginX,y);y+=10;});
  doc.setTextColor(0);doc.setFontSize(8.5);
  y+=8;
  dosCol('Llegada:',g('finst-llegada').value,'Salida:',g('finst-salida').value);
  dosCol('Encargado(a):',g('finst-encargado').value,'Fecha:',g('finst-fecha-conforme').value?formatFecha(g('finst-fecha-conforme').value):'');
  y+=14;
  y=pdfCheckPageBreak(doc,y,110);
  const colW=(pageW-marginX*2-20)/2;
  const sigCliente=finstFirmaBase64('finst-firma-cliente');
  const sigInstalador=finstFirmaBase64('finst-firma-instalador');
  doc.setDrawColor(200);doc.setLineWidth(0.6);
  if(sigCliente)doc.addImage(sigCliente,'PNG',marginX,y,colW,70);
  if(sigInstalador)doc.addImage(sigInstalador,'PNG',marginX+colW+20,y,colW,70);
  y+=72;
  doc.line(marginX,y,marginX+colW,y);
  doc.line(marginX+colW+20,y,marginX+colW*2+20,y);
  y+=12;
  doc.setFont('helvetica','bold');doc.setFontSize(8);
  doc.text('FIRMA QUIEN RECIBE EL TRABAJO',marginX+colW/2,y,{align:'center'});
  doc.text('FIRMA INSTALADOR ENCARGADO',marginX+colW+20+colW/2,y,{align:'center'});

  /* Página 2: guía de garantía y uso correcto — es texto fijo institucional,
     igual en todos los reportes, no depende de los datos del formulario. */
  doc.addPage();
  pdfDrawHeader(doc,pageW);
  y=pdfDrawTitleBlock(doc,pageW,marginX,'Guía de Uso Correcto & Certificado de Garantía');

  y=pdfSectionBar(doc,y,marginX,pageW,'7. TÉRMINOS DE GARANTÍA Y CANALES DE CONTACTO',[42,120,214]);
  const garCols=[['Mecanismos y Sistemas','5 AÑOS'],['Telas','2 AÑOS'],['Motores','1 AÑO'],['Sistemas de Oscuridad','2 AÑOS'],['Verticales','2 AÑOS']];
  const garColW=(pageW-marginX*2)/garCols.length;
  doc.setFontSize(8);doc.setFont('helvetica','bold');
  garCols.forEach((c,i)=>doc.text(c[0],marginX+garColW*i+garColW/2,y,{align:'center',maxWidth:garColW-6}));
  y+=14;
  doc.setFont('helvetica','normal');
  garCols.forEach((c,i)=>doc.text(c[1],marginX+garColW*i+garColW/2,y,{align:'center'}));
  y+=18;
  doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('CÓMO SOLICITAR GARANTÍA:',marginX,y);y+=12;
  doc.setFont('helvetica','normal');doc.setFontSize(7.8);
  [
    'De recurrir a la garantía debes enviarnos fotos o videos y con ello agendamos la ruta según prioridad.',
    'Mail: postventa@cortinasrolzzo.cl con copia a ventas@cortinasrolzzo.cl',
    'WhatsApp: +56 9 2745 6925 (de no recibir respuesta escribir al +56 9 9942 8383)',
    'Tiempo de respuesta: Santiago: 5 días hábiles | Región y zonas foráneas: 5 a 15 días hábiles.'
  ].forEach(line=>{doc.text('• '+line,marginX,y);y+=11;});
  y+=8;

  y=pdfSectionBar(doc,y,marginX,pageW,'8. GUÍA PARA EL USO CORRECTO DE LAS CORTINAS',[27,175,122]);
  doc.setFontSize(8);
  doc.splitTextToSize('En Cortinas Rolzzo te damos las GRACIAS por haber confiado en nosotros. Te dejamos esta guía indispensable para alargar la vida útil de tus cortinas. Por favor lee atentamente las recomendaciones de uso antes de operarlas.',pageW-marginX*2-120).forEach(line=>{doc.text(line,marginX,y);y+=11;});
  y+=8;
  const secciones=[
    ['A. CORTINAS ROLLER',[
      'Ventana abierta > Cortinas Roller siempre arriba: evita que la tela se dañe por rasgaduras o quiebres por corrientes de aire, que el peso inferior se salga de la tela, rotura de zunchos, pérdida de tapas laterales o rayaduras en la barra.',
      'Salir al otro lado: las cortinas roller no se pueden correr hacia un lado; si quieres salir hacia el otro lado siempre debes enrollarlas hacia arriba.',
      'Uso de cadena: no tires fuertemente de la cadena para no trabar los topes en el mecanismo. Sube y baja correctamente hacia abajo y no hacia el frente.'
    ]],
    ['B. CORTINAS VERTICALES',[
      'Ventana abierta > Cortina Vertical recogida hacia un lado: evita que la tela se dañe, se salgan las lamas, se suelte la cadena inferior o se salgan los carritos sujetadores.',
      'Cierre de cortina: deben estar en paralelo para evitar daños en las lamas y varilla de control. No las recojas como cortina tradicional.'
    ]],
    ['C. MOTORES INALÁMBRICOS (CORTINAS ROLLER)',[
      'El instalador debe entregar un cable por motor. Cargar por 8 horas continuas con cargador de 15W+.',
      'No manipular el control o motor tras la instalación para no desconfigurar topes. Verifica siempre estar en el canal correcto del control.',
      'Visitas por supuesto fallo de garantía donde no se realizó carga o verificación de canal tendrán cobro asociado por traslado.'
    ]],
    ['D. CONSIDERACIONES DE INSTALACIÓN ESTRUCTURAL',[
      'Cortinas Rolzzo no se hace responsable por techos arenosos, de yeso, volcanitas de baja calidad (≤10 mm), madera húmeda o burbujas de aire en el concreto. Deberás gestionar su refuerzo con tu inmobiliaria o maestro.',
      'La garantía cubre únicamente defectos de instalación y materiales proporcionados por nuestra empresa.'
    ]]
  ];
  secciones.forEach(([titulo,items])=>{
    y=pdfCheckPageBreak(doc,y,20);
    doc.setFont('helvetica','bold');doc.setFontSize(8.3);doc.text(titulo,marginX,y);y+=11;
    doc.setFont('helvetica','normal');doc.setFontSize(7.6);
    items.forEach(item=>{
      const lines=doc.splitTextToSize('• '+item,pageW-marginX*2-10);
      lines.forEach(line=>{y=pdfCheckPageBreak(doc,y,10);doc.text(line,marginX+6,y);y+=10;});
    });
    y+=6;
  });
  /* QR "Tips videos": se reutiliza el mismo logo como referencia visual de
     marca; el QR real (enlace a videos de tips) debe reemplazarse por la
     imagen oficial cuando se disponga de ella, ya que este formulario no
     tiene forma de generarlo dinámicamente sin una librería de QR extra. */

  const ot=g('finst-ot').value.trim()||'sin_OT';
  const nombreArchivo=`Reporte_Instalacion_OT_${ot.replace(/[^a-zA-Z0-9]/g,'_')}.pdf`;
  doc.save(nombreArchivo);
  window._finstUltimoPdfNombre=nombreArchivo;
  g('finst-post-pdf').style.display='block';
  const postPdf=g('finst-post-pdf');
  if(postPdf&&typeof postPdf.scrollIntoView==='function')postPdf.scrollIntoView({behavior:'smooth',block:'start'});
}
