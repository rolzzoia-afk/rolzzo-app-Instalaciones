import { MESES, charts, lists, registros, session, unidades } from './core-data.js';
import { escapeHtml, evalFotosOT, formatFecha, isAdminUser } from './evaluaciones.js';
import { renderTopFotografiaYResenas } from './exportacion-excel.js';
import { g } from './form-helpers.js';
import { ensureVehData, estadoAceite, estadoRevision, kmActualVeh } from './mantenciones-vehiculos.js';
import { sw } from './nav.js';
import { renderRegReportes, verDetalleRegistro } from './periodo-helpers.js';
import { CHART_COLORS, destroyCharts, filtered } from './registro-adjuntos.js';
import { editarUnidadModal, eliminarUnidad, exportViajePDF, verViajeModal } from './reportes-unidad.js';
import { exportDashRegistrosPDF, exportDashResumenPDF } from './selector-foto-galeria.js';
import { uniregSelected } from './unidad-patente-selector.js';

/* ===== Acordeón de KPIs del Dashboard (Garantías / Con problema) ===== */
export const dashKpiData={garantias:[],conProblema:[]};
export const dashKpiState={garantias:{open:false,shown:10},conProblema:{open:false,shown:10}};
export const DASH_KPI_LABELS={garantias:'Garantías',conProblema:'Con problema'};
export function toggleDashKpiAcc(kind){
  const st=dashKpiState[kind];
  st.open=!st.open;
  if(st.open)st.shown=10;
  const accEl=g('dash-kpi-acc-'+kind);
  const accTrEl=g('dash-kpi-acc-tr-'+kind);
  const rowEl=g('dash-kpi-row-'+kind);
  if(accEl)accEl.classList.toggle('open',st.open);
  if(accTrEl)accTrEl.classList.toggle('open',st.open);
  if(rowEl)rowEl.classList.toggle('open',st.open);
  if(st.open)renderDashKpiAcc(kind);
}
export function dashKpiVerMas(kind){
  dashKpiState[kind].shown+=10;
  renderDashKpiAcc(kind);
}
export function renderDashKpiAcc(kind){
  const list=dashKpiData[kind]||[];
  const st=dashKpiState[kind];
  const inner=g('dash-kpi-acc-inner-'+kind);
  if(!inner)return;
  if(!list.length){
    inner.innerHTML=`<p class="dash-kpi-acc-empty">Sin OTs de ${DASH_KPI_LABELS[kind].toLowerCase()} en el período filtrado.</p>`;
    return;
  }
  const slice=list.slice(0,st.shown);
  const hayMas=list.length>st.shown;
  inner.innerHTML=slice.map(r=>`
    <div class="dash-kpi-acc-item" onclick="irADetalleDesdeDash(${r.id})">
      <div class="dash-kpi-acc-info">
        <span class="badge ${r.tipo==='Instalación'?'b-inst':'b-gar'}">${r.tipo||'—'}</span>
        <span style="font-weight:700">OT ${r.ot||'—'}</span>
        <span style="color:var(--text-muted)">${r.fecha?formatFecha(r.fecha):'—'}</span>
        <span style="color:var(--text-muted)">${r.cliente||'—'}</span>
        <span style="color:var(--text-muted)">${r.tec1||'—'}</span>
      </div>
      <i class="ti ti-chevron-right" aria-hidden="true" style="color:var(--text-muted)"></i>
    </div>`).join('')
    +(hayMas?`<div class="dash-kpi-acc-more"><button class="btn-sec btn-sm" onclick="event.stopPropagation();dashKpiVerMas('${kind}')"><i class="ti ti-chevron-down" aria-hidden="true"></i> Ver más antiguas</button></div>`:'');
}
/* Navegación por clic: desde el acordeón del Dashboard salta a Reportes,
   abre el detalle de la OT y hace scroll suave hasta el modal. */
export function irADetalleDesdeDash(id){
  sw('regrep');
  renderRegReportes();
  setTimeout(()=>{
    verDetalleRegistro(id);
    const modal=g('reg-detail-modal');
    if(modal)modal.scrollIntoView({behavior:'smooth',block:'center'});
  },60);
}
export function renderDash(){
  const data=filtered();
  const el=g('dash-body');
  if(data.length===0){
    destroyCharts();
    dashKpiData.garantias=[];
    dashKpiData.conProblema=[];
    el.innerHTML=`${session?renderTopFotografiaYResenas():''}<div class="empty-s"><i class="ti ti-inbox" aria-hidden="true" style="font-size:28px;display:block;margin-bottom:.5rem;opacity:.4"></i><p style="font-size:13px;font-weight:500">Sin registros</p><p style="font-size:12px">Agrega registros en la pestaña Registro</p></div>`;
    return;
  }
  const total=data.length;
  const inst=data.filter(r=>r.tipo==='Instalación').length;
  const garList=data.filter(r=>r.tipo==='Garantía');
  const gar=garList.length;
  const conProbList=data.filter(r=>r.problema&&!r.problema.toUpperCase().includes('NINGUNO'));
  const conProb=conProbList.length;
  const conGoogle=data.filter(r=>evalFotosOT[r.ot]&&evalFotosOT[r.ot].googleReview).length;
  const totalCort=data.reduce((s,r)=>s+(r.cantidad||0),0);
  const conTraslado=data.filter(r=>r.traslado&&r.traslado!=='No aplica'&&r.traslado!=='').length;
  const duraciones=data.filter(r=>r.durMin>0).map(r=>r.durMin);
  const avgDur=duraciones.length?Math.round(duraciones.reduce((s,v)=>s+v,0)/duraciones.length):0;

  dashKpiData.garantias=garList.slice().reverse();
  dashKpiData.conProblema=conProbList.slice().reverse();

  const mesMap={};data.forEach(r=>{const m=r.mes||'Sin mes';mesMap[m]=(mesMap[m]||0)+1;});
  const mesLabels=Object.keys(mesMap).sort((a,b)=>MESES.indexOf(a)-MESES.indexOf(b));
  const mesVals=mesLabels.map(k=>mesMap[k]);

  const tecMap={};
  data.forEach(r=>{[r.tec1,r.tec2,r.tec3,r.tec4].filter(Boolean).forEach(t=>{tecMap[t]=(tecMap[t]||0)+1;});});

  const googleTecMap={};
  data.filter(r=>evalFotosOT[r.ot]&&evalFotosOT[r.ot].googleReview).forEach(r=>{[r.tec1,r.tec2,r.tec3,r.tec4].filter(Boolean).forEach(t=>{googleTecMap[t]=(googleTecMap[t]||0)+1;});});
  const gtLabels=Object.keys(googleTecMap);
  const gtVals=gtLabels.map(k=>googleTecMap[k]);

  const probMap={};
  data.filter(r=>r.problema&&!r.problema.toUpperCase().includes('NINGUNO')).forEach(r=>{probMap[r.problema]=(probMap[r.problema]||0)+1;});
  const probLabels=Object.keys(probMap);
  const probVals=probLabels.map(k=>probMap[k]);

  const tecLabels=Object.keys(tecMap);
  const tecVals=tecLabels.map(k=>tecMap[k]);

  const nivelMap={MUY_BAJO:0,BAJO:0,MEDIO:0,ALTO:0,MUY_ALTO:0};
  data.forEach(r=>{if(r.nivelDif)nivelMap[r.nivelDif]=(nivelMap[r.nivelDif]||0)+1;});

  el.innerHTML=`
<div class="dash-sec-head" style="--dsc:#2a78d6">
  <span class="dash-sec-title">Resumen General</span>
  <button class="dl-btn" onclick="exportDashResumenPDF()"><i class="ti ti-download" aria-hidden="true"></i>PDF</button>
</div>
<div class="dash-card-tbl">
  <table class="dash-tbl">
    <tbody>
      <tr><td>Total visitas</td><td class="num">${total}</td></tr>
      <tr><td>Instalaciones</td><td class="num">${inst} <span style="color:var(--text-muted);font-weight:400">(${Math.round(inst/total*100)}%)</span></td></tr>
      <tr class="dash-kpi-row" id="dash-kpi-row-garantias" onclick="toggleDashKpiAcc('garantias')"><td>Garantías <i class="ti ti-chevron-right dash-kpi-chevron" aria-hidden="true"></i></td><td class="num">${gar} <span style="color:var(--text-muted);font-weight:400">(${Math.round(gar/total*100)}%)</span></td></tr>
      <tr class="dash-kpi-acc-tr" id="dash-kpi-acc-tr-garantias"><td colspan="2"><div class="dash-kpi-acc" id="dash-kpi-acc-garantias"><div class="dash-kpi-acc-inner" id="dash-kpi-acc-inner-garantias"></div></div></td></tr>
      <tr class="dash-kpi-row" id="dash-kpi-row-conProblema" onclick="toggleDashKpiAcc('conProblema')"><td>Con problema <i class="ti ti-chevron-right dash-kpi-chevron" aria-hidden="true"></i></td><td class="num">${conProb} <span style="color:var(--text-muted);font-weight:400">(${Math.round(conProb/total*100)}%)</span></td></tr>
      <tr class="dash-kpi-acc-tr" id="dash-kpi-acc-tr-conProblema"><td colspan="2"><div class="dash-kpi-acc" id="dash-kpi-acc-conProblema"><div class="dash-kpi-acc-inner" id="dash-kpi-acc-inner-conProblema"></div></div></td></tr>
      <tr><td>Reseñas Google</td><td class="num">${conGoogle} <span style="color:var(--text-muted);font-weight:400">(${Math.round(conGoogle/total*100)}% conv.)</span></td></tr>
      <tr><td>Cortinas instaladas</td><td class="num">${totalCort} unidades</td></tr>
      <tr><td>Traslados a taller</td><td class="num">${conTraslado}</td></tr>
      <tr><td>Duración promedio</td><td class="num">${avgDur} min</td></tr>
    </tbody>
  </table>
</div>
<p class="dash-sec-note">Estos números resumen las visitas registradas según los filtros de arriba: cuántas fueron instalación o garantía, cuántas tuvieron algún problema, cuántas terminaron en reseña de Google y cuántas cortinas se instalaron en total.</p>

<div class="dash-sec-head" style="--dsc:#0F9D8A">
  <span class="dash-sec-title">Gráficos</span>
</div>
<div class="cg2">
  <div class="ch-card"><p class="ch-lbl">Visitas por mes</p><div class="ch-wrap" style="height:180px"><canvas id="ch-mes" role="img" aria-label="Visitas por mes"></canvas></div></div>
  <div class="ch-card"><p class="ch-lbl">Carga por técnico</p><div class="ch-wrap" style="height:180px"><canvas id="ch-tec" role="img" aria-label="Carga por técnico"></canvas></div></div>
</div>
<div class="cg3">
  <div class="ch-card"><p class="ch-lbl"><i class="ti ti-star" aria-hidden="true" style="color:#F57F17;margin-right:4px"></i>Reseñas Google por técnico</p><div class="ch-wrap" style="height:180px"><canvas id="ch-google" role="img" aria-label="Reseñas Google por técnico"></canvas></div></div>
  <div class="ch-card"><p class="ch-lbl">Problemas registrados</p><div class="ch-wrap" style="height:180px"><canvas id="ch-prob" role="img" aria-label="Problemas"></canvas></div></div>
  <div class="ch-card"><p class="ch-lbl">Dificultad instalaciones</p><div class="ch-wrap" style="height:180px"><canvas id="ch-nivel" role="img" aria-label="Nivel de dificultad"></canvas></div></div>
</div>
<p class="dash-sec-note">De izquierda a derecha: cuántas visitas hay por mes, cuánta carga de trabajo tiene cada técnico, cuántas reseñas de Google consigue cada uno, qué tipos de problemas se repiten más, y qué tan difíciles fueron las instalaciones.</p>

${isAdminUser()?renderTopFotografiaYResenas():''}

<div class="dash-sec-head" style="--dsc:#eda100">
  <span class="dash-sec-title">Registros</span>
  <button class="dl-btn" style="background:#eda100" onclick="exportDashRegistrosPDF()"><i class="ti ti-download" aria-hidden="true"></i>PDF</button>
</div>
<div class="card" style="padding:0;overflow:hidden">
  <div style="display:flex;justify-content:flex-end;align-items:center;padding:.6rem 1rem;border-bottom:0.5px solid var(--border)">
    <span style="font-size:11px;color:var(--text-muted)">${total} registros</span>
  </div>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr>
      <th style="width:82px">Fecha</th><th style="width:80px">Tipo</th><th style="width:70px">OT</th>
      <th style="width:100px">Técnico</th><th style="width:85px" class="num">Duración</th><th style="width:90px">Cortina</th>
      <th style="width:55px" class="num">Cant.</th><th style="width:65px">Google</th><th>Problema</th>
    </tr></thead>
    <tbody>${data.slice().reverse().slice(0,60).map(r=>`<tr>
      <td>${r.fecha||'—'}</td>
      <td><span class="badge ${r.tipo==='Instalación'?'b-inst':'b-gar'}">${r.tipo||'—'}</span></td>
      <td>${r.ot||'—'}</td><td>${r.tec1||'—'}</td>
      <td class="num">${r.durMin>0?Math.floor(r.durMin/60)+'h '+r.durMin%60+'m':'—'}</td>
      <td>${r.tipoCortina||'—'}</td><td class="num">${r.cantidad||0}</td>
      <td>${(evalFotosOT[r.ot]&&evalFotosOT[r.ot].googleReview)?'<span class="badge b-ok">Sí</span>':'<span style="color:var(--text-muted);font-size:11px">No</span>'}</td>
      <td><span class="badge ${r.problema&&!r.problema.toUpperCase().includes('NINGUNO')?'b-err':'b-ok'}">${(r.problema||'—').substring(0,28)}</span></td>
    </tr>`).join('')}</tbody>
  </table></div>
  <p class="dash-sec-note" style="padding:.9rem 1rem 1rem;margin:0">Últimas visitas registradas (hasta 60), ordenadas de la más reciente a la más antigua, con su tipo, técnico, duración y estado.</p>
</div>

<div class="dash-sec-head" style="--dsc:#6B4AA7">
  <span class="dash-sec-title">Detalle de Mantenciones</span>
</div>
<div class="dash-card-tbl">
  <table class="dash-tbl">
    <thead><tr><th>Patente</th><th>Estado</th><th>Cambio de aceite</th><th>Revisión técnica</th><th class="num">KM actual</th></tr></thead>
    <tbody>
      ${lists.vehiculos.length?lists.vehiculos.map(p=>{
        const eA=estadoAceite(p),eR=estadoRevision(p),kmv=kmActualVeh(p);
        return `<tr>
          <td style="font-weight:700">${escapeHtml(p)}</td>
          <td>${escapeHtml(ensureVehData(p).estado||'Operativo')}</td>
          <td><span class="eval-avg-badge ${eA.cls}">${eA.label}</span></td>
          <td><span class="eval-avg-badge ${eR.cls}">${eR.label}</span></td>
          <td class="num">${kmv!==null?kmv.toLocaleString('es-CL')+' km':'—'}</td>
        </tr>`;
      }).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1rem">No hay vehículos cargados en Listas → Vehículos.</td></tr>'}
    </tbody>
  </table>
</div>
<p class="dash-sec-note">Estado de mantención de cada vehículo: vigencia del cambio de aceite, de la revisión técnica y el kilometraje más reciente registrado en Unidad.</p>`;

  destroyCharts();
  const co={responsive:true,maintainAspectRatio:false};
  charts.mes=new Chart(g('ch-mes'),{type:'bar',data:{labels:mesLabels,datasets:[{label:'Visitas',data:mesVals,backgroundColor:'#2a78d6',borderRadius:4}]},options:{...co,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10},color:'#898781'}},y:{ticks:{font:{size:10},color:'#898781'},beginAtZero:true}}}});
  charts.tec=new Chart(g('ch-tec'),{type:'bar',data:{labels:tecLabels,datasets:[{label:'Visitas',data:tecVals,backgroundColor:CHART_COLORS.slice(0,tecLabels.length),borderRadius:4}]},options:{...co,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10},color:'#898781'},beginAtZero:true},y:{ticks:{font:{size:10},color:'#898781'}}}}});
  charts.google=new Chart(g('ch-google'),{type:'bar',data:{labels:gtLabels.length?gtLabels:['Sin datos'],datasets:[{label:'Reseñas',data:gtLabels.length?gtVals:[0],backgroundColor:'#eda100',borderRadius:4}]},options:{...co,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10},color:'#898781',stepSize:1},beginAtZero:true},y:{ticks:{font:{size:10},color:'#898781'}}}}});
  charts.prob=new Chart(g('ch-prob'),{type:'doughnut',data:{labels:probLabels.length?probLabels:['Sin problemas'],datasets:[{data:probLabels.length?probVals:[1],backgroundColor:probLabels.length?CHART_COLORS.slice(0,probLabels.length):['#e1e0d9'],hoverOffset:4}]},options:{...co,plugins:{legend:{position:'bottom',labels:{font:{size:9},boxWidth:8,padding:6}}}}});
  charts.nivel=new Chart(g('ch-nivel'),{type:'doughnut',data:{labels:['Muy bajo','Bajo','Medio','Alto','Muy alto'],datasets:[{data:[nivelMap.MUY_BAJO,nivelMap.BAJO,nivelMap.MEDIO,nivelMap.ALTO,nivelMap.MUY_ALTO],backgroundColor:['#1baf7a','#7bc796','#eda100','#e37b48','#e34948'],hoverOffset:4}]},options:{...co,plugins:{legend:{position:'bottom',labels:{font:{size:9},boxWidth:8,padding:6}}}}});

  ['garantias','conProblema'].forEach(kind=>{
    const st=dashKpiState[kind];
    const accEl=g('dash-kpi-acc-'+kind);
    const accTrEl=g('dash-kpi-acc-tr-'+kind);
    const rowEl=g('dash-kpi-row-'+kind);
    if(accEl)accEl.classList.toggle('open',st.open);
    if(accTrEl)accTrEl.classList.toggle('open',st.open);
    if(rowEl)rowEl.classList.toggle('open',st.open);
    if(st.open)renderDashKpiAcc(kind);
  });
}


export function renderUniTable(){
  const wrap=g('uni-table');
  if(!wrap)return;
  if(!uniregSelected){
    g('uni-count').textContent='0 registros';
    wrap.innerHTML=`<div class="empty-s" style="padding:1.5rem"><p style="font-size:12px">Selecciona una patente arriba para ver su historial.</p></div>`;
    return;
  }
  const trips=unidades.filter(u=>u.patente===uniregSelected).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')||(b.id||0)-(a.id||0));
  g('uni-count').textContent=`${trips.length} registro${trips.length===1?'':'s'} · ${uniregSelected}`;
  if(!trips.length){wrap.innerHTML=`<div class="empty-s" style="padding:1.5rem"><p style="font-size:12px">Sin registros de kilometraje para ${escapeHtml(uniregSelected)}.</p></div>`;return;}
  wrap.innerHTML=`<div class="card" style="padding:0;overflow:hidden;margin-bottom:0">`+trips.map(u=>`
    <div class="reg-row">
      <div class="reg-row-info">
        <span class="reg-row-fecha">${u.fecha?formatFecha(u.fecha):'—'}</span>
        <span class="reg-row-ot"><i class="ti ti-user" aria-hidden="true"></i> ${escapeHtml(u.conductor||'—')}</span>
        <span class="reg-row-cliente">${u.total>0?u.total.toLocaleString('es-CL')+' km recorridos':'—'}</span>
        <span class="reg-row-badges">
          <span class="badge ${u.recarga==='SI'?'b-inst':'b-gar'}">${escapeHtml(u.comb||'—')}</span>
          ${(u.fotoKmiPath&&u.fotoKmfPath)?'<span class="badge b-ok"><i class="ti ti-camera" aria-hidden="true"></i> Con fotos</span>':'<span class="badge b-err"><i class="ti ti-camera-off" aria-hidden="true"></i> Sin fotos</span>'}
        </span>
      </div>
      <div class="reg-row-actions">
        <button class="btn-sec btn-sm" onclick="verViajeModal(${u.id})"><i class="ti ti-eye" aria-hidden="true"></i> Ver</button>
        <button class="btn-sec btn-sm" onclick="editarUnidadModal(${u.id})"><i class="ti ti-pencil" aria-hidden="true"></i> Editar</button>
        <button class="btn-sec btn-sm" onclick="exportViajePDF(${u.id})"><i class="ti ti-download" aria-hidden="true"></i> PDF</button>
        <button class="btn-del" onclick="eliminarUnidad(${u.id})" title="Eliminar"><i class="ti ti-trash" aria-hidden="true"></i></button>
      </div>
    </div>`).join('')+`</div>`;
}
