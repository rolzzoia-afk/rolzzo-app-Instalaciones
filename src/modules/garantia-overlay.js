import { dbUpsertRegistro, sb, sbReady } from './bootstrap.js';
import { registros } from './core-data.js';
import { formatFecha } from './evaluaciones.js';
import { consultarNominatim, g } from './form-helpers.js';
import { GAR_PRODUCTOS, garDetalles, garProductos, garRespuestas } from './garantia.js';
import { finstFirmaBase64 } from './reporte-instalacion-firma.js';
import { envolverTexto } from './reporte-instalacion-overlay.js';
import { currentUserName } from './reportes-unidad.js';

/* ===== Overlay real sobre "Informe de Garantía/Instalación" (mismo enfoque
   que reporte-instalacion-overlay.js: carga la plantilla PDF real
   (public/plantillas/informe-garantia.pdf) y dibuja encima, en las
   coordenadas medidas directamente sobre ese PDF). ===== */
const TEMPLATE_URL = '/plantillas/informe-garantia.pdf';
const CHECK_SIZE = 6;

/* Centro real de cada casillero "Tipo de garantía o instalación", en el
   MISMO orden que GAR_PRODUCTOS (ver garantia.js) — medido pixel a pixel
   sobre la plantilla. */
const CIRCLES = [
  [87.85, 644.2], [138.25, 644.2], [182.35, 644.2], [224.45, 644.2], [265.75, 644.2], [307.35, 644.2], [347.55, 644.2],
  [87.85, 629.35], [138.25, 629.35], [182.35, 629.35], [224.45, 629.35], [265.75, 629.35], [307.35, 629.35], [347.55, 629.35],
  [87.85, 613.95], [138.25, 613.95], [182.35, 613.95], [224.45, 613.95], [265.75, 613.95], [307.35, 613.95]
];
const ESPECIFIQUE = { x: 365, y: 615, maxW: 170 };
const HEADER = {
  cliente: { x: 128, y: 700 }, telefono: { x: 257, y: 700 }, comuna: { x: 348, y: 700 }, ot: { x: 480, y: 674 },
  quienRecibe: { x: 180, y: 674 }, mail: { x: 257, y: 674 }, fecha: { x: 348, y: 674 }
};
const RESUMEN_Y = [578.45, 561.6, 544.75, 531.05];
const RESUMEN_SI_X = 268, RESUMEN_NO_X = 293.3, RESUMEN_DETAIL_X = 335, RESUMEN_DETAIL_MAXW = 240;
const COMMENT = { x: 60, top: 495, bottom: 230, lineH: 15, maxW: 530 };
const SIG = { x: 100, y: 124, w: 200, h: 34 };
const AUDIT_BOX = { x: 390, top: 165, bottom: 98, w: 205, size: 6.5 };

async function cargarPlantilla(PDFDocument) {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error('No se pudo cargar la plantilla del informe de garantía (' + res.status + ').');
  const bytes = await res.arrayBuffer();
  return PDFDocument.load(bytes);
}

export async function garGenerarYGuardarPDF() {
  if (!g('gar-cliente').value.trim() || !g('gar-ot').value.trim() || !g('gar-fecha').value) {
    alert('Completa al menos Cliente, N° OT y Fecha antes de generar el documento.');
    return;
  }
  if (!window.PDFLib) { alert('No se pudo cargar el generador de PDF (pdf-lib). Revisa tu conexión e intenta de nuevo.'); return; }
  const sigCliente = finstFirmaBase64('gar-firma-cliente');
  if (!sigCliente) { alert('Falta la firma del cliente antes de generar el documento.'); return; }

  const btn = g('gar-generar-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }
  try {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdfDoc = await cargarPlantilla(PDFDocument);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);
    const page = pdfDoc.getPages()[0];

    const drawMark = (x, y) => page.drawRectangle({ x: x - CHECK_SIZE / 2, y: y - CHECK_SIZE / 2, width: CHECK_SIZE, height: CHECK_SIZE, color: black });
    const text = (str, x, y, size, bold) => { if (str) page.drawText(String(str), { x, y, size: size || 8, font: bold ? fontBold : font, color: black }); };

    /* Encabezado */
    text(g('gar-cliente').value, HEADER.cliente.x, HEADER.cliente.y, 8);
    text(g('gar-telefono').value, HEADER.telefono.x, HEADER.telefono.y, 7.5);
    text(g('gar-comuna').value, HEADER.comuna.x, HEADER.comuna.y, 8);
    text(g('gar-ot').value, HEADER.ot.x, HEADER.ot.y, 9, true);
    text(g('gar-quien-recibe').value, HEADER.quienRecibe.x, HEADER.quienRecibe.y, 7.5);
    text(g('gar-mail').value, HEADER.mail.x, HEADER.mail.y, 7);
    text(g('gar-fecha').value ? formatFecha(g('gar-fecha').value) : '', HEADER.fecha.x, HEADER.fecha.y, 8);

    /* Tipo de garantía o instalación */
    GAR_PRODUCTOS.forEach((p, i) => { if (garProductos.includes(p)) drawMark(CIRCLES[i][0], CIRCLES[i][1]); });
    envolverTexto(font, 8, g('gar-especifique').value, ESPECIFIQUE.maxW).slice(0, 2)
      .forEach((linea, li) => text(linea, ESPECIFIQUE.x, ESPECIFIQUE.y - li * 10, 8));

    /* Resumen de garantía o instalación */
    RESUMEN_Y.forEach((y, i) => {
      const n = i + 1, val = garRespuestas[n];
      if (val === 'SI') drawMark(RESUMEN_SI_X, y);
      else if (val === 'NO') drawMark(RESUMEN_NO_X, y);
      envolverTexto(font, 7.5, garDetalles[n], RESUMEN_DETAIL_MAXW).slice(0, 1)
        .forEach(linea => text(linea, RESUMEN_DETAIL_X, y - 2, 7.5));
    });

    /* Comentario adicional */
    let ly = COMMENT.top;
    envolverTexto(font, 8, g('gar-comentario').value, COMMENT.maxW).forEach(linea => {
      if (ly < COMMENT.bottom) return;
      text(linea, COMMENT.x, ly, 8);
      ly -= COMMENT.lineH;
    });

    /* Firma del cliente + caja de auditoría digital */
    const sigPngBytes = await fetch(sigCliente).then(r => r.arrayBuffer());
    const sigImg = await pdfDoc.embedPng(sigPngBytes);
    page.drawImage(sigImg, { x: SIG.x, y: SIG.y, width: SIG.w, height: SIG.h });

    const comuna = g('gar-comuna').value.trim();
    const geo = comuna ? await consultarNominatim(`${comuna}, Chile`).catch(() => null) : null;
    const ahora = new Date();
    const fechaHoraTxt = ahora.toLocaleDateString('es-CL') + ' - ' + ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) + ' hrs';
    const auditLineas = [
      { texto: 'AUDITORÍA DE FIRMA DIGITAL - ROLZZO', bold: true, bajarDespues: 10 },
      { texto: `Firmante: ${g('gar-cliente').value || '—'}`, bajarDespues: 8 },
      { texto: `Fecha y hora: ${fechaHoraTxt}`, bajarDespues: 8 },
      { texto: `Comuna: ${comuna || '—'}`, bajarDespues: 8 },
      { texto: geo ? `Coordenadas GPS: ${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}` : 'Coordenadas GPS: no disponibles', bajarDespues: 9 },
      { texto: 'Registro inalterable con sello temporal y geolocalizado', size: 5.8 }
    ];
    let auditY = AUDIT_BOX.top - 8;
    auditLineas.forEach(linea => {
      page.drawText(linea.texto, { x: AUDIT_BOX.x, y: auditY, size: linea.size || AUDIT_BOX.size, font: linea.bold ? fontBold : font, color: black });
      if (linea.bajarDespues) auditY -= linea.bajarDespues;
    });

    const bytesFinal = await pdfDoc.save();
    const blob = new Blob([bytesFinal], { type: 'application/pdf' });
    const ot = g('gar-ot').value.trim() || 'sin_OT';
    const nombreArchivo = `Informe_Garantia_OT_${ot.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    /* Descarga local */
    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlBlob; a.download = nombreArchivo; a.click();
    URL.revokeObjectURL(urlBlob);

    /* Sube el PDF firmado como un documento adjunto más de la OT (mismo
       bucket y mismo arreglo "adjuntos" que usa el Formulario de instalación
       y "Agregar documentos a esta OT"), si existe una OT con ese número. */
    const reg = registros.find(r => (r.ot || '').toLowerCase() === ot.toLowerCase());
    if (!reg) {
      console.warn(`No existe un registro guardado con OT "${ot}": el PDF no se pudo adjuntar a ninguna OT.`);
    } else if (sbReady()) {
      const path = 'OT_' + ot.replace(/[^a-zA-Z0-9]/g, '_') + '/' + Date.now() + '_' + nombreArchivo;
      const { error } = await sb.storage.from('registro-adjuntos').upload(path, blob, { contentType: 'application/pdf' });
      if (error) {
        console.error('Error subiendo el informe de garantía firmado:', error);
      } else {
        const nuevoAdjunto = { id: Date.now() + '_' + Math.random().toString(36).slice(2, 7), nombreArchivo, fecha: new Date().toISOString().slice(0, 10), mimeType: 'application/pdf', storagePath: path, uploadedBy: currentUserName() };
        let base = reg.adjuntos || [];
        try {
          const { data } = await sb.from('rolzzo_registros').select('adjuntos').eq('id', reg.id).single();
          if (data && data.adjuntos) base = data.adjuntos;
        } catch (e) { /* si falla, se sigue con lo que había en memoria */ }
        reg.adjuntos = [...base, nuevoAdjunto];
        await dbUpsertRegistro(reg);
      }
    }

    const post = g('gar-post-pdf');
    if (post) { post.style.display = 'flex'; if (typeof post.scrollIntoView === 'function') post.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  } catch (e) {
    console.error('Error generando el informe de garantía:', e);
    alert('No se pudo generar el informe: ' + (e.message || 'intenta de nuevo.'));
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-file-type-pdf" aria-hidden="true"></i>Finalizar, firmar y generar PDF'; }
  }
}
