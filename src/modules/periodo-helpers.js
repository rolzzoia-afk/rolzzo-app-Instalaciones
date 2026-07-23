import { renderMantDetail } from './adjuntos-pendientes.js';
import { dbDeleteEvalFoto, dbDeleteRegistro, dbError, dbUpsertVehiculo, sb, sbReady } from './bootstrap.js';
import { abrirEditarOTModal } from './buscador-ot.js';
import { MESES, __set_otContext, __set_registros, currentTab, otContext, registros } from './core-data.js';
import { renderDash } from './dashboard-kpis.js';
import { __set_evaluacionesFotos, escapeHtml, evalFotosOT, evaluacionesFotos, formatFecha, isAdminUser, safeId } from './evaluaciones.js';
import { __set_efAcordeonOtAbierta, efAcordeonOtAbierta, renderEvalFotos } from './evaluaciones-extra.js';
import { pdfCheckPageBreak, pdfDrawHeader, pdfDrawTitleBlock, pdfSectionBar } from './evaluaciones-pdf.js';
import { anclajeLabel, g, nivelDifLabel, tecnicosList } from './form-helpers.js';
import { ensureVehData } from './mantenciones-vehiculos.js';
import { adjuntoUrl, forzarDescarga } from './registro-adjuntos.js';
import { pdfAddPhotosPage } from './selector-foto-galeria.js';

/* ===== Helpers de período (Mes actual / Semana actual / Año completo / Rango) ===== */
export function _pad2(n){return String(n).padStart(2,'0');}
export function fechaISOHoy(){const d=new Date();return`${d.getFullYear()}-${_pad2(d.getMonth()+1)}-${_pad2(d.getDate())}`;}
export function inicioSemanaISO(d){
  const dt=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const day=dt.getDay();
  const diff=(day===0?-6:1)-day;
  dt.setDate(dt.getDate()+diff);
  return`${dt.getFullYear()}-${_pad2(dt.getMonth()+1)}-${_pad2(dt.getDate())}`;
}
export function finSemanaISO(d){
  const inicio=inicioSemanaISO(d);
  const[y,m,dd]=inicio.split('-').map(Number);
  const dt=new Date(y,m-1,dd);
  dt.setDate(dt.getDate()+6);
  return`${dt.getFullYear()}-${_pad2(dt.getMonth()+1)}-${_pad2(dt.getDate())}`;
}
/* Convierte el valor de un <input type="week"> (formato 'YYYY-Www') en fecha ISO de
   inicio y fin de esa semana (lunes a domingo). */
export function semanaInputARango(valorSemana){
  if(!valorSemana)return{desde:'',hasta:''};
  const[yStr,wStr]=valorSemana.split('-W');
  const y=parseInt(yStr,10),w=parseInt(wStr,10);
  if(!y||!w)return{desde:'',hasta:''};
  const enero4=new Date(y,0,4);
  const diaSemanaEnero4=enero4.getDay()||7;
  const lunesSemana1=new Date(enero4);
  lunesSemana1.setDate(enero4.getDate()-diaSemanaEnero4+1);
  const desdeDate=new Date(lunesSemana1);
  desdeDate.setDate(lunesSemana1.getDate()+(w-1)*7);
  const hastaDate=new Date(desdeDate);
  hastaDate.setDate(desdeDate.getDate()+6);
  const desde=`${desdeDate.getFullYear()}-${_pad2(desdeDate.getMonth()+1)}-${_pad2(desdeDate.getDate())}`;
  const hasta=`${hastaDate.getFullYear()}-${_pad2(hastaDate.getMonth()+1)}-${_pad2(hastaDate.getDate())}`;
  return{desde,hasta};
}
/* Convierte el valor de un <input type="month"> (formato 'YYYY-MM') en rango ISO
   de primer y último día de ese mes. */
export function mesInputARango(valorMes){
  if(!valorMes)return{desde:'',hasta:''};
  const[yStr,mStr]=valorMes.split('-');
  const y=parseInt(yStr,10),m=parseInt(mStr,10);
  if(!y||!m)return{desde:'',hasta:''};
  const ultimoDia=new Date(y,m,0).getDate();
  const desde=`${y}-${_pad2(m)}-01`;
  const hasta=`${y}-${_pad2(m)}-${_pad2(ultimoDia)}`;
  return{desde,hasta};
}
/* Devuelve la lista de registros aplicando técnico + fecha exacta + semana + mes,
   los tres filtros temporales combinables entre sí (se intersectan). Esta misma
   función alimenta la tabla en pantalla, el contador en vivo y las exportaciones. */
export function regrepFilteredList(){
  const filTecEl=g('regrep-fil-tec');
  const tec=filTecEl?filTecEl.value:'';
  const fechaExacta=g('regrep-fil-fecha')?g('regrep-fil-fecha').value:'';
  const semanaVal=g('regrep-fil-semana')?g('regrep-fil-semana').value:'';
  const mesVal=g('regrep-fil-mes')?g('regrep-fil-mes').value:'';
  const rangoSemana=semanaInputARango(semanaVal);
  const rangoMes=mesInputARango(mesVal);
  let list=registros.slice();
  if(tec)list=list.filter(r=>r.tec1===tec||r.tec2===tec||r.tec3===tec||r.tec4===tec);
  if(fechaExacta)list=list.filter(r=>r.fecha===fechaExacta);
  if(rangoSemana.desde)list=list.filter(r=>r.fecha&&r.fecha>=rangoSemana.desde&&r.fecha<=rangoSemana.hasta);
  if(rangoMes.desde)list=list.filter(r=>r.fecha&&r.fecha>=rangoMes.desde&&r.fecha<=rangoMes.hasta);
  return{list,tec,fechaExacta,semanaVal,mesVal};
}
export function regrepPeriodoLabel(fechaExacta,semanaVal,mesVal){
  const partes=[];
  if(fechaExacta)partes.push(`la fecha ${formatFecha(fechaExacta)}`);
  if(semanaVal){
    const r=semanaInputARango(semanaVal);
    partes.push(`la semana del ${formatFecha(r.desde)} al ${formatFecha(r.hasta)}`);
  }
  if(mesVal){
    const[y,m]=mesVal.split('-').map(Number);
    partes.push(`${MESES[m-1]?MESES[m-1].charAt(0)+MESES[m-1].slice(1).toLowerCase():mesVal} de ${y}`);
  }
  return partes.join(' + ');
}
export function updateRegrepCounter(list,tec,fechaExacta,semanaVal,mesVal){
  const numEl=g('regrep-counter-num');
  const txtEl=g('regrep-counter-txt');
  if(!numEl||!txtEl)return;
  numEl.textContent=list.length;
  const periodoLbl=regrepPeriodoLabel(fechaExacta,semanaVal,mesVal);
  let txt;
  if(tec&&periodoLbl)txt=`Órdenes realizadas por ${tec} en ${periodoLbl}`;
  else if(tec)txt=`Órdenes realizadas por ${tec} en total`;
  else if(periodoLbl)txt=`Órdenes de trabajo en ${periodoLbl}`;
  else txt='Órdenes de trabajo en total';
  txtEl.textContent=txt;
}
export function renderRegReportes(){
  const filTecEl=g('regrep-fil-tec');
  if(filTecEl){const cur=filTecEl.value;filTecEl.innerHTML='<option value="">Todos</option>'+tecnicosList().map(t=>`<option value="${t}">${t}</option>`).join('');filTecEl.value=cur;}
  const{list:listAsc,tec,fechaExacta,semanaVal,mesVal}=regrepFilteredList();
  updateRegrepCounter(listAsc,tec,fechaExacta,semanaVal,mesVal);
  const list=listAsc.slice().reverse();
  const el=g('regrep-list');
  if(!list.length){el.innerHTML='<div class="empty-s" style="padding:1.5rem"><p style="font-size:12px">Sin OTs para este filtro.</p></div>';return;}
  el.innerHTML=list.map(r=>`
  <div class="reg-row">
    <div class="reg-row-info">
      <span class="reg-row-fecha">${r.fecha?formatFecha(r.fecha):'—'}</span>
      <span class="reg-row-ot">OT ${r.ot||'—'}</span>
      <span class="reg-row-cliente">${r.cliente||'—'}</span>
      <span class="reg-row-badges">
        <span class="badge ${r.tipo==='Instalación'?'b-inst':'b-gar'}">${r.tipo||'—'}</span>
        <span class="reg-row-tec">${r.tec1||'—'}</span>
      </span>
    </div>
    <div class="reg-row-actions">
      <button class="btn-sec btn-sm" onclick="verDetalleRegistro(${r.id})"><i class="ti ti-eye" aria-hidden="true"></i> Ver</button>
      ${isAdminUser()?`<button class="btn-sec btn-sm" onclick="editarRegistroModal(${r.id})"><i class="ti ti-pencil" aria-hidden="true"></i> Editar</button>`:''}
      <button class="btn-sec btn-sm" onclick="exportRegistroPDF(${r.id})"><i class="ti ti-download" aria-hidden="true"></i> PDF</button>
      ${isAdminUser()?`<button class="btn-del" onclick="eliminarRegistro(${r.id})" title="Eliminar"><i class="ti ti-trash" aria-hidden="true"></i></button>`:''}
    </div>
  </div>`).join('');
}
export function clearRegReportesFil(){
  g('regrep-fil-tec').value='';
  g('regrep-fil-fecha').value='';
  g('regrep-fil-semana').value='';
  g('regrep-fil-mes').value='';
  renderRegReportes();
}
export let regdetCurrentId=null;
export function getRegdetCurrentId(){return regdetCurrentId;}
export function verDetalleRegistro(id){
  const r=registros.find(x=>x.id===id);if(!r)return;
  regdetCurrentId=id;
  const tecnicos=[r.tec1,r.tec2,r.tec3,r.tec4,...(r.tecnicosExtra||[])].filter(Boolean).join(', ')||'—';
  const extrasList=(r.extras&&r.extras.length)?r.extras:((r.adicional||r.tipoGar)?[{adicional:r.adicional,cantidad:'',tipoGar:r.tipoGar}]:[]);
  const extrasHtml=extrasList.length?
    `<div class="regdet-prod-list">`+extrasList.map(e=>`
      <div class="regdet-prod-card">
        <div class="regdet-prod-field"><span class="regdet-prod-lbl">Adicional</span><span class="regdet-prod-val">${escapeHtml(e.adicional||'—')}</span></div>
        <div class="regdet-prod-field"><span class="regdet-prod-lbl">Cantidad</span><span class="regdet-prod-val">${e.cantidad||0}</span></div>
        <div class="regdet-prod-field"><span class="regdet-prod-lbl">Tipo de garantía</span><span class="regdet-prod-val">${escapeHtml(e.tipoGar||'—')}</span></div>
      </div>`).join('')+`</div>`
    :'<p class="eval-empty" style="margin-top:.4rem">Sin adicionales ni garantías registradas.</p>';
  const prodsList=(r.productos&&r.productos.length)?r.productos:(r.tipoCortina?[{tipo:r.tipoCortina,cantidad:r.cantidad,codigo:''}]:[]);
  const prodsHtml=prodsList.length?
    `<div class="regdet-prod-list">`+prodsList.map(p=>`
      <div class="regdet-prod-card">
        <div class="regdet-prod-field"><span class="regdet-prod-lbl">Tipo de cortina</span><span class="regdet-prod-val">${escapeHtml(p.tipo||'—')}</span></div>
        <div class="regdet-prod-field"><span class="regdet-prod-lbl">Cantidad</span><span class="regdet-prod-val">${p.cantidad||0}</span></div>
        <div class="regdet-prod-field"><span class="regdet-prod-lbl">Código de cortina</span><span class="regdet-prod-val">${escapeHtml(p.codigo||'—')}</span></div>
      </div>`).join('')+`</div>`
    :'<p class="eval-empty" style="margin-top:.4rem">Sin productos registrados.</p>';
  const materialesTxt=(r.materiales&&r.materiales.length)?r.materiales.join(', '):(r.material||'—');
  const fotografosTxt=(r.fotografos&&r.fotografos.length)?r.fotografos.join(', '):'—';
  const giftcardTxt=r.giftcard==='Si'
    ?`Sí${r.giftcardCodigo?' · Código: '+r.giftcardCodigo:''}${(r.giftcardDescuento||r.giftcardDescuento===0)?' · '+r.giftcardDescuento+'% dcto.':''}`
    :'No';
  const rows=[
    ['Fecha',r.fecha?formatFecha(r.fecha):'—'],['Mes',r.mes||'—'],['Tipo',r.tipo||'—'],['N° OT',r.ot||'—'],
    ['Cliente',r.cliente||'—'],
    ['Técnicos',tecnicos],
    ['Hora inicio',r.hinicio||'—'],['Hora salida',r.hsalida||'—'],['Traslado',r.traslado||'—'],
    ['Productos',prodsHtml,true],['Cantidad total',r.cantidad||0],
    ['Adicionales / Garantía',extrasHtml,true],
    ['Nivel/Dificultad',nivelDifLabel(r.nivelDif)],
    ['Material',materialesTxt],['Anclaje',anclajeLabel(r.anclaje)],
    ['Ubicación',r.ubicacion||'—'],['Código motor',r.codMotor||'—'],
    ['Calle',r.calle||'—'],['Número',r.numero||'—'],['Región',r.region||'—'],['Comuna',r.comuna||'—'],
    ['Reseña Google',r.google||'—'],['Video',r.video||'—'],['Daños',r.danos||'—'],
    ['Comentario de seguimiento',r.comentarioSeguimiento||'—'],
    ['Problema',r.problema||'—'],['Solución',r.solucion||'—'],['Qué se solucionó',r.queSol||'—'],
    ['Comentario',r.comentario||'—'],
    ['¿Quiénes sacaron las fotos?',fotografosTxt],
    ['Giftcard',giftcardTxt]
  ];
  g('regdet-modal-body').innerHTML=rows.map(f=>{
    if(f[2]===true){
      return `<div class="regdet-row" style="display:block"><span class="regdet-lbl" style="display:block;margin-bottom:6px">${f[0]}</span>${f[1]}</div>`;
    }
    return `<div class="regdet-row"><span class="regdet-lbl">${f[0]}</span><span class="regdet-val">${escapeHtml(String(f[1]))}</span></div>`;
  }).join('');
  const adjuntos=r.adjuntos||[];
  const adjEl=g('regdet-adjuntos');
  if(adjEl){
    if(!adjuntos.length){
      adjEl.innerHTML='<p class="eval-empty" style="margin-top:.8rem">Sin documentos adjuntos para esta OT.</p>';
    }else{
      adjEl.innerHTML=`<p class="sec-lbl" style="margin-top:1rem">Documentos adjuntos (${adjuntos.length})</p><div class="ef-fotos-grid">`+
        adjuntos.map(a=>{
          const url=adjuntoUrl(a);
          const isImg=(a.mimeType||'').startsWith('image/');
          const nombre=escapeHtml(a.nombreArchivo||'archivo');
          const media=isImg&&url?`<img src="${url}" alt="${nombre}" onclick="${url?`window.open('${url}','_blank')`:''}">`:
            `<div class="ef-foto-ph" onclick="${url?`window.open('${url}','_blank')`:''}"><i class="ti ti-file-type-pdf" aria-hidden="true"></i></div>`;
          return `<div class="ef-foto-card">${media}<div class="ef-foto-meta"><span class="ef-foto-name" title="${nombre}">${nombre}</span></div><div style="display:flex;gap:6px;padding:0 7px 7px">
            <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="window.open('${url}','_blank')"`:'disabled'}><i class="ti ti-eye" aria-hidden="true"></i> Ver en grande</button>
            <button class="btn-sec btn-sm" style="flex:1" ${url?`onclick="forzarDescarga('${url}','${nombre}')"`:'disabled'}><i class="ti ti-download" aria-hidden="true"></i> Descargar</button>
          </div></div>`;
        }).join('')+'</div>';
    }
  }
  g('reg-detail-modal').style.display='flex';
}
export function closeRegDetailModal(){g('reg-detail-modal').style.display='none';}
export function editarRegistroModal(id){
  const r=registros.find(x=>x.id===id);if(!r)return;
  __set_otContext({ot:r.ot,registro:r});
  if(!isAdminUser()){
    alert('Solo un administrador puede editar una OT ya registrada. Solicita la edición a un perfil de administrador.');
    return;
  }
  abrirEditarOTModal();
}
/* Elimina la ficha completa de una OT (seguimientos, comentarios, fotos) de Supabase */
export async function dbDeleteEvalFotosOT(ot){
  if(!sbReady())return;
  try{const{error}=await sb.from('rolzzo_eval_fotos_ot').delete().eq('ot',ot);if(error)throw error;}
  catch(e){dbError('eliminar ficha de OT',e);}
}
export function eliminarRegistro(id){
  if(!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.'))return;
  const target=registros.find(x=>x.id===id);
  const ot=target?target.ot:null;
  __set_registros(registros.filter(r=>r.id!==id));
  dbDeleteRegistro(id);
  /* Si ya no queda ninguna otra visita con esa misma OT, se limpia también
     todo lo asociado: calificaciones de los técnicos, seguimiento, comentarios
     y los archivos de fotos/videos en Storage, para que no quede nada huérfano. */
  if(ot&&!registros.some(r=>r.ot===ot)){
    const evsToDelete=evaluacionesFotos.filter(e=>e.ot===ot);
    __set_evaluacionesFotos(evaluacionesFotos.filter(e=>e.ot!==ot));
    evsToDelete.forEach(e=>dbDeleteEvalFoto(e.id));
    const meta=evalFotosOT[ot];
    if(meta&&meta.fotos&&meta.fotos.length&&sbReady()){
      meta.fotos.forEach(f=>{if(f.storagePath)sb.storage.from('evaluacion-fotos').remove([f.storagePath]).catch(()=>{});});
    }
    delete evalFotosOT[ot];
    dbDeleteEvalFotosOT(ot);
    if(otContext&&otContext.ot===ot){__set_otContext(null);if(efAcordeonOtAbierta===String(ot))__set_efAcordeonOtAbierta(null);}
  }
  renderRegReportes();
  if(currentTab==='dash')renderDash();
  if(currentTab==='seg_fotos')renderEvalFotos();
}
export function buildRegistroPDFBlock(doc,y,r,esPrimeraEnPagina){
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  y=pdfCheckPageBreak(doc,y,70);
  y+=8;
  if(!esPrimeraEnPagina){
    /* Línea negra gruesa: marca claramente el inicio de la info de una OT
       distinta a la anterior, para no confundir un registro con otro. */
    doc.setDrawColor(20,20,20);doc.setLineWidth(1.6);
    doc.line(marginX,y,pageW-marginX,y);
    y+=16;
  }
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(20,20,20);
  doc.text('OT '+(r.ot||'—'),marginX,y);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(90);
  doc.text(r.fecha?formatFecha(r.fecha):'',pageW-marginX,y,{align:'right'});
  doc.setTextColor(0);
  y+=6;
  doc.setDrawColor(210);doc.setLineWidth(0.8);
  doc.line(marginX,y,pageW-marginX,y);
  y+=15;

  const extrasTxt=(r.extras&&r.extras.length)?r.extras.map(e=>[e.adicional,e.cantidad?('x'+e.cantidad):'',e.tipoGar].filter(Boolean).join(' ')).filter(Boolean).join(' · '):[r.adicional,r.tipoGar].filter(Boolean).join(' / ');

  const pintarCampos=(campos)=>{
    doc.setFontSize(8.5);
    campos.forEach(c=>{
      if(!c[1])return;
      y=pdfCheckPageBreak(doc,y,14);
      doc.setFont('helvetica','bold');doc.text(c[0]+':',marginX,y);
      doc.setFont('helvetica','normal');
      const lines=doc.splitTextToSize(String(c[1]),pageW-marginX*2-90);
      doc.text(lines,marginX+90,y);
      y+=lines.length*11+3;
    });
  };

  y=pdfSectionBar(doc,y,marginX,pageW,'CLIENTE Y EQUIPO',[42,120,214]);
  pintarCampos([
    ['Cliente',r.cliente],['Tipo',r.tipo],
    ['Técnicos',[r.tec1,r.tec2,r.tec3,r.tec4,...(r.tecnicosExtra||[])].filter(Boolean).join(', ')],
    ['Horario',(r.hinicio||r.hsalida)?`${r.hinicio||'—'} a ${r.hsalida||'—'}`:'']
  ]);

  y=pdfSectionBar(doc,y,marginX,pageW,'PRODUCTO E INSTALACIÓN',[100,116,139]);
  pintarCampos([
    ['Tipo de cortina',r.tipoCortina],['Cantidad',r.cantidad],
    ['Adicional / Garantía',extrasTxt],['Material',r.material],['Anclaje',r.anclaje]
  ]);

  y=pdfSectionBar(doc,y,marginX,pageW,'UBICACIÓN',[27,175,122]);
  pintarCampos([
    ['Ubicación',r.ubicacion],['Dirección',[r.calle,r.numero].filter(Boolean).join(' ')],['Comuna',r.comuna]
  ]);

  if(r.problema||r.solucion||r.comentario){
    y=pdfSectionBar(doc,y,marginX,pageW,'PROBLEMA Y COMENTARIO',[237,161,0]);
    pintarCampos([
      ['Problema',r.problema],['Solución',r.solucion],
      ['Especificación / comentario',r.comentario]
    ]);
  }
  return y+18;
}
export async function exportRegistroPDF(id){
  const r=registros.find(x=>x.id===id);if(!r){alert('Registro no encontrado.');return;}
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  const pageH=doc.internal.pageSize.getHeight();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'OT '+(r.ot||'—'),`Generado el ${new Date().toLocaleDateString('es-CL')}`);
  buildRegistroPDFBlock(doc,y,r,true);
  const fotos=(r.adjuntos||[]).filter(a=>(a.mimeType||'').startsWith('image/')).map(a=>({url:adjuntoUrl(a),nombre:a.nombreArchivo||''}));
  await pdfAddPhotosPage(doc,pageW,pageH,marginX,[{titulo:'OT '+(r.ot||'—'),fotos}]);
  doc.save(`OT_${safeId(r.ot||String(r.id))}.pdf`);
}
export async function exportRegReportesTodosPDF(){
  const{list}=regrepFilteredList();
  if(!list.length){alert('No hay OTs para exportar con estos filtros.');return;}
  if(!window.jspdf){alert('No se pudo cargar el generador de PDF.');return;}
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const marginX=36;
  const pageW=doc.internal.pageSize.getWidth();
  const pageH=doc.internal.pageSize.getHeight();
  pdfDrawHeader(doc,pageW);
  let y=pdfDrawTitleBlock(doc,pageW,marginX,'Reporte de OTs',`Generado el ${new Date().toLocaleDateString('es-CL')}`);
  const ordenados=list.slice().reverse();
  ordenados.forEach(r=>{y=buildRegistroPDFBlock(doc,y,r,true);});
  const grupos=ordenados.map(r=>({
    titulo:'OT '+(r.ot||'—'),
    fotos:(r.adjuntos||[]).filter(a=>(a.mimeType||'').startsWith('image/')).map(a=>({url:adjuntoUrl(a),nombre:a.nombreArchivo||''}))
  }));
  await pdfAddPhotosPage(doc,pageW,pageH,marginX,grupos);
  doc.save('Reporte_OTs.pdf');
}
export async function setEstadoVehiculo(patente,val){
  const vd=ensureVehData(patente);
  const prevEstado=vd.estado;
  vd.estado=val;
  const ok=await dbUpsertVehiculo(patente);
  if(!ok){
    vd.estado=prevEstado;
    renderMantDetail();
  }
}
export function flashGuardado(btnEl){
  if(!btnEl)return;
  const original=btnEl.innerHTML;
  btnEl.innerHTML='<i class="ti ti-check" aria-hidden="true"></i> Guardado';
  btnEl.disabled=true;
  setTimeout(()=>{if(btnEl){btnEl.innerHTML=original;btnEl.disabled=false;}},1500);
}
