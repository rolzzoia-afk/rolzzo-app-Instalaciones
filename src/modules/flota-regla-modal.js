import { renderMantDetail } from './adjuntos-pendientes.js';
import { dbUpsertVehiculo } from './bootstrap.js';
import { MANT_PARAMS, __set_mantSelected, lists, mantSelected } from './core-data.js';
import { __set_flotaEditId, flotaEditId, flotaSelected, reglasFlota, renderEstadoFlota } from './estado-flota.js';
import { escapeHtml, isAdminUser } from './evaluaciones.js';
import { g } from './form-helpers.js';
import { ensureVehData, kmActualVeh } from './mantenciones-vehiculos.js';
import { addPatenteChipBtn, currentUserName } from './reportes-unidad.js';

/* ===== Modal agregar/editar regla ===== */
export function abrirModalAgregarMantencionFlota(reglaId){
  if(!flotaSelected){alert('Selecciona una patente primero.');return;}
  /* Las mantenciones se crean únicamente desde "Ingreso de mantención" (en
     la pantalla Mantenciones). Este modal ya solo se usa para EDITAR una
     regla existente, y solo lo puede abrir un administrador — el botón que
     lo dispara está oculto para cualquier otro usuario. */
  if(reglaId&&!isAdminUser()){
    alert('Esta mantención ya tiene datos registrados. Solo un administrador puede corregirla — pídele que la edite desde aquí o desde el detalle en Mantenciones.');
    return;
  }
  __set_flotaEditId(reglaId||null);
  const reglasPatente=reglasFlota(flotaSelected);
  const regla=flotaEditId?reglasPatente.find(r=>r.id===flotaEditId):null;
  const d=regla||{desc:'',modo:'km',intervaloKm:'',intervaloMeses:'',ultimoKm:'',ultimaFecha:''};
  g('flota-modal-title').textContent=flotaEditId?'Editar mantención':'Agregar mantención';
  g('flota-modal-patente').textContent=flotaSelected;
  const usados=new Set(reglasPatente.filter(r=>r.id!==flotaEditId).map(r=>r.desc));
  const nombres=(lists.mantNombres||[]).filter(n=>!usados.has(n)||n===d.desc);
  g('fm-desc').innerHTML=nombres.length?nombres.map(n=>`<option value="${escapeHtml(n)}" ${n===d.desc?'selected':''}>${escapeHtml(n)}</option>`).join(''):'<option value="">Agrega nombres en Listas primero</option>';
  g('fm-km-intervalo').value=d.intervaloKm||'';
  g('fm-km-ultimo').value=d.ultimoKm||'';
  g('fm-meses-intervalo').value=d.intervaloMeses||'';
  g('fm-meses-ultima').value=d.ultimaFecha||'';
  g('flota-btn-eliminar').style.display=(flotaEditId&&isAdminUser())?'inline-flex':'none';
  toggleFlotaModoCampos();
  g('modal-flota').style.display='flex';
}
export function cerrarModalFlota(){g('modal-flota').style.display='none';__set_flotaEditId(null);}
export function toggleFlotaModoCampos(){
  const nombre=g('fm-desc').value;
  const params=MANT_PARAMS[nombre];
  const modo=params?params.modo:'km';
  const admin=isAdminUser();
  g('fm-modo').value=modo;
  g('fm-campos-km').style.display=modo==='km'?'block':'none';
  g('fm-campos-meses').style.display=modo==='tiempo'?'block':'none';
  /* El campo se bloquea para operarios (el intervalo es un parámetro fijo
     de la empresa), pero un admin sí puede corregirlo manualmente aquí si
     de verdad hace falta cambiar la política para esa patente. */
  g('fm-km-intervalo').disabled=!!params&&!admin;
  g('fm-meses-intervalo').disabled=!!params&&!admin;
  if(params&&!(flotaEditId&&admin)){
    /* Al crear una regla nueva, o si no es admin, se precarga el valor
       oficial. Si es admin editando una regla existente, se respeta lo
       que ya esté guardado (que pudo haber sido ajustado antes). */
    if(modo==='km')g('fm-km-intervalo').value=params.intervaloKm;
    else g('fm-meses-intervalo').value=params.intervaloMeses;
  }
  g('fm-fijo-nota').style.display=(params&&!admin)?'block':'none';
  g('fm-fijo-nota').textContent=admin&&params?'Parámetro oficial de la empresa — como administrador puedes ajustarlo aquí si es necesario.':'El intervalo es un parámetro fijo de la empresa y no se puede modificar aquí.';
  if(admin&&params)g('fm-fijo-nota').style.display='block';
}
export async function guardarReglaFlota(){
  const desc=g('fm-desc').value.trim();
  if(!desc){alert('Agrega al menos un nombre de mantención en Listas primero.');return;}
  /* Defensa en profundidad: si es edición de una regla ya guardada, solo
     admin puede continuar (la UI ya no debería dejar llegar hasta acá, pero
     se valida también aquí por si el modal quedó abierto de antes). Las
     mantenciones NUEVAS ya no se crean desde Estado de Flota — solo desde
     "Ingreso de mantención" en la pantalla Mantenciones. */
  if(!flotaEditId){alert('Las mantenciones nuevas se registran desde Mantenciones → Ingreso de mantención.');return;}
  if(flotaEditId&&!isAdminUser()){alert('Solo un administrador puede corregir una mantención ya registrada.');return;}
  const params=MANT_PARAMS[desc];
  const modo=params?params.modo:g('fm-modo').value;
  if(!params&&modo==='km'&&!parseInt(g('fm-km-intervalo').value)){alert('Ingresa cada cuántos kilómetros se hace esta mantención.');return;}
  if(!params&&modo==='tiempo'&&(!parseInt(g('fm-meses-intervalo').value)||!g('fm-meses-ultima').value)){alert('Ingresa el intervalo en meses y la fecha del último cambio.');return;}
  const kmIngresado=parseInt(g('fm-km-ultimo').value)||0;
  if(modo==='km'&&!kmIngresado){
    /* Igual que en el formulario de operario: no asumir 0 km en silencio si
       el auto ya tiene kilometraje registrado, para no marcar la mantención
       como vencida apenas se guarda. */
    const kmA=kmActualVeh(flotaSelected);
    if(kmA!==null&&kmA>0){
      alert('Falta indicar "KM del último cambio". El vehículo ya registra '+kmA.toLocaleString('es-CL')+' km — ingresa ese valor (o el km exacto del cambio) para que el semáforo calcule bien la vigencia.');
      return;
    }
  }
  const reglas=reglasFlota(flotaSelected);
  const ahora=new Date().toISOString();
  const admin=isAdminUser();
  /* El intervalo sale de MANT_PARAMS por defecto (nunca del input) para que
     un operario no pueda cambiarlo por error. Un admin SÍ puede editarlo
     manualmente desde este modal — en ese caso se respeta lo que escribió. */
  const intervaloKm=(params&&!admin)?(params.modo==='km'?params.intervaloKm:0):(parseInt(g('fm-km-intervalo').value)||0);
  const intervaloMeses=(params&&!admin)?(params.modo==='tiempo'?params.intervaloMeses:0):(parseInt(g('fm-meses-intervalo').value)||0);
  const datos={
    desc,modo,
    intervaloKm,ultimoKm:kmIngresado,intervaloMeses,
    ultimaFecha:g('fm-meses-ultima').value||'',
    editadoPor:currentUserName(),
    editadoEn:ahora
  };
  if(flotaEditId){
    const idx=reglas.findIndex(r=>r.id===flotaEditId);
    if(idx>-1)reglas[idx]={...reglas[idx],...datos};
  }else{
    reglas.push({id:'fm_'+Date.now(),...datos,documentos:[],creadoPor:currentUserName(),creadoEn:ahora});
  }
  const ok=await dbUpsertVehiculo(flotaSelected);
  if(!ok)return;
  cerrarModalFlota();
  renderEstadoFlota();
}
export async function eliminarReglaFlota(reglaId){
  if(!isAdminUser()){alert('Solo un administrador puede eliminar una mantención.');return;}
  if(!confirm('¿Eliminar esta mantención programada?'))return;
  const vd=ensureVehData(flotaSelected);
  const prevReglas=vd.reglasMant.slice();
  vd.reglasMant=(vd.reglasMant||[]).filter(r=>r.id!==reglaId);
  const ok=await dbUpsertVehiculo(flotaSelected);
  if(!ok){vd.reglasMant=prevReglas;return;}
  cerrarModalFlota();
  renderEstadoFlota();
}
export function exportEstadoFlotaPDF(){
  alert('Próximamente: descarga en PDF del estado de flota completo.');
}
export function renderMantenciones(){
  const chipsEl=g('mant-chips');
  if(!lists.vehiculos.length){
    chipsEl.innerHTML=addPatenteChipBtn('mant');
    g('mant-detail').innerHTML='<div class="empty-s"><p style="font-size:13px">No hay vehículos cargados.</p><p style="font-size:12px">Agrégalos en Listas → Vehículos (patentes).</p></div>';
    return;
  }
  if(!mantSelected||!lists.vehiculos.includes(mantSelected))__set_mantSelected(lists.vehiculos[0]);
  chipsEl.innerHTML=lists.vehiculos.map(p=>`<span class="patente-chip ${mantSelected===p?'sel':''}" onclick="selectPatenteMant('${p.replace(/'/g,"\\'")}')">${p}</span>`).join('')+addPatenteChipBtn('mant');
  renderMantDetail();
}
export function selectPatenteMant(p){__set_mantSelected(p);renderMantenciones();}
