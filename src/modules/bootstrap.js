import { applyTheme } from './color-sistema.js';
import { DEFAULT_LISTS, __set_customLists, __set_lists, __set_personas, __set_registros, __set_themeColor, __set_unidades, __set_vehiculoData, customLists, lists, personas, registros, themeColor, unidades, vehiculoData } from './core-data.js';
import { __set_evaluacionesFotos, __set_evaluacionesNuevo, loadEvalFotosOT } from './evaluaciones.js';
import { initRgValsDefaults, populateForms } from './form-helpers.js';
import { pinInputs, tocarActividadSesion, tryRestoreSession } from './login.js';
import { ensureVehData } from './mantenciones-vehiculos.js';
import { guardar } from './registro-adjuntos.js';

/* ===== STORAGE ===== */
export const GOOGLE_REVIEW_LINK='https://share.google/hmXEUG6OXGw9U6JjE';
export const SUPABASE_URL='https://dcbsdwqkmeepxuvaykxb.supabase.co';
export const SUPABASE_KEY='sb_publishable_Aq1EklkdGz81FdUDtJEsUw_k8PeTXNk';
export let sb=null;
try{
  if(window.supabase&&window.supabase.createClient){
    sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  }else{
    console.error('La librería de Supabase no cargó (posible bloqueo de red). La app funcionará sin guardar datos.');
  }
}catch(e){console.error('No se pudo inicializar Supabase:',e);}
export function sbReady(){
  if(!sb){alert('No se pudo conectar con la base de datos (revisa tu conexión a internet). Los datos no se guardarán hasta que se restablezca.');return false;}
  return true;
}

/* ---------- GUARDADO PUNTUAL (por fila) ----------
   Las tablas de uso diario (registros, unidades, evaluaciones) se guardan
   fila por fila con upsert/delete. Así, lo que guarda un usuario nunca
   borra lo que guardó otro, aunque ambos tengan la app abierta. */
export function dbError(ctx,e){
  console.error('Error en '+ctx+':',e);
  const detalle=(e&&(e.message||e.error_description||e.hint||e.details))||(typeof e==='string'?e:'')||'Error desconocido';
  alert('No se pudo guardar en la base de datos ('+ctx+').\n\nDetalle: '+detalle+'\n\nRevisa tu conexión e inténtalo de nuevo.');
}
export function rowRegistro(r){return{
  id:r.id,fecha:r.fecha||null,mes:r.mes,tipo:r.tipo,ot:r.ot,cliente:r.cliente,
  tec1:r.tec1,tec2:r.tec2,tec3:r.tec3,tec4:r.tec4,tecnicos_extra:r.tecnicosExtra||[],
  hinicio:r.hinicio,hsalida:r.hsalida,dur_min:r.durMin,
  traslado:r.traslado,tipo_cortina:r.tipoCortina,cantidad:r.cantidad,productos:r.productos||[],
  adicional:r.adicional,tipo_gar:r.tipoGar,extras:r.extras||[],
  nivel_dif:r.nivelDif||'',
  material:r.material,materiales:r.materiales||[],anclaje:r.anclaje,ubicacion:r.ubicacion,cod_motor:r.codMotor,
  calle:r.calle,numero:r.numero,region:r.region||null,comuna:r.comuna,
  google:r.google,video:r.video,danos:r.danos,comentario_seguimiento:r.comentarioSeguimiento||'',
  problema:r.problema,solucion:r.solucion,que_sol:r.queSol,comentario:r.comentario,
  adjuntos:r.adjuntos||[],fotografos:r.fotografos||[],
  giftcard:r.giftcard||'No',giftcard_codigo:r.giftcardCodigo||'',giftcard_descuento:r.giftcardDescuento??null,
  creado_por:r.creadoPor||null
};}
export async function dbUpsertRegistro(r){
  if(!sbReady())return false;
  try{const{error}=await sb.from('rolzzo_registros').upsert([rowRegistro(r)]);if(error)throw error;return true;}
  catch(e){dbError('registro OT',e);return false;}
}
export async function dbDeleteRegistro(id){
  if(!sbReady())return;
  try{const{error}=await sb.from('rolzzo_registros').delete().eq('id',id);if(error)throw error;}
  catch(e){dbError('eliminar registro',e);}
}
export function rowUnidad(u){return{
  id:u.id,fecha:u.fecha||null,mes:u.mes,conductor:u.conductor,patente:u.patente,
  kmi:u.kmi,kmf:u.kmf,total:u.total,comb:u.comb,recarga:u.recarga,monto:u.monto,pago:u.pago,
  i1:u.i1,i2:u.i2,i3:u.i3,i4:u.i4,
  creado_por:u.creadoPor||null,foto_path:u.fotoPath||null,
  foto_kmi_path:u.fotoKmiPath||null,foto_kmf_path:u.fotoKmfPath||null
};}
export async function dbUpsertUnidad(u){
  if(!sbReady())return false;
  try{const{error}=await sb.from('rolzzo_unidades').upsert([rowUnidad(u)]);if(error)throw error;return true;}
  catch(e){dbError('registro de unidad',e);return false;}
}
export async function dbDeleteUnidad(id){
  if(!sbReady())return;
  try{const{error}=await sb.from('rolzzo_unidades').delete().eq('id',id);if(error)throw error;}
  catch(e){dbError('eliminar unidad',e);}
}
export function rowEvalFoto(e){return{
  id:String(e.id),ot:e.ot,persona:e.persona,fecha:e.fecha||null,mes:e.mes,nivel:e.nivel
};}
export async function dbUpsertEvalFoto(e){
  if(!sbReady())return;
  try{const{error}=await sb.from('rolzzo_eval_fotos').upsert([rowEvalFoto(e)]);if(error)throw error;}
  catch(err){dbError('evaluación de fotos',err);}
}
export async function dbDeleteEvalFoto(id){
  if(!sbReady())return;
  try{const{error}=await sb.from('rolzzo_eval_fotos').delete().eq('id',String(id));if(error)throw error;}
  catch(e){dbError('eliminar evaluación de fotos',e);}
}
export function rowVehiculo(patente){
  const vd=ensureVehData(patente);
  return{patente,estado:vd.estado||'Operativo',aceite:vd.aceite||{},revision:vd.revision||{},
    items:vd.items||[],reglas_mant:vd.reglasMant||[]};
}
/* Guardado puntual para un vehículo (incluye sus reglas de mantención y los
   documentos propios de cada regla, que viven dentro de reglas_mant). Antes
   esto solo se guardaba dentro de saveAll() borrando y reinsertando TODA la
   tabla rolzzo_vehiculos, lo que podía perder cambios recientes de otro
   vehículo o de otro usuario si ambos guardaban casi al mismo tiempo. */
export async function dbUpsertVehiculo(patente){
  if(!sbReady())return false;
  try{const{error}=await sb.from('rolzzo_vehiculos').upsert([rowVehiculo(patente)],{onConflict:'patente'});if(error)throw error;return true;}
  catch(e){dbError('datos del vehículo',e);return false;}
}
export async function dbDeleteVehiculo(patente){
  if(!sbReady())return false;
  try{const{error}=await sb.from('rolzzo_vehiculos').delete().eq('patente',patente);if(error)throw error;return true;}
  catch(e){dbError('eliminar vehículo',e);return false;}
}
export function rowDocumentoVehiculo(d,patente){return{
  id:String(d.id),patente,tipo:d.tipo,nombre_archivo:d.nombreArchivo,
  fecha:d.fecha||null,mime_type:d.mimeType,storage_path:d.storagePath||null,
  creado_por:d.creadoPor||null,subido_por:d.subidoPor||d.creadoPor||null,subido_en:d.subidoEn||null
};}
/* Guardado puntual (upsert fila por fila) para documentos de vehículo.
   Reemplaza el patrón anterior de "borrar toda la tabla y reinsertar todo
   lo que hay en memoria" dentro de saveAll(), que hacía que un usuario
   pudiera pisar/perder los documentos que otro acababa de subir. */
export async function dbUpsertDocumentoVehiculo(d,patente){
  if(!sbReady())return false;
  try{
    const{error}=await sb.from('rolzzo_vehiculo_documentos').upsert([rowDocumentoVehiculo(d,patente)]);
    if(error){
      /* Si la tabla en Supabase todavía no tiene las columnas subido_por /
         subido_en (proyecto antiguo sin esa migración), no se pierde el
         documento: se reintenta sin esos dos campos. */
      const msg=(error.message||'').toLowerCase();
      if(msg.includes('subido_por')||msg.includes('subido_en')||msg.includes('column')){
        const fallback=rowDocumentoVehiculo(d,patente);
        delete fallback.subido_por;delete fallback.subido_en;
        const r2=await sb.from('rolzzo_vehiculo_documentos').upsert([fallback]);
        if(r2.error)throw r2.error;
        return true;
      }
      throw error;
    }
    return true;
  }catch(e){dbError('documento de vehículo',e);return false;}
}
export async function dbDeleteDocumentoVehiculo(id){
  if(!sbReady())return false;
  try{const{error}=await sb.from('rolzzo_vehiculo_documentos').delete().eq('id',String(id));if(error)throw error;return true;}
  catch(e){dbError('eliminar documento de vehículo',e);return false;}
}
export function rowEvalNuevo(d){return{
  id:String(d.id),persona:d.persona,fecha:d.fecha||null,mes:d.mes,semana:d.semana||null,dia:d.dia,
  cats:d.cats||{},cortinas:d.cortinas,tiempo:d.tiempo,obs:d.obs
};}
export async function dbUpsertEvalNuevo(d){
  if(!sbReady())return;
  try{const{error}=await sb.from('rolzzo_eval_nuevo').upsert([rowEvalNuevo(d)]);if(error)throw error;}
  catch(e){dbError('evaluación personal nuevo',e);}
}
export async function dbUpsertEvalNuevoMany(rows){
  if(!sbReady())return;
  try{const{error}=await sb.from('rolzzo_eval_nuevo').upsert(rows.map(rowEvalNuevo));if(error)throw error;}
  catch(e){dbError('semana de evaluación',e);}
}
export async function dbDeleteEvalNuevo(id){
  if(!sbReady())return;
  try{const{error}=await sb.from('rolzzo_eval_nuevo').delete().eq('id',String(id));if(error)throw error;}
  catch(e){dbError('eliminar evaluación diaria',e);}
}
export async function dbDeleteEvalNuevoIds(ids){
  if(!sbReady()||!ids.length)return;
  try{const{error}=await sb.from('rolzzo_eval_nuevo').delete().in('id',ids.map(String));if(error)throw error;}
  catch(e){dbError('eliminar semana de evaluación',e);}
}

export async function saveAll(){
  if(!sbReady())return false;
  try{
    let r;
    r=await sb.from('rolzzo_personas').delete().neq('codigo','__none__');if(r.error)throw r.error;
    if(personas.length){
      r=await sb.from('rolzzo_personas').insert(personas.map(p=>({
        codigo:p.codigo,nombre:p.nombre,rut:p.rut||null,rol:p.rol,
        es_nuevo:!!p.esNuevo,dias_prueba:p.diasPrueba||null,fecha_ingreso:p.fechaIngreso||null,
        permisos:p.permisos||['regnew','regrep','dash','unireg','unimant','unirep'],induccion:p.induccion||{}
      })));
      if(r.error)throw r.error;
    }

    /* rolzzo_registros, rolzzo_unidades, rolzzo_eval_fotos y rolzzo_eval_nuevo
       ya NO se guardan aquí: usan guardado puntual por fila (funciones dbUpsert / dbDelete)
       para que un usuario no pise los datos de otro. */

    r=await sb.from('rolzzo_listas').delete().neq('clave','__none__');if(r.error)throw r.error;
    const listasRows=[];
    Object.keys(lists).forEach(k=>listasRows.push({clave:k,es_core:true,items:lists[k]}));
    Object.keys(customLists).forEach(k=>listasRows.push({clave:k,etiqueta:customLists[k].label,icono:customLists[k].icon,es_core:false,items:customLists[k].items}));
    if(listasRows.length){r=await sb.from('rolzzo_listas').insert(listasRows);if(r.error)throw r.error;}

    /* rolzzo_vehiculos ya NO se guarda aquí en bloque: cada vehículo se
       guarda puntualmente con dbUpsertVehiculo() al crear/editar reglas de
       mantención, cambiar estado, etc. — igual que registros y unidades. */

    /* rolzzo_vehiculo_documentos ya NO se guarda aquí en bloque (borrar+reinsertar
       todo perdía adjuntos subidos por otros usuarios mientras tanto): cada
       documento se guarda puntualmente con dbUpsertDocumentoVehiculo / se
       borra con dbDeleteDocumentoVehiculo, igual que registros y unidades. */

    r=await sb.from('rolzzo_config').upsert([{clave:'theme_color',valor:themeColor}]);if(r.error)throw r.error;
    return true;
  }catch(e){dbError('personas / listas / vehículos',e);return false;}
}
export async function loadAll(){
  try{
    const{data}=await sb.from('rolzzo_personas').select('*');
    if(data&&data.length){
      __set_personas(data.map(p=>({
        nombre:p.nombre,rut:p.rut||'',codigo:p.codigo,rol:p.rol,
        esNuevo:p.es_nuevo,diasPrueba:p.dias_prueba,fechaIngreso:p.fecha_ingreso,
        permisos:p.permisos||['regnew','regrep','dash','unireg','unimant','unirep'],induccion:p.induccion||{}
      })));
    }
  }catch(e){console.error('Error cargando personas:',e);}

  try{
    const{data}=await sb.from('rolzzo_registros').select('*');
    if(data)__set_registros(data.map(r=>({
      id:r.id,fecha:r.fecha,mes:r.mes,tipo:r.tipo,ot:r.ot,cliente:r.cliente,
      tec1:r.tec1,tec2:r.tec2,tec3:r.tec3,tec4:r.tec4,tecnicosExtra:r.tecnicos_extra||[],
      hinicio:r.hinicio,hsalida:r.hsalida,durMin:r.dur_min,
      traslado:r.traslado,tipoCortina:r.tipo_cortina,cantidad:r.cantidad,productos:r.productos||[],
      adicional:r.adicional,tipoGar:r.tipo_gar,extras:r.extras||[],
      nivelDif:r.nivel_dif||'',
      material:r.material,materiales:r.materiales||[],anclaje:r.anclaje,ubicacion:r.ubicacion,codMotor:r.cod_motor,
      calle:r.calle,numero:r.numero,region:r.region,comuna:r.comuna,
      google:r.google,video:r.video,danos:r.danos,comentarioSeguimiento:r.comentario_seguimiento||'',
      problema:r.problema,solucion:r.solucion,queSol:r.que_sol,comentario:r.comentario,
      adjuntos:r.adjuntos||[],fotografos:r.fotografos||[],
      giftcard:r.giftcard||'No',giftcardCodigo:r.giftcard_codigo||'',giftcardDescuento:r.giftcard_descuento??null,
      creadoPor:r.creado_por
    })));
  }catch(e){console.error('Error cargando registros:',e);}

  try{
    const{data}=await sb.from('rolzzo_unidades').select('*');
    if(data)__set_unidades(data.map(u=>({
      id:u.id,fecha:u.fecha,mes:u.mes,conductor:u.conductor,patente:u.patente,
      kmi:u.kmi,kmf:u.kmf,total:u.total,comb:u.comb,recarga:u.recarga,monto:u.monto,pago:u.pago,
      i1:u.i1,i2:u.i2,i3:u.i3,i4:u.i4,
      creadoPor:u.creado_por,fotoPath:u.foto_path,fotoKmiPath:u.foto_kmi_path,fotoKmfPath:u.foto_kmf_path
    })));
  }catch(e){console.error('Error cargando unidades:',e);}

  try{
    const{data}=await sb.from('rolzzo_listas').select('*');
    if(data&&data.length){
      const newLists={...DEFAULT_LISTS};
      const newCustom={};
      data.forEach(row=>{
        if(row.es_core){newLists[row.clave]=row.items||[];}
        else{newCustom[row.clave]={label:row.etiqueta,icon:row.icono||'ti-tag',items:row.items||[]};}
      });
      __set_lists(newLists);__set_customLists(newCustom);
    }
  }catch(e){console.error('Error cargando listas:',e);}

  try{
    const{data}=await sb.from('rolzzo_eval_fotos').select('*');
    if(data)__set_evaluacionesFotos(data.map(e=>({id:e.id,ot:e.ot,persona:e.persona,fecha:e.fecha,mes:e.mes,nivel:e.nivel})));
  }catch(e){console.error('Error cargando eval fotos:',e);}

  try{
    const{data}=await sb.from('rolzzo_eval_nuevo').select('*');
    if(data)__set_evaluacionesNuevo(data.map(d=>({id:d.id,persona:d.persona,fecha:d.fecha,mes:d.mes,semana:d.semana,dia:d.dia,cats:d.cats||{},cortinas:d.cortinas,tiempo:d.tiempo,obs:d.obs})));
  }catch(e){console.error('Error cargando eval nuevo:',e);}

  await loadEvalFotosOT();

  try{
    const{data:vData}=await sb.from('rolzzo_vehiculos').select('*');
    const{data:vdocData}=await sb.from('rolzzo_vehiculo_documentos').select('*');
    if(vData){
      __set_vehiculoData({});
      vData.forEach(v=>{
        vehiculoData[v.patente]={estado:v.estado,aceite:v.aceite||{},revision:v.revision||{},items:v.items||[],documentos:[],reglasMant:v.reglas_mant||[]};
      });
      (vdocData||[]).forEach(d=>{
        if(vehiculoData[d.patente]){
          vehiculoData[d.patente].documentos.push({id:d.id,tipo:d.tipo,nombreArchivo:d.nombre_archivo,fecha:d.fecha,mimeType:d.mime_type,storagePath:d.storage_path,creadoPor:d.creado_por,subidoPor:d.subido_por||d.creado_por,subidoEn:d.subido_en});
        }
      });
    }
  }catch(e){console.error('Error cargando vehículos:',e);}

  try{
    const{data}=await sb.from('rolzzo_config').select('*').eq('clave','theme_color').maybeSingle();
    if(data&&data.valor)__set_themeColor(data.valor);
  }catch(e){console.error('Error cargando config:',e);}
}

document.addEventListener('input',function(e){
  const el=e.target;
  if(el.tagName==='TEXTAREA'||(el.tagName==='INPUT'&&el.type==='text')){
    const pos=el.selectionStart,posEnd=el.selectionEnd;
    const upper=el.value.toUpperCase();
    if(upper!==el.value){
      el.value=upper;
      if(pos!==null)el.setSelectionRange(pos,posEnd);
    }
  }
});

/* Marca actividad reciente para el control de inactividad de la sesión.
   Se registra en cualquier click/tecla/touch, con un pequeño throttling
   para no escribir en localStorage constantemente. */
export let ultimoRegistroActividad=0;
['click','keydown','touchstart'].forEach(evt=>{
  document.addEventListener(evt,()=>{
    const ahora=Date.now();
    if(ahora-ultimoRegistroActividad>10000){
      ultimoRegistroActividad=ahora;
      tocarActividadSesion();
    }
  },{passive:true});
});

loadAll().then(()=>{
  initRgValsDefaults();
  applyTheme(themeColor);
  populateForms();
  const restored=tryRestoreSession();
  if(!restored){
    document.getElementById('login-screen').style.display='flex';
    pinInputs[0].focus();
  }
  const boot=document.getElementById('boot-loading');
  if(boot)boot.remove();
}).catch(()=>{
  // Si algo falla al cargar, igual mostramos el login para no dejar
  // al usuario mirando la pantalla de carga para siempre.
  document.getElementById('login-screen').style.display='flex';
  pinInputs[0].focus();
  const boot=document.getElementById('boot-loading');
  if(boot)boot.remove();
});
