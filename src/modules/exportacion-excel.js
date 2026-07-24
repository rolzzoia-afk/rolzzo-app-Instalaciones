import { MESES, personas, registros, session, unidades, vehiculoData } from './core-data.js';
import { CATS_NUEVO, avgLabel, diasRestantes, esMiOT, escapeHtml, evalFotosOT, evaluacionesFotos, evaluacionesNuevo, isAdminUser, mesFromFecha, nuevoPersonaList, safeId } from './evaluaciones.js';
import { pdfCheckPageBreak, pdfDrawHeader, pdfDrawTitleBlock, pdfSectionBar } from './evaluaciones-pdf.js';
import { anclajeLabel, g, nivelDifLabel } from './form-helpers.js';
import { currentUserName } from './reportes-unidad.js';

/* ===== EXPORTACIÓN A EXCEL (SheetJS) ===== */
export function ensureXLSX(){if(!window.XLSX){alert('No se pudo cargar el generador de Excel. Revisa tu conexión e intenta de nuevo.');return false;}return true;}
export function xlsxDownload(rows,sheetName,filename){
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,sheetName);
  XLSX.writeFile(wb,filename);
}
export function fmtDurMin(min){if(min==null||isNaN(min))return '';let m=parseInt(min);if(m<0)m=0;const h=Math.floor(m/60),mm=m%60;return h?`${h}h ${mm}m`:`${mm}m`;}
/* Responsable de la Unidad (Historial de Viajes) */
export function exportViajesExcel(patente){
  if(!ensureXLSX())return;
  let list=unidades.slice();
  if(patente)list=list.filter(u=>u.patente===patente);
  list.sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
  if(!list.length){alert('No hay viajes para exportar.');return;}
  const rows=list.map(u=>({
    'MES':u.mes||'','FECHA':u.fecha||'','CONDUCTOR':u.conductor||'','KM INICIAL':u.kmi??'','KM FINAL':u.kmf??'','TOTAL':u.total??'','PATENTE':u.patente||'','COMBUSTIBLE':u.comb||'','RECARGA':u.recarga||'','MONTO':u.monto??'','FORMA DE PAGO':u.pago||'','INTEGRANTE 1':u.i1||'','INTEGRANTE 2':u.i2||'','INTEGRANTE 3':u.i3||'','INTEGRANTE 4':u.i4||''
  }));
  xlsxDownload(rows,'Viajes',`Viajes_${patente?safeId(patente):'todos'}.xlsx`);
}
/* Instalación y Garantías (Historial OTs) */
export function exportRegistrosExcel(){
  if(!ensureXLSX())return;
  const list=registros.slice().sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
  if(!list.length){alert('No hay registros para exportar.');return;}
  const rows=list.map(r=>({
    'FECHA INSTALACION':r.fecha||'','MES':r.mes||'','TIPO':r.tipo||'','TÉCNICO':[r.tec1,r.tec2,r.tec3,r.tec4].filter(Boolean).join(', '),'NOMBRE CLIENTE':r.cliente||'','# OT':r.ot||'','HORA DE INICIO':r.hinicio||'','CANTIDAD DE CORTINAS':r.cantidad??'','TIPO DE CORTINA':r.tipoCortina||'','ADICIONAL':r.adicional||'','CANTIDAD ADICIONAL':(r.extras&&r.extras.length)?r.extras.map(e=>e.cantidad||0).join(', '):'','TIPO DE GARANTIA':r.tipoGar||'','NIVEL/DIFICULTAD':nivelDifLabel(r.nivelDif),'MATERIAL DE DONDE SE INSTALA':(r.materiales&&r.materiales.length)?r.materiales.join(', '):(r.material||''),'ANCLAJE':anclajeLabel(r.anclaje),'HORA DE SALIDA':r.hsalida||'','TIEMPO DE INSTALACION':fmtDurMin(r.durMin),'GOOGLE⭐⭐⭐⭐⭐':r.google||'','VIDEO':r.video||'','DAÑOS':r.danos||'','TIPO DE PROBLEMA EN LA INSTALACION':r.problema||'','SOLUCION':r.solucion||'','¿QUÉ PROBLEMA SE TUVO QUE SOLUCIONAR?':r.queSol||'','¿VENDEDOR?':'','TIEMPO DE TRASLADO IDA Y VUELTA':r.traslado||'','CODIGO DE BARRA MOTOR DE REGALO':r.codMotor||'','UBICACIÓN DE INSTALACIÓN':r.ubicacion||'','¿QUIÉNES SACARON LAS FOTOS?':(r.fotografos&&r.fotografos.length)?r.fotografos.join(', '):'','GIFTCARD':r.giftcard==='Si'?'Sí':'No','CÓDIGO GIFTCARD':r.giftcardCodigo||'','% DESCUENTO GIFTCARD':(r.giftcardDescuento||r.giftcardDescuento===0)?r.giftcardDescuento:'','COMENTARIO ADICIONAL':r.comentario||'','CREADO POR':r.creadoPor||''
  }));
  xlsxDownload(rows,'Registros','Instalaciones_y_Garantias.xlsx');
}
/* Seguimiento de Reseñas (Evaluaciones de Fotos) */
/* --- Seguimiento · Reportes: panel ejecutivo por operador --- */
export function computeSegReportesPorOperador(){
  const byOt={};
  registros.forEach(r=>{
    if(!r.ot)return;
    if(!esMiOT(r))return;
    const prev=byOt[r.ot];
    if(!prev||(r.id||0)>(prev.id||0))byOt[r.ot]=r;
  });
  const mes=(g('segrep-fil-mes')?g('segrep-fil-mes').value:'')||'';
  let rows=Object.values(byOt);
  if(mes)rows=rows.filter(r=>r.mes===mes);

  const porOperador={};
  const ensure=nombre=>{
    if(!porOperador[nombre])porOperador[nombre]={nombre,conResena:0,sinResena:0,notasFotos:[],aptasRedes:0};
    return porOperador[nombre];
  };
  rows.forEach(r=>{
    const tecnicosOT=[r.tec1,r.tec2,r.tec3,r.tec4].filter(Boolean);
    tecnicosOT.forEach(t=>{
      const st=ensure(t);
      if((r.google||'No')==='Si')st.conResena++;else st.sinResena++;
    });
    const m=evalFotosOT[r.ot];
    /* Solo lo clasificado "Apta para Redes Sociales" cuenta como evaluación real
       en el reporte de calidad — "Solo Respaldo Técnico" queda fuera aunque tenga
       nota y técnico marcados (pedido explícito de jefatura). */
    if(m&&m.adminNivel&&m.clasificacionContenido==='redes'){
      (m.tecnicosEvaluados&&m.tecnicosEvaluados.length?m.tecnicosEvaluados:tecnicosOT).forEach(t=>{
        const st=ensure(t);
        st.notasFotos.push(m.adminNivel);
        st.aptasRedes++;
      });
    }
  });

  return Object.values(porOperador).map(st=>{
    const totalOT=st.conResena+st.sinResena;
    const tasaExito=totalOT?Math.round((st.conResena/totalOT)*100):null;
    const notaProm=st.notasFotos.length?(st.notasFotos.reduce((s,v)=>s+v,0)/st.notasFotos.length):null;
    return{nombre:st.nombre,conResena:st.conResena,sinResena:st.sinResena,tasaExito,notaProm,aptasRedes:st.aptasRedes};
  }).sort((a,b)=>(b.tasaExito??-1)-(a.tasaExito??-1));
}
export function renderSegReportes(){
  const tbody=g('segrep-tbody');
  if(!tbody)return;
  const selMes=g('segrep-fil-mes');
  if(selMes&&!selMes.dataset.filled){
    selMes.innerHTML='<option value="">Todos los meses</option>'+MESES.map(m=>`<option value="${m}">${m}</option>`).join('');
    selMes.dataset.filled='1';
  }
  const hintEl=g('segrep-hint');
  if(hintEl)hintEl.textContent=isAdminUser()
    ?'Panel ejecutivo de calidad por operador: cierre de reseñas Google, nota fotográfica promedio y contenido apto para redes sociales.'
    :'Tu panel de calidad personal: cierre de reseñas Google, nota fotográfica promedio y contenido apto para redes sociales.';
  let rows=computeSegReportesPorOperador();
  if(!isAdminUser()){
    const yo=currentUserName();
    rows=rows.filter(r=>r.nombre===yo);
  }
  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:1.2rem">No hay datos que coincidan con el filtro.</td></tr>';
    return;
  }
  tbody.innerHTML=rows.map(r=>`<tr>
    <td style="font-weight:700">${escapeHtml(r.nombre)}</td>
    <td class="num">${r.conResena}</td>
    <td class="num">${r.sinResena}</td>
    <td class="num">${r.tasaExito!=null?`<span class="badge ${tasaBadgeCls(r.tasaExito)}">${r.tasaExito}%</span>`:'—'}</td>
    <td class="num">${r.notaProm!=null?r.notaProm.toFixed(1)+'★':'—'}</td>
    <td class="num">${r.aptasRedes?`<span class="badge b-inst">${r.aptasRedes}</span>`:'—'}</td>
  </tr>`).join('');

  const topWrap=g('segrep-top-tablas');
  if(topWrap){
    if(!isAdminUser()){topWrap.innerHTML='';return;}
    topWrap.innerHTML=`
    <div class="dash-sec-head" style="--dsc:#4F46E5">
      <span class="dash-sec-title">Rankings Globales del Equipo</span>
    </div>
    <div class="cg2">
      <div class="ch-card" style="padding:0;overflow:hidden">
        <p class="ch-lbl" style="padding:.9rem 1.1rem 0"><i class="ti ti-camera" aria-hidden="true" style="color:#4F46E5;margin-right:4px"></i>Top Fotografía · mejor nota promedio</p>
        <div style="padding:.6rem 1.1rem 1rem">${tablaTopFotografiaHtml()}</div>
      </div>
      <div class="ch-card" style="padding:0;overflow:hidden">
        <p class="ch-lbl" style="padding:.9rem 1.1rem 0"><i class="ti ti-message-star" aria-hidden="true" style="color:#E65100;margin-right:4px"></i>Top Cierre de Reseñas · Google</p>
        <div style="padding:.6rem 1.1rem 1rem">${tablaTopResenasHtml()}</div>
      </div>
    </div>`;
  }
}
export function exportSegReportesExcel(){
  if(!ensureXLSX())return;
  let rows=computeSegReportesPorOperador();
  if(!isAdminUser()){
    const yo=currentUserName();
    rows=rows.filter(r=>r.nombre===yo);
  }
  if(!rows.length){alert('No hay datos para exportar.');return;}
  const data=rows.map(r=>({
    'OPERADOR':r.nombre,'OTS CON RESEÑA':r.conResena,'OTS SIN RESEÑA':r.sinResena,
    'TASA DE ÉXITO':r.tasaExito!=null?r.tasaExito+'%':'','NOTA FOTOGRÁFICA':r.notaProm!=null?r.notaProm.toFixed(1):'',
    'APTAS PARA REDES SOCIALES':r.aptasRedes
  }));
  xlsxDownload(data,'Reportes Calidad','Seguimiento_Reportes_Calidad.xlsx');
}
/* Reporte PDF de calidad y seguimiento (cierre de reseñas + evaluación de
   fotos por operador, más el ranking general del equipo), con el mismo
   encabezado/formato que el resto de los PDFs de la app — pensado para
   entregar a otra área (ej. Finanzas) sin tener que reformatear nada. */
export function exportSegReportesPDF(){
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF. Revisa tu conexión e intenta de nuevo.');return;}
  let rows=computeSegReportesPorOperador();
  if(!isAdminUser()){
    const yo=currentUserName();
    rows=rows.filter(r=>r.nombre===yo);
  }
  if(!rows.length){alert('No hay datos para exportar con el filtro actual.');return;}
  const mesFiltro=(g('segrep-fil-mes')?g('segrep-fil-mes').value:'')||'';
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'Reporte de calidad y seguimiento',
    `Generado el ${new Date().toLocaleDateString('es-CL')}${mesFiltro?' · Mes: '+mesFiltro:' · Todos los meses'}`);

  const colResenas=[marginX,marginX+230,marginX+330,marginX+430];
  y=pdfSectionBar(doc,y,marginX,pageW,'CIERRE DE RESEÑAS GOOGLE POR OPERADOR',[237,161,0]);
  doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(110);
  doc.text('OPERADOR',colResenas[0],y);doc.text('CON RESEÑA',colResenas[1],y);doc.text('SIN RESEÑA',colResenas[2],y);doc.text('TASA DE ÉXITO',colResenas[3],y);
  doc.setTextColor(0);y+=6;
  doc.setDrawColor(225,225,225);doc.setLineWidth(0.6);doc.line(marginX,y,pageW-marginX,y);
  y+=13;
  doc.setFont('helvetica','normal');
  rows.forEach(r=>{
    y=pdfCheckPageBreak(doc,y,14);
    doc.text(String(r.nombre),colResenas[0],y);
    doc.text(String(r.conResena),colResenas[1],y);
    doc.text(String(r.sinResena),colResenas[2],y);
    doc.text(r.tasaExito!=null?r.tasaExito+'%':'—',colResenas[3],y);
    y+=14;
  });
  y+=8;

  const colFotos=[marginX,marginX+300,marginX+440];
  y=pdfSectionBar(doc,y,marginX,pageW,'EVALUACIÓN DE FOTOS POR OPERADOR',[79,70,229]);
  const conNota=rows.filter(r=>r.notaProm!=null);
  if(!conNota.length){
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(140);
    doc.text('Sin evaluaciones de fotos registradas todavía (Seguimiento - Evaluación de Fotos).',marginX,y);y+=14;
    doc.setTextColor(0);
  }else{
    doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(110);
    doc.text('OPERADOR',colFotos[0],y);doc.text('NOTA PROMEDIO',colFotos[1],y);doc.text('APTAS PARA REDES',colFotos[2],y);
    doc.setTextColor(0);y+=6;
    doc.setDrawColor(225,225,225);doc.line(marginX,y,pageW-marginX,y);
    y+=13;
    doc.setFont('helvetica','normal');
    rows.forEach(r=>{
      y=pdfCheckPageBreak(doc,y,14);
      doc.text(String(r.nombre),colFotos[0],y);
      doc.text(r.notaProm!=null?r.notaProm.toFixed(1)+' / 5':'—',colFotos[1],y);
      doc.text(r.aptasRedes?String(r.aptasRedes):'—',colFotos[2],y);
      y+=14;
    });
  }
  y+=8;

  /* El ranking general (comparativo de TODO el equipo, no solo lo que ve
     este usuario) es la misma info admin-only que ya se muestra en pantalla
     bajo "Rankings Globales del Equipo". */
  if(isAdminUser()){
    const topFoto=rankingTopFotografia();
    const topResena=rankingTopCierreResenas();
    y=pdfSectionBar(doc,y,marginX,pageW,'RANKING GENERAL DEL EQUIPO · TOP FOTOGRAFÍA',[79,70,229]);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    if(!topFoto.length){
      doc.setTextColor(140);
      doc.text('Sin evaluaciones de fotos registradas todavía.',marginX,y);y+=14;
      doc.setTextColor(0);
    }else{
      topFoto.forEach((r,i)=>{
        y=pdfCheckPageBreak(doc,y,14);
        doc.text(`${i+1}.  ${r.nombre}`,marginX,y);
        doc.text(`${r.avg.toFixed(1)} / 5  ·  ${r.n} evaluaciones`,pageW-marginX,y,{align:'right'});
        y+=14;
      });
    }
    y+=6;
    y=pdfSectionBar(doc,y,marginX,pageW,'RANKING GENERAL DEL EQUIPO · TOP CIERRE DE RESEÑAS',[237,161,0]);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    if(!topResena.length){
      doc.setTextColor(140);
      doc.text('Sin OTs registradas todavía.',marginX,y);y+=14;
      doc.setTextColor(0);
    }else{
      topResena.forEach((r,i)=>{
        y=pdfCheckPageBreak(doc,y,14);
        doc.text(`${i+1}.  ${r.nombre}`,marginX,y);
        doc.text(`${r.total}/${r.otsAsignadas} OTs  ·  ${r.tasaExito}%`,pageW-marginX,y,{align:'right'});
        y+=14;
      });
    }
  }

  doc.save(`Reporte_Calidad_Seguimiento${mesFiltro?'_'+mesFiltro:''}.pdf`);
}
export function exportResenasExcel(){
  if(!ensureXLSX())return;
  const list=registros.slice().sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
  if(!list.length){alert('No hay datos para exportar.');return;}
  const rows=list.map(r=>{
    const m=evalFotosOT[r.ot]||{};
    return {
      'OT':r.ot||'','CLIENTE':r.cliente||'','FECHA DE INSTALACION':r.fecha||'','SEGUIMIENTO 1':m.seg1||'','SEGUIMIENTO 2':m.seg2||'','PERSONA QUE HACE SEGUIMIENTO':m.segPersona||'','INSTALADOR':r.tec1||'','INSTALADOR 2':r.tec2||'','INSTALADOR 3':r.tec3||'','COMENTARIO GOOGLE':m.comentarioGoogle||'','FORMA':'','COMENTARIO':m.comentarioAdmin||m.notasGenerales||'','NOTAS':m.segNotas||''
    };
  });
  xlsxDownload(rows,'Reseñas','Seguimiento_Resenas.xlsx');
}
/* Mantenciones y Repuestos (Furgones) */
export function exportMantencionesExcel(){
  if(!ensureXLSX())return;
  const rows=[];
  Object.keys(vehiculoData).forEach(pat=>{
    const vd=vehiculoData[pat]||{};
    (vd.items||[]).forEach(it=>{
      const f=it.fecha||'';const y=f?f.slice(0,4):'';const mo=f?mesFromFecha(f):'';
      rows.push({'MES':mo,'AÑO':y,'FECHA':f,'PATENTE':pat,'CODIGO':'','TIPO':it.nombre||'','DESCRIPCION':it.detalle||'','CANTIDAD POR FURGON':'','¿SE UTILIZA REPUESTO?':'','CANTIDAD UTILIZADA':'','RESTA':'','OT':'','COMENTARIO':'','CREADO POR':''});
    });
  });
  if(!rows.length)rows.push({'MES':'','AÑO':'','FECHA':'','PATENTE':'','CODIGO':'','TIPO':'','DESCRIPCION':'','CANTIDAD POR FURGON':'','¿SE UTILIZA REPUESTO?':'','CANTIDAD UTILIZADA':'','RESTA':'','OT':'','COMENTARIO':'','CREADO POR':''});
  xlsxDownload(rows,'Mantenciones','Mantenciones_Repuestos.xlsx');
}
/* Ranking ejecutivo: mejores notas promedio de calidad de fotos (histórico, todo el equipo) */
export function rankingTopFotografia(){
  const porTecnico={};
  evaluacionesFotos.filter(e=>e.nivel&&evalFotosOT[e.ot]?.clasificacionContenido==='redes').forEach(e=>{
    if(!porTecnico[e.persona])porTecnico[e.persona]={sum:0,n:0};
    porTecnico[e.persona].sum+=e.nivel;porTecnico[e.persona].n++;
  });
  return Object.keys(porTecnico).map(nombre=>({nombre,avg:porTecnico[nombre].sum/porTecnico[nombre].n,n:porTecnico[nombre].n}))
    .filter(r=>r.n>0).sort((a,b)=>b.avg-a.avg||b.n-a.n);
}
/* Ranking ejecutivo: operadores que más reseñas de Google han cerrado con éxito, con tasa de éxito (histórico).
   Cuenta reseñas CONFIRMADAS en el seguimiento (evalFotosOT[ot].googleReview===true, alguien pegó el
   comentario real que dejó el cliente), no lo que el técnico marcó al vuelo al generar la OT — ese
   dato es solo una expectativa, no una reseña verificada. */
export function rankingTopCierreResenas(){
  const byOt={};
  registros.forEach(r=>{
    if(!r.ot)return;
    const prev=byOt[r.ot];
    if(!prev||(r.id||0)>(prev.id||0))byOt[r.ot]=r;
  });
  const porTecnico={};
  Object.values(byOt).forEach(r=>{
    [r.tec1,r.tec2,r.tec3,r.tec4].filter(Boolean).forEach(t=>{
      if(!porTecnico[t])porTecnico[t]={conResena:0,total:0};
      porTecnico[t].total++;
      if(evalFotosOT[r.ot]?.googleReview===true)porTecnico[t].conResena++;
    });
  });
  return Object.keys(porTecnico).map(nombre=>{
    const st=porTecnico[nombre];
    return{nombre,total:st.conResena,otsAsignadas:st.total,tasaExito:st.total?Math.round((st.conResena/st.total)*100):0};
  }).sort((a,b)=>b.tasaExito-a.tasaExito||b.total-a.total);
}
export function tasaBadgeCls(tasa){return tasa>=70?'b-ok':(tasa>=40?'b-inst':'b-err');}
/* Tabla ejecutiva: Top Instaladores por nota fotográfica (usada en Dashboard y en Reportes) */
export function tablaTopFotografiaHtml(limite){
  let rows=rankingTopFotografia();
  if(limite)rows=rows.slice(0,limite);
  if(!rows.length)return'<p class="eval-empty" style="text-align:center;margin:0">Aún no hay evaluaciones de fotos registradas.</p>';
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th style="width:46px">#</th><th>Operador</th><th class="num">Nota promedio</th><th class="num">Evaluaciones</th></tr></thead>
    <tbody>${rows.map((r,i)=>`<tr>
      <td class="num" style="font-weight:800;color:var(--text-muted)">${i+1}</td>
      <td style="font-weight:700">${escapeHtml(r.nombre)}</td>
      <td class="num">${r.avg.toFixed(1)}★</td>
      <td class="num">${r.n}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
/* Tabla ejecutiva: Top Cierre de Reseñas Google, con tasa de éxito (usada en Dashboard y en Reportes) */
export function tablaTopResenasHtml(limite){
  let rows=rankingTopCierreResenas();
  if(limite)rows=rows.slice(0,limite);
  if(!rows.length)return'<p class="eval-empty" style="text-align:center;margin:0">Aún no hay OTs registradas.</p>';
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th style="width:46px">#</th><th>Operador</th><th class="num">Con reseña</th><th class="num">OTs asignadas</th><th class="num">Tasa de éxito</th></tr></thead>
    <tbody>${rows.map((r,i)=>`<tr>
      <td class="num" style="font-weight:800;color:var(--text-muted)">${i+1}</td>
      <td style="font-weight:700">${escapeHtml(r.nombre)}</td>
      <td class="num">${r.total}</td>
      <td class="num">${r.otsAsignadas}</td>
      <td class="num"><span class="badge ${tasaBadgeCls(r.tasaExito)}">${r.tasaExito}%</span></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
export function renderTopFotografiaYResenas(){
  const fotoRows=rankingTopFotografia();
  const resenaRows=rankingTopCierreResenas();
  if(!fotoRows.length&&!resenaRows.length)return'';
  return `
<div class="dash-sec-head" style="--dsc:#4F46E5">
  <span class="dash-sec-title">Rankings Ejecutivos de Calidad</span>
</div>
<div class="cg2" style="margin-bottom:1rem">
  <div class="ch-card" style="padding:0;overflow:hidden">
    <p class="ch-lbl" style="padding:.9rem 1.1rem 0"><i class="ti ti-camera" aria-hidden="true" style="color:#4F46E5;margin-right:4px"></i>Top Fotografía · mejor nota promedio</p>
    <div style="padding:.6rem 1.1rem 1rem">${tablaTopFotografiaHtml(5)}</div>
  </div>
  <div class="ch-card" style="padding:0;overflow:hidden">
    <p class="ch-lbl" style="padding:.9rem 1.1rem 0"><i class="ti ti-message-star" aria-hidden="true" style="color:#E65100;margin-right:4px"></i>Top Cierre de Reseñas · Google</p>
    <div style="padding:.6rem 1.1rem 1rem">${tablaTopResenasHtml(5)}</div>
  </div>
</div>`;
}
export function evalDashSummary(){
  const scored={BAJA:1,MEDIA:2,ALTA:3};
  const rows=[];
  personas.forEach(p=>{
    const fVals=evaluacionesFotos.filter(e=>e.persona===p.nombre&&e.nivel).map(e=>1+(e.nivel-1)*0.5);
    const nVals=[];
    evaluacionesNuevo.filter(d=>d.persona===p.nombre).forEach(d=>CATS_NUEVO.forEach(c=>{if(d.cats[c.key])nVals.push(scored[d.cats[c.key]]);}));
    const all=[...fVals,...nVals];
    if(!all.length)return;
    const avg=all.reduce((s,v)=>s+v,0)/all.length;
    if(avg<1.5)rows.push(p.nombre);
  });
  if(!rows.length)return'';
  return `
<div class="dash-eval-card">
  <p class="card-title" style="margin-bottom:.6rem;padding-bottom:0;border-bottom:none"><i class="ti ti-alert-triangle" aria-hidden="true" style="color:#E34948"></i>Personas con evaluación baja</p>
  ${rows.map(n=>`<div class="dash-eval-row"><span style="font-size:12.5px;font-weight:500">${n}</span><span class="eval-avg-badge bajo">Bajo</span></div>`).join('')}
</div>`;
}
export function renderNuevoDashSummary(){
  if(!session)return'';
  const list=nuevoPersonaList();
  if(!list.length)return'';
  const scored={BAJA:1,MEDIA:2,ALTA:3};
  const rows=list.map(p=>{
    const vals=[];
    evaluacionesNuevo.filter(d=>d.persona===p.nombre).forEach(d=>CATS_NUEVO.forEach(c=>{if(d.cats[c.key])vals.push(scored[d.cats[c.key]]);}));
    const info=vals.length?avgLabel(vals.reduce((s,v)=>s+v,0)/vals.length):{label:'Sin datos',cls:'sindata'};
    return{nombre:p.nombre,info,dias:diasRestantes(p)};
  });
  return `
<div class="dash-sec-head" style="--dsc:#7C3AED">
  <span class="dash-sec-title">Personal nuevo</span>
</div>
<div class="card" style="--sec-color:#7C3AED">
  ${rows.map(r=>`<div class="dash-eval-row"><span style="font-size:13px;font-weight:600">${r.nombre}<span style="font-weight:400;color:var(--text-muted);font-size:11px"> · ${r.dias} días de prueba</span></span><span class="eval-avg-badge ${r.info.cls}" style="font-size:12px;padding:6px 14px">${r.info.label}</span></div>`).join('')}
</div>
<p class="dash-sec-note">Promedio calculado a partir de las evaluaciones semanales de cada trabajador nuevo (Baja/Media/Alta) en la sección Personal Nuevo.</p>`;
}
