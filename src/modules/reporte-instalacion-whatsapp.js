import { g } from './form-helpers.js';

/* ===== Envío por WhatsApp (según lo definido: navegador sin backend, se usa    la API p ===== */
export function finstEnviarWhatsappCliente(){
  const nombre=g('finst-nombre').value.trim()||'Cliente';
  const ot=g('finst-ot').value.trim()||'—';
  const telRaw=(g('finst-telefono').value||'').replace(/[^0-9+]/g,'');
  if(!telRaw){alert('Ingresa el teléfono del cliente en la sección 1 para poder enviarle el mensaje.');return;}
  const msg=`Hola ${nombre}, muchas gracias por confiar en Cortinas Rolzzo. Adjunto el Reporte de Instalación y Certificado de Conformidad de tu OT ${ot}, con la guía de uso y garantía de tus cortinas. ¡Que las disfrutes!`;
  window.open(`https://wa.me/${telRaw.replace('+','')}?text=${encodeURIComponent(msg)}`,'_blank');
}
export function finstEnviarWhatsappRolzzo(){
  const nombre=g('finst-nombre').value.trim()||'—';
  const ot=g('finst-ot').value.trim()||'—';
  const instalador=g('finst-instalador').value.trim()||'—';
  const msg=`Instalación finalizada y reporte firmado.\nOT: ${ot}\nCliente: ${nombre}\nInstalador: ${instalador}\nAdjunto el PDF de respaldo (${window._finstUltimoPdfNombre||'reporte'}).`;
  window.open(`https://wa.me/56927456925?text=${encodeURIComponent(msg)}`,'_blank');
}
