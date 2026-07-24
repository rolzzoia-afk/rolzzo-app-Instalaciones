import { MANT_PARAMS, unidades, vehiculoData } from './core-data.js';
import { calcEstadoReglaFlota } from './estado-flota.js';

/* ===== MANTENCIONES DE VEHÍCULOS ===== */
export function migrarAceiteRevisionARegla(vd){
  if(!vd.reglasMant)vd.reglasMant=[];
  if(vd.aceite&&(vd.aceite.fecha||vd.aceite.km||vd.aceite.detalle)&&!vd.reglasMant.find(r=>r.desc==='Cambio de Aceite')){
    const p=MANT_PARAMS['Cambio de Aceite'];
    vd.reglasMant.push({id:'mig_aceite_'+Date.now(),desc:'Cambio de Aceite',modo:'km',
      intervaloKm:p?p.intervaloKm:9000,ultimoKm:vd.aceite.km||'',ultimaFecha:vd.aceite.fecha||'',
      detalleTaller:vd.aceite.detalle||'',comentario:'',documentos:[]});
  }
  if(vd.revision&&(vd.revision.fecha||vd.revision.detalle)&&!vd.reglasMant.find(r=>r.desc==='Revisión Técnica')){
    const p=MANT_PARAMS['Revisión Técnica'];
    vd.reglasMant.push({id:'mig_revision_'+Date.now(),desc:'Revisión Técnica',modo:'tiempo',
      intervaloMeses:p?p.intervaloMeses:12,ultimaFecha:vd.revision.fecha||'',
      detalleTaller:vd.revision.detalle||'',comentario:'',documentos:[]});
  }
  vd.aceite={};vd.revision={};
}
export function ensureVehData(patente){
  if(!vehiculoData[patente])vehiculoData[patente]={estado:'Operativo',aceite:{},revision:{},documentos:[],detalle:'',reglasMant:[],pendientes:[],items:[]};
  if(!vehiculoData[patente].aceite)vehiculoData[patente].aceite={};
  if(!vehiculoData[patente].revision)vehiculoData[patente].revision={};
  if(!vehiculoData[patente].documentos)vehiculoData[patente].documentos=[];
  if(vehiculoData[patente].detalle===undefined)vehiculoData[patente].detalle='';
  if(!vehiculoData[patente].reglasMant)vehiculoData[patente].reglasMant=[];
  if(!vehiculoData[patente].pendientes)vehiculoData[patente].pendientes=[];
  if(!vehiculoData[patente].items)vehiculoData[patente].items=[];
  if((vehiculoData[patente].aceite.fecha||vehiculoData[patente].aceite.km||vehiculoData[patente].aceite.detalle||vehiculoData[patente].revision.fecha||vehiculoData[patente].revision.detalle)){
    migrarAceiteRevisionARegla(vehiculoData[patente]);
  }
  return vehiculoData[patente];
}
export function kmActualVeh(patente){
  const regs=unidades.filter(u=>u.patente===patente&&u.kmf);
  if(!regs.length)return null;
  return Math.max(...regs.map(u=>u.kmf||0));
}
/* estadoAceite/estadoRevision leen directamente de reglasMant (la misma
   fuente que usa Estado de Flota) para que Dashboard, Mantenciones y Estado
   de Flota siempre muestren el mismo semáforo para la misma patente — nunca
   dos números distintos para el mismo dato. */
export const CLS_SEMAFORO={verde:'alto',amarillo:'medio',rojo:'bajo'};
export function estadoAceite(patente){
  const vd=ensureVehData(patente);
  const r=(vd.reglasMant||[]).find(x=>x.desc==='Cambio de Aceite');
  if(!r)return{label:'Sin datos',cls:'sindata'};
  const est=calcEstadoReglaFlota(r,patente);
  return{label:est.vigenteTexto||est.pendiente||'—',cls:CLS_SEMAFORO[est.estado]||'sindata'};
}
export function estadoRevision(patente){
  const vd=ensureVehData(patente);
  const r=(vd.reglasMant||[]).find(x=>x.desc==='Revisión Técnica');
  if(!r)return{label:'Sin datos',cls:'sindata'};
  const est=calcEstadoReglaFlota(r,patente);
  return{label:est.vigenteTexto||est.pendiente||'—',cls:CLS_SEMAFORO[est.estado]||'sindata'};
}
