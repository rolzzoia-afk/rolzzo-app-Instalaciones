import { dbUpsertRegistro, sb, sbReady } from './bootstrap.js';
import { registros, rgVals } from './core-data.js';
import { formatFecha } from './evaluaciones.js';
import { g } from './form-helpers.js';
import { FINST_CHECKLIST, FINST_ENCUESTA, finstChecklist, finstEncuesta, finstProductos } from './reporte-instalacion-catalogos.js';
import { finstFirmaBase64 } from './reporte-instalacion-firma.js';
import { finstRegistroEncontrado } from './reporte-instalacion-selector-ot.js';
import { currentUserName } from './reportes-unidad.js';

/* ===== Overlay real sobre el PDF oficial (CERTIFICADO DE CONFORMIDAD) =====
   En vez de redibujar el reporte desde cero (como hacía finstGenerarPDF en
   reporte-instalacion-pdf.js), esto carga TU plantilla PDF real
   (public/plantillas/certificado-conformidad.pdf) y dibuja encima: textos
   sobre las líneas en blanco, cuadrados negros sobre los casilleros
   marcados, la firma del cliente y la caja de auditoría digital — en las
   posiciones EXACTAS del documento, medidas directamente sobre el PDF
   (no aproximadas a ojo). Reemplaza a finstGenerarPDF(). */

const TEMPLATE_URL = '/plantillas/certificado-conformidad.pdf';
/* Todas las coordenadas de este archivo son el CENTRO real de cada casillero
   o el borde real de cada caja, medidos analizando píxel a píxel un render
   del PDF original (no a ojo): se ubicó cada casillero/caja por su contorno
   y se convirtió su centro de píxeles a puntos PDF. Los casilleros de las
   tablas (checklist, encuesta, productos) se dibujan centrados exactamente
   en esas coordenadas, sin ningún offset adicional. */
const CHECK_SIZE = 5.5;

/* ---- Coordenadas medidas sobre certificado-conformidad.pdf (unidad: pt, A4) ----
   OJO: la página del PDF real tiene un MediaBox que NO parte en (0,0) sino en
   (0, 7.83) — todo punto medido "desde abajo visualmente" en un render debe
   sumar +7.83 para convertir a la coordenada absoluta que pdf-lib necesita.
   Esa corrección ya está aplicada en cada valor de más abajo. */
const SIG = { x: 39, y: 84, w: 190, h: 32 };           // recuadro donde va la imagen de la firma (justo sobre la línea "FIRMA CLIENTE")
const RUT_BOX = { xMid: 133.75, y: 48, size: 9.5 };    // centro del recuadro "RUT CLIENTE" (caja real: x 39–228.5, y 43.8–62.8)
const AUDIT_BOX = { x: 277, top: 142.3, bottom: 49.8, w: 277.5, size: 7.3 }; // caja real de auditoría digital: x 269–562.5, y 49.8–142.3

const F1 = {
  nombre: { x: 96, y: 719.2 }, ot: { x: 368, y: 719.2 },
  telefono: { x: 96, y: 707.9 }, fechaServicio: { x: 368, y: 707.9 },
  email: { x: 96, y: 696.6 }, instalador: { x: 96, y: 685.4 },
  /* Los siguientes son el CENTRO real del casillero (no la etiqueta) */
  instalacionSi: { x: 368.9, y: 694.33 }, instalacionNo: { x: 396.1, y: 694.33 },
  fotosSi: { x: 389.6, y: 682.33 }, fotosNo: { x: 407.4, y: 682.33 }, rrssSi: { x: 459.0, y: 682.33 },
  rodapie: { x: 151.4, y: 382.58 }, guardapolvo: { x: 193.6, y: 382.58 },
  material: { x: 400, y: 383.6 },
  cortarSi: { x: 151.4, y: 370.73 }, cortarNo: { x: 176.6, y: 370.73 },
  observacion: { x: 30, y: 359.8, maxW: 375 },
  llegada: { x: 128, y: 177.8 }, salida: { x: 400, y: 177.8 },
  encargado: { x: 128, y: 166.5 }, fechaConforme: { x: 400, y: 166.5 }
};
/* Los 16 productos del catálogo, cada uno con el CENTRO real de SU casillero
   en el PDF (grilla de 4 columnas x 4 filas). */
const F1_PRODUCTOS = {
  'Blackout': { x: 31.75, y: 653.83 }, 'Dual': { x: 31.75, y: 641.83 },
  'Cortina Vertical': { x: 31.75, y: 630.08 }, 'Motor Inalámbrico': { x: 31.75, y: 618.08 },
  'Screen': { x: 167.75, y: 653.83 }, 'BeeBlack': { x: 167.75, y: 641.83 },
  'Vertical Mot.': { x: 167.75, y: 630.08 }, 'Motor Domótica': { x: 167.75, y: 618.08 },
  'Dúo Poliéster': { x: 303.63, y: 653.83 }, 'Soft Light': { x: 303.63, y: 641.83 },
  'Cenefa Ovalada': { x: 303.63, y: 630.08 }, 'Alexa / Google': { x: 303.63, y: 618.08 },
  'Dúo Blackout': { x: 439.63, y: 653.83 }, 'Dark Roller': { x: 439.63, y: 641.83 },
  'Cenefa Cuadrada': { x: 439.63, y: 630.08 }, 'Sistema Adicional': { x: 439.63, y: 618.08 }
};
const F1_CHECKLIST_ROWS_Y = [579.21, 568.21, 556.96, 545.83, 534.71, 523.46, 512.33, 501.21, 490.08, 478.96, 467.71, 456.58, 445.46, 434.33, 423.21, 411.96];
const F1_CHECKLIST_COLS_X = { SI: 505.75, NO: 531.25, NA: 556.75 };
const F1_ENCUESTA_ROWS_Y = [319.96, 308.83, 297.71, 286.46];
const F1_ENCUESTA_COLS_X = { SI: 531.25, NO: 556.75 };
const F3 = { nombre: { x: 63, y: 704.4 }, rut: { x: 432, y: 704.4 } };

async function cargarPlantilla(PDFDocument) {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error('No se pudo cargar la plantilla del certificado (' + res.status + ').');
  const bytes = await res.arrayBuffer();
  return PDFDocument.load(bytes);
}

/* Dirección de instalación → coordenadas GPS, usando el geocodificador
   público de OpenStreetMap (gratis, sin API key). Si falla o no hay
   dirección, se sigue igual sin coordenadas — no bloquea la firma. */
async function consultarNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

/* Nominatim exige coincidencia bastante exacta del nombre de calle: una
   dirección real con tipeos o con el sufijo largo del combo de región
   ("RM - Región Metropolitana") puede no devolver nada. Se reintenta con
   variantes cada vez más simples (sin región, luego solo comuna+región)
   para igual entregar coordenadas aproximadas en vez de dejarlo vacío. */
async function geocodificarDireccion(reg) {
  if (!reg) return null;
  const calle = reg.calle && reg.numero ? `${reg.calle.trim()} ${reg.numero}`.trim() : (reg.calle || '').trim();
  const comuna = (reg.comuna || '').trim();
  const region = (reg.region || '').trim().replace(/^[A-ZÁÉÍÓÚÑ]+\s*-\s*/, '');
  const intentos = [
    [calle, comuna, region].filter(Boolean).join(', '),
    [calle, comuna].filter(Boolean).join(', '),
    [comuna, region].filter(Boolean).join(', ')
  ].filter(Boolean);
  for (const query of intentos) {
    try {
      const geo = await consultarNominatim(query);
      if (geo) return geo;
    } catch (e) {
      console.error('Error geocodificando dirección:', e);
    }
  }
  return null;
}

function direccionInstalacion() {
  const reg = finstRegistroEncontrado();
  if (!reg) return '';
  const calle = reg.calle && reg.numero ? `${reg.calle.trim()} ${reg.numero}`.trim() : (reg.calle || '').trim();
  return [calle, reg.comuna, reg.region].filter(Boolean).join(', ');
}

/* Corta un texto largo en varias líneas que quepan en maxW, usando el mismo
   font ya embebido — para "Observación de instalación" (única línea larga
   en el original, pero el texto real puede ser más largo). */
function envolverTexto(font, size, text, maxW) {
  const palabras = (text || '').split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  palabras.forEach(p => {
    const prueba = actual ? actual + ' ' + p : p;
    if (font.widthOfTextAtSize(prueba, size) > maxW && actual) { lineas.push(actual); actual = p; }
    else actual = prueba;
  });
  if (actual) lineas.push(actual);
  return lineas;
}

export async function finstGenerarYGuardarPDF() {
  if (!g('finst-nombre').value.trim() || !g('finst-ot').value.trim() || !g('finst-fecha').value || !g('finst-instalador').value.trim()) {
    alert('Completa al menos Nombre, OT, Fecha e Instalador antes de generar el documento.');
    return;
  }
  if (!window.PDFLib) { alert('No se pudo cargar el generador de PDF (pdf-lib). Revisa tu conexión e intenta de nuevo.'); return; }
  const sigCliente = finstFirmaBase64('finst-firma-cliente');
  if (!sigCliente) { alert('Falta la firma del cliente antes de generar el documento.'); return; }

  const btn = g('finst-generar-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }
  try {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdfDoc = await cargarPlantilla(PDFDocument);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);
    const pages = pdfDoc.getPages();
    const [p1, p2, p3] = pages;

    const drawMark = (page, x, y) => page.drawRectangle({ x: x - CHECK_SIZE / 2, y: y - CHECK_SIZE / 2, width: CHECK_SIZE, height: CHECK_SIZE, color: black });
    const drawMarkAt = (page, xy) => xy && drawMark(page, xy.x, xy.y);
    const drawMarkCol = (page, colX, rowY) => drawMark(page, colX, rowY);
    const text = (page, str, x, y, size, bold) => { if (str) page.drawText(String(str), { x, y, size: size || 8, font: bold ? fontBold : font, color: black }); };

    /* --- Página 1 --- */
    text(p1, g('finst-nombre').value, F1.nombre.x, F1.nombre.y, 8);
    text(p1, g('finst-ot').value, F1.ot.x, F1.ot.y, 8);
    text(p1, g('finst-telefono').value, F1.telefono.x, F1.telefono.y, 8);
    text(p1, g('finst-fecha').value ? formatFecha(g('finst-fecha').value) : '', F1.fechaServicio.x, F1.fechaServicio.y, 8);
    text(p1, g('finst-email').value, F1.email.x, F1.email.y, 8);
    text(p1, g('finst-instalador').value, F1.instalador.x, F1.instalador.y, 8);
    drawMarkAt(p1, (rgVals['rg-finst-instalacion'] || 'Si') === 'Si' ? F1.instalacionSi : F1.instalacionNo);
    if (g('finst-fotos').checked) drawMarkAt(p1, F1.fotosSi); else drawMarkAt(p1, F1.fotosNo);
    if (g('finst-rrss').checked) drawMarkAt(p1, F1.rrssSi);

    Object.keys(F1_PRODUCTOS).forEach(nombre => { if (finstProductos.includes(nombre)) drawMarkAt(p1, F1_PRODUCTOS[nombre]); });

    FINST_CHECKLIST.forEach((q, i) => {
      const n = i + 1, val = finstChecklist[n], rowY = F1_CHECKLIST_ROWS_Y[i];
      if (val === 'SI') drawMarkCol(p1, F1_CHECKLIST_COLS_X.SI, rowY);
      else if (val === 'NO') drawMarkCol(p1, F1_CHECKLIST_COLS_X.NO, rowY);
      else if (val === 'NA') drawMarkCol(p1, F1_CHECKLIST_COLS_X.NA, rowY);
    });

    if (g('finst-rodapie').checked) drawMarkAt(p1, F1.rodapie);
    if (g('finst-guardapolvo').checked) drawMarkAt(p1, F1.guardapolvo);
    text(p1, g('finst-material').value, F1.material.x, F1.material.y, 8);
    drawMarkAt(p1, (rgVals['rg-finst-cortar'] || 'No') === 'Si' ? F1.cortarSi : F1.cortarNo);
    envolverTexto(font, 7.5, g('finst-observacion').value, F1.observacion.maxW).slice(0, 1)
      .forEach((linea, li) => text(p1, linea, F1.observacion.x, F1.observacion.y - li * 9, 7.5));

    FINST_ENCUESTA.forEach((q, i) => {
      const n = i + 1, val = finstEncuesta[n], rowY = F1_ENCUESTA_ROWS_Y[i];
      if (val === 'SI') drawMarkCol(p1, F1_ENCUESTA_COLS_X.SI, rowY);
      else if (val === 'NO') drawMarkCol(p1, F1_ENCUESTA_COLS_X.NO, rowY);
    });

    text(p1, g('finst-llegada').value, F1.llegada.x, F1.llegada.y, 8);
    text(p1, g('finst-salida').value, F1.salida.x, F1.salida.y, 8);
    text(p1, g('finst-encargado').value, F1.encargado.x, F1.encargado.y, 8);
    text(p1, g('finst-fecha-conforme').value ? formatFecha(g('finst-fecha-conforme').value) : '', F1.fechaConforme.x, F1.fechaConforme.y, 8);

    /* --- Página 3: declaración con nombre y RUT del cliente --- */
    const rut = (g('finst-rut-cliente') ? g('finst-rut-cliente').value : '').trim();
    text(p3, g('finst-nombre').value, F3.nombre.x, F3.nombre.y, 8.5);
    text(p3, rut, F3.rut.x, F3.rut.y, 8.5);

    /* --- Firma del cliente + caja de auditoría digital, replicada en las 3 páginas --- */
    const sigPngBytes = await fetch(sigCliente).then(r => r.arrayBuffer());
    const sigImg = await pdfDoc.embedPng(sigPngBytes);
    const direccion = direccionInstalacion();
    const geo = await geocodificarDireccion(finstRegistroEncontrado());
    const ahora = new Date();
    const fechaHoraTxt = ahora.toLocaleDateString('es-CL') + ' - ' + ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) + ' hrs';
    const direccionLineas = envolverTexto(font, AUDIT_BOX.size, `Dirección: ${direccion || '—'}`, AUDIT_BOX.w).slice(0, 2);
    /* Bloque de líneas a dibujar dentro de la caja real de auditoría (92.5pt
       de alto medidos en el PDF): cada línea declara cuánto bajar ANTES de
       dibujar la siguiente, para que el bloque completo (título + datos +
       nota final) quede siempre dentro del recuadro sin importar cuántas
       líneas ocupe la dirección. */
    const auditLineas = [
      { texto: 'AUDITORÍA DE FIRMA DIGITAL - ROLZZO', bold: true, bajarDespues: 13 },
      { texto: `Firmante: ${g('finst-nombre').value || '—'}`, bajarDespues: 9.6 },
      { texto: `RUT: ${rut || '—'}`, bajarDespues: 9.6 },
      { texto: `Fecha y hora: ${fechaHoraTxt}`, bajarDespues: 9.6 },
      ...direccionLineas.map(linea => ({ texto: linea, bajarDespues: 9.6 })),
      { texto: geo ? `Coordenadas GPS: ${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}` : 'Coordenadas GPS: no disponibles', bajarDespues: 13 },
      { texto: 'Registro inalterable con sello temporal y geolocalizado', size: 6.3 }
    ];
    [p1, p2, p3].forEach(page => {
      page.drawImage(sigImg, { x: SIG.x, y: SIG.y, width: SIG.w, height: SIG.h });
      if (rut) {
        const w = fontBold.widthOfTextAtSize(rut, RUT_BOX.size);
        page.drawText(rut, { x: RUT_BOX.xMid - w / 2, y: RUT_BOX.y, size: RUT_BOX.size, font: fontBold, color: black });
      }
      let ly = AUDIT_BOX.top - 9;
      auditLineas.forEach(linea => {
        page.drawText(linea.texto, { x: AUDIT_BOX.x, y: ly, size: linea.size || AUDIT_BOX.size, font: linea.bold ? fontBold : font, color: black });
        if (linea.bajarDespues) ly -= linea.bajarDespues;
      });
    });

    const bytesFinal = await pdfDoc.save();
    const blob = new Blob([bytesFinal], { type: 'application/pdf' });
    const ot = g('finst-ot').value.trim() || 'sin_OT';
    const nombreArchivo = `Certificado_Conformidad_OT_${ot.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    /* Descarga local */
    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlBlob; a.download = nombreArchivo; a.click();
    URL.revokeObjectURL(urlBlob);
    window._finstUltimoPdfNombre = nombreArchivo;

    /* Sube el PDF firmado como un documento adjunto más de la OT (mismo bucket
       y mismo arreglo "adjuntos" que usa "Agregar documentos a esta OT"), para
       que aparezca junto al resto de documentos: se puede ver, descargar o
       eliminar igual que cualquier otro adjunto, sin un botón especial aparte. */
    const reg = registros.find(r => (r.ot || '').toLowerCase() === ot.toLowerCase());
    if (!reg) {
      console.warn(`No existe un registro guardado con OT "${ot}": el PDF no se pudo adjuntar a ninguna OT.`);
    } else if (sbReady()) {
      const path = 'OT_' + ot.replace(/[^a-zA-Z0-9]/g, '_') + '/' + Date.now() + '_' + nombreArchivo;
      const { error } = await sb.storage.from('registro-adjuntos').upload(path, blob, { contentType: 'application/pdf' });
      if (error) {
        console.error('Error subiendo el certificado firmado:', error);
      } else {
        const nuevoAdjunto = { id: Date.now() + '_' + Math.random().toString(36).slice(2, 7), nombreArchivo, fecha: new Date().toISOString().slice(0, 10), mimeType: 'application/pdf', storagePath: path, uploadedBy: currentUserName() };
        /* Se relee 'adjuntos' desde la base justo antes de guardar, para no
           perder documentos subidos por otra persona mientras tanto. */
        let base = reg.adjuntos || [];
        try {
          const { data } = await sb.from('rolzzo_registros').select('adjuntos').eq('id', reg.id).single();
          if (data && data.adjuntos) base = data.adjuntos;
        } catch (e) { /* si falla, se sigue con lo que había en memoria */ }
        reg.adjuntos = [...base, nuevoAdjunto];
        await dbUpsertRegistro(reg);
      }
    }

    g('finst-post-pdf').style.display = 'block';
    const postPdf = g('finst-post-pdf');
    if (postPdf && typeof postPdf.scrollIntoView === 'function') postPdf.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    console.error('Error generando el certificado:', e);
    alert('No se pudo generar el certificado: ' + (e.message || 'intenta de nuevo.'));
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-file-type-pdf" aria-hidden="true"></i>Finalizar, firmar y generar PDF'; }
  }
}
