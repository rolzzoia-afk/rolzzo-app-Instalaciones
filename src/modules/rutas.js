import { dbUpsertRuta } from './bootstrap.js';
import { __set_rutas, rutas } from './core-data.js';
import { pdfCheckPageBreak, pdfDrawHeader, pdfDrawTitleBlock } from './evaluaciones-pdf.js';
import { safeId } from './evaluaciones.js';
import { consultarNominatim, g, tecnicosList } from './form-helpers.js';
import { showToast } from './registro-adjuntos.js';
import { currentUserName } from './reportes-unidad.js';

/* ===== RUTAS: creador de rutas optimizadas para equipos técnicos =====
   Geocodifica direcciones con Nominatim/OSM (mismo servicio gratuito ya
   usado para el certificado de conformidad) y arma la ruta de cada equipo
   en dos pasos:
   1) Reparto por sector (agruparPorCercania): agrupa las direcciones que
      están cerca entre sí en el mismo equipo -para no mandar a dos equipos
      distintos al mismo barrio- procurando además que a cada equipo le
      toque una cantidad pareja de direcciones; el sector solo se rompe si
      es la única forma de terminar de repartir.
   2) Orden de visita (ordenarGrupoPorLejania): dentro de cada equipo, la
      bodega NO se usa como punto simétrico de ida y vuelta para que OSRM
      "decida" el orden. En cambio, se consulta a OSRM la distancia real de
      manejo desde la bodega a cada parada del equipo, se ordenan de la más
      lejana a la más cercana, y ese orden queda fijo: el equipo arranca en
      la parada más lejana y se va acercando a la bodega en cada parada,
      terminando el día cerca de casa. La distancia/duración que se muestra
      es la real de OSRM para ese orden ya fijado. Todo queda en memoria
      hasta guardar. */

export let rutaOrigen = {
  direccion: localStorage.getItem('rutaOrigenDir') || 'Segunda Avenida 1562, San Miguel, Región Metropolitana',
  lat: null, lon: null
};
export let direccionesRuta = []; // [{id, texto, lat, lon}]
export let equiposCount = 2;
export let gruposRuta = []; // [{operadores:[], paradas:[{texto,lat,lon}], distanciaM, duracionS}]
export let equipoActivo = 0; // índice del equipo seleccionado para "pintarle" operadores
let calculando = false;
let rutaMapaDataUrl = null;

/* Colores por equipo: los determina el sistema (no son editables) y se
   ciclan si hay más equipos que colores en la paleta. El mismo color se usa
   en el marcador del mapa, el borde de la tarjeta del equipo, la pastilla
   del operador asignado y el encabezado de su columna en el PDF, para que
   se reconozca de un vistazo en todos lados. */
export const RUTA_COLORES = ['#0B7285', '#eda100', '#4F46E5', '#E65100', '#7A1F2E', '#1E6B3D', '#C2427A', '#6B4AA7'];
function colorGrupo(i){ return RUTA_COLORES[i % RUTA_COLORES.length]; }
function hexToRgb(hex){
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* Un equipo se considera "calculado" cuando ya tiene paradas asignadas
   (viene de correr calcularRutas). Antes de eso, gruposRuta igual existe
   -uno por cada equipo del contador- para que se puedan elegir los
   operadores de cada equipo apenas se entra a la pestaña, sin esperar a
   calcular la ruta. */
function rutaFueCalculada(){ return gruposRuta.some(grp => (grp.paradas || []).length > 0); }

/* Mantiene gruposRuta con exactamente equiposCount elementos, conservando
   los operadores (y la ruta, si ya se calculó) de los equipos que sigan
   existiendo. Se llama al entrar a la pestaña y cada vez que cambia la
   cantidad de equipos. */
function syncGruposConEquiposCount(){
  const nuevo = [];
  for(let i = 0; i < equiposCount; i++) nuevo.push(gruposRuta[i] || { operadores: [], paradas: [] });
  gruposRuta = nuevo;
  if(equipoActivo >= equiposCount) equipoActivo = 0;
}

export function renderRutasPane(){
  const oi = g('rutas-origen');
  if(oi) oi.value = rutaOrigen.direccion;
  const ei = g('rutas-equipos');
  if(ei) ei.value = equiposCount;
  renderDireccionesRuta();
  syncGruposConEquiposCount();
  renderOperadoresRuta();
  renderGruposRuta();
  renderMapaRuta();
  mostrarResultado(rutaFueCalculada());
  renderHistorialRutas();
  const det = g('rutas-hist-detalle');
  if(det) det.innerHTML = '';
}

function mostrarResultado(show){
  const wrap = g('rutas-resultado-wrap');
  if(wrap) wrap.style.display = show ? '' : 'none';
}

export function setRutaOrigen(v){
  rutaOrigen.direccion = (v || '').trim();
  rutaOrigen.lat = null; rutaOrigen.lon = null;
  localStorage.setItem('rutaOrigenDir', rutaOrigen.direccion);
}

export function setEquiposCount(v){
  equiposCount = Math.max(1, parseInt(v, 10) || 1);
  syncGruposConEquiposCount();
  renderGruposRuta();
  renderOperadoresRuta();
  renderDireccionesRuta();
}

export function addDireccionRuta(){
  const inp = g('rutas-dir-input');
  const texto = (inp && inp.value || '').trim();
  if(!texto) return;
  const d = { id: 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), texto, lat: null, lon: null, estado: 'verificando', equipoFijo: null, prioridad: false };
  direccionesRuta.push(d);
  if(inp) inp.value = '';
  renderDireccionesRuta();
  verificarDireccionRuta(d.id);
}

export function removeDireccionRuta(id){
  direccionesRuta = direccionesRuta.filter(d => d.id !== id);
  renderDireccionesRuta();
}

/* Fija a mano a qué equipo va una dirección (o la vuelve a dejar en
   "Auto" con valor ''). Esta elección manual siempre gana por sobre el
   reparto automático por cercanía al calcular la ruta -ver remapGruposFijos
   más abajo-, aunque geográficamente esa dirección le quedara mejor a otro
   equipo. */
export function setDireccionEquipo(id, valor){
  const d = direccionesRuta.find(x => x.id === id);
  if(!d) return;
  d.equipoFijo = valor === '' || valor == null ? null : parseInt(valor, 10);
  renderDireccionesRuta();
}

/* Marca/desmarca una dirección como prioritaria: dentro de su equipo, las
   direcciones prioritarias se visitan primero, antes que el orden normal de
   más lejana a más cercana a la bodega. */
export function toggleDireccionPrioridad(id){
  const d = direccionesRuta.find(x => x.id === id);
  if(!d) return;
  d.prioridad = !d.prioridad;
  renderDireccionesRuta();
}

/* Nominatim con addressdetails=1: además de lat/lon, arma una versión
   "limpia" de la dirección (calle+número, comuna, región) a partir de los
   componentes que Nominatim reconoció — sirve como sugerencia/corrección
   cuando lo que la persona escribió no calzaba exacto. */
async function geocodificarConDetalle(query){
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=cl&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
  if(!res.ok) return null;
  const data = await res.json();
  if(!data || !data.length) return null;
  const d = data[0];
  const a = d.address || {};
  const calle = a.road || a.pedestrian || a.footway || '';
  const numero = a.house_number || '';
  const comuna = a.suburb || a.city_district || a.town || a.city || a.village || '';
  const region = a.state || '';
  const limpio = [[calle, numero].filter(Boolean).join(' '), comuna, region].filter(Boolean).join(', ');
  return { lat: parseFloat(d.lat), lon: parseFloat(d.lon), limpio: limpio || d.display_name };
}

/* Cuando ni el texto tal cual ni los recortes por coma encontraron nada
   (por ejemplo, direcciones sin comas o con la calle mal escrita), se
   intenta una búsqueda más laxa recortando palabra por palabra desde el
   final. El resultado NO se aplica solo -queda guardado como "sugerencia"
   para que la persona confirme el cambio con un toque, ya que acá la
   confianza es menor que el recorte por coma (se están sacando palabras
   sueltas, no un segmento completo como la región). */
async function buscarSugerenciaDireccion(texto){
  const palabras = texto.split(/\s+/).filter(Boolean);
  for(let n = palabras.length - 1; n >= 2; n--){
    const geo = await geocodificarConDetalle(palabras.slice(0, n).join(' ') + ', Chile');
    if(geo) return geo;
  }
  return null;
}

/* Verifica una dirección apenas se agrega: si Nominatim la encuentra tal
   cual, queda con check verde. Si no, prueba variantes más simples y, si
   alguna funciona, autocorrige el texto a la versión que sí encontró
   (marcada como "corregida"). Si ninguna variante encuentra nada, queda en
   rojo con una sugerencia ("¿Quisiste decir...?") para que la persona la
   confirme o la revise a mano. */
export async function verificarDireccionRuta(id){
  const d = direccionesRuta.find(x => x.id === id);
  if(!d) return;
  d.estado = 'verificando';
  d.sugerencia = null;
  renderDireccionesRuta();
  const original = d.texto.trim();

  /* Intento 1: la dirección tal cual la escribieron. Si Nominatim la
     encuentra así, está "bien escrita" — no se toca el texto, solo check
     verde. Recién si ESTO falla se prueban variantes más simples (recortando
     el final, por si sobra algo que Nominatim no reconoce, como una región
     mal escrita) — y solo ahí, si alguna funciona, se autocorrige el texto
     con la sugerencia y se marca como "corregida". */
  let geo = await geocodificarConDetalle(original + ', Chile');
  let corregida = false;
  if(!geo){
    const partes = original.split(',').map(s => s.trim()).filter(Boolean);
    for(let n = partes.length - 1; n >= 1 && !geo; n--){
      geo = await geocodificarConDetalle(partes.slice(0, n).join(', ') + ', Chile');
      if(geo) corregida = true;
    }
  }
  let sugerencia = null;
  if(!geo) sugerencia = await buscarSugerenciaDireccion(original);

  const actual = direccionesRuta.find(x => x.id === id);
  if(!actual) return;
  if(geo){
    actual.lat = geo.lat; actual.lon = geo.lon;
    actual.sugerencia = null;
    if(corregida && geo.limpio){
      actual.texto = geo.limpio;
      actual.estado = 'corregido';
    }else{
      actual.estado = 'ok';
    }
  }else{
    actual.lat = null; actual.lon = null;
    actual.estado = 'error';
    actual.sugerencia = sugerencia ? { texto: sugerencia.limpio, lat: sugerencia.lat, lon: sugerencia.lon } : null;
  }
  renderDireccionesRuta();
}

/* La persona toca "¿Quisiste decir...?" y acepta la sugerencia: reemplaza
   el texto y las coordenadas de la dirección por los de la sugerencia, sin
   tener que volver a escribirla ni re-verificarla (ya viene geocodificada). */
export function usarSugerenciaDireccion(id){
  const d = direccionesRuta.find(x => x.id === id);
  if(!d || !d.sugerencia) return;
  d.texto = d.sugerencia.texto;
  d.lat = d.sugerencia.lat;
  d.lon = d.sugerencia.lon;
  d.estado = 'corregido';
  d.sugerencia = null;
  renderDireccionesRuta();
}

function renderDireccionesRuta(){
  const cont = g('rutas-dir-list');
  if(!cont) return;
  if(!direccionesRuta.length){
    cont.innerHTML = '<p class="eval-empty" style="margin:0">Todavía no agregaste direcciones.</p>';
    return;
  }
  const opcionesEquipo = Array.from({ length: equiposCount }, (_, i) => i);
  cont.innerHTML = direccionesRuta.map(d => {
    let estadoHtml;
    if(d.estado === 'ok') estadoHtml = '<i class="ti ti-check ruta-dir-ok" aria-hidden="true" title="Dirección encontrada"></i>';
    else if(d.estado === 'corregido') estadoHtml = '<i class="ti ti-check ruta-dir-ok" aria-hidden="true" title="Dirección corregida automáticamente"></i>';
    else if(d.estado === 'error') estadoHtml = '<i class="ti ti-x ruta-dir-error" aria-hidden="true" title="No se pudo ubicar esta dirección"></i>';
    else estadoHtml = '<span class="ruta-dir-checking">verificando…</span>';
    const equipoFijoValido = d.equipoFijo != null && d.equipoFijo < equiposCount;
    const equipoStyle = equipoFijoValido ? ` style="border-color:${colorGrupo(d.equipoFijo)};color:${colorGrupo(d.equipoFijo)}"` : '';
    const selectEquipo = `
      <select class="ruta-dir-equipo"${equipoStyle} title="Fijar a un equipo" onchange="setDireccionEquipo('${d.id}', this.value)">
        <option value=""${equipoFijoValido ? '' : ' selected'}>Auto</option>
        ${opcionesEquipo.map(i => `<option value="${i}"${d.equipoFijo === i ? ' selected' : ''}>Equipo ${i + 1}</option>`).join('')}
      </select>`;
    const btnPrioridad = `<button type="button" class="ruta-dir-prioridad${d.prioridad ? ' activa' : ''}" title="${d.prioridad ? 'Quitar prioridad' : 'Marcar como prioritaria'}" onclick="toggleDireccionPrioridad('${d.id}')"><i class="ti ti-star" aria-hidden="true"></i></button>`;
    return `
    <div class="ruta-dir-row">
      <i class="ti ti-map-pin" aria-hidden="true"></i>
      <span>
        ${escapeRuta(d.texto)}
        ${d.prioridad ? '<span class="ruta-dir-nota ruta-dir-nota-prioridad">prioritaria</span>' : ''}
        ${d.estado === 'corregido' ? '<span class="ruta-dir-nota">corregida automáticamente</span>' : ''}
        ${d.estado === 'error' ? '<span class="ruta-dir-nota ruta-dir-nota-error">no encontrada — revisa calle/comuna</span>' : ''}
        ${d.estado === 'error' && d.sugerencia ? `<button type="button" class="ruta-dir-sugerencia" onclick="usarSugerenciaDireccion('${d.id}')">¿Quisiste decir: <b>${escapeRuta(d.sugerencia.texto)}</b>?</button>` : ''}
      </span>
      ${estadoHtml}
      ${selectEquipo}
      ${btnPrioridad}
      <button type="button" class="ruta-dir-del" title="Quitar dirección" onclick="removeDireccionRuta('${d.id}')"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>`;
  }).join('');
}

function escapeRuta(s){
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Reparte las direcciones entre los N equipos por CERCANÍA real entre ellas,
   con clustering jerárquico aglomerativo puro: arranca con cada dirección
   como su propia "zona" y va fusionando, en cada paso, el par de zonas más
   cercano entre sí (comparando sus centroides), hasta que quedan
   exactamente N. Como en cada paso se fusiona lo más cercano primero, dos
   direcciones a pocas cuadras terminan juntas casi de inmediato, mucho
   antes que se toquen zonas lejanas — así el sector queda completo con un
   solo equipo en vez de mandar a dos equipos distintos al mismo barrio.
   La cercanía geográfica es el ÚNICO criterio para decidir qué se fusiona:
   no hay tope de tamaño por cluster ni mecanismo de respaldo que fusione
   por otro motivo. Si una zona real (ej. Providencia) tiene más direcciones
   que otra, el equipo a cargo de esa zona simplemente termina con más
   paradas -la cantidad de direcciones por equipo puede quedar despareja-,
   pero nunca se fusiona una zona con otra lejana solo para emparejar
   cantidades: eso fue justamente lo que causaba equipos con paradas
   dispersas por toda la Región Metropolitana (ver diagnóstico del bug de
   agruparPorCercania mezclando Providencia con San Miguel).
   Se probó primero con k-means (elegir N semillas separadas y asignar cada
   punto a la más cercana), pero con pocas direcciones repartidas en zonas
   chicas eso podía "gastar" dos semillas en dos zonas que en realidad
   estaban cerca entre sí, dejando una tercera zona real mezclada con otra
   — el clustering aglomerativo no tiene ese problema porque nunca decide
   por adelantado dónde van los centros, solo va juntando lo más próximo. */
function dist2(a, b){ const dx = a.lat - b.lat, dy = a.lon - b.lon; return dx * dx + dy * dy; }
function centroideCluster(cluster){
  return {
    lat: cluster.reduce((s, p) => s + p.lat, 0) / cluster.length,
    lon: cluster.reduce((s, p) => s + p.lon, 0) / cluster.length
  };
}
function agruparPorCercania(puntos, k){
  if(puntos.length <= k) return puntos.map(p => [p]);
  let clusters = puntos.map(p => [p]);
  let centroides = puntos.map(p => ({ lat: p.lat, lon: p.lon }));
  while(clusters.length > k){
    let mejorI = 0, mejorJ = 1, mejorD = Infinity;
    for(let i = 0; i < clusters.length; i++){
      for(let j = i + 1; j < clusters.length; j++){
        const d = dist2(centroides[i], centroides[j]);
        if(d < mejorD){ mejorD = d; mejorI = i; mejorJ = j; }
      }
    }
    clusters[mejorI] = clusters[mejorI].concat(clusters[mejorJ]);
    centroides[mejorI] = centroideCluster(clusters[mejorI]);
    clusters.splice(mejorJ, 1);
    centroides.splice(mejorJ, 1);
  }
  return clusters;
}

function fmtDist(m){ return m == null ? '—' : (m / 1000).toFixed(1) + ' km'; }
function fmtDur(s){
  if(s == null) return '—';
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

/* ===== Mapa estático (sin librería) =====
   Compone un "print" del mapa uniendo tiles de OpenStreetMap en un canvas y
   dibujando encima un marcador por parada (coloreado según su equipo) más
   uno para el origen. Se genera 100% en el cliente: sin API key, sin costo,
   y el resultado es una imagen (dataURL) que sirve tanto para mostrarla en
   pantalla como para incrustarla directo en el PDF. tile.openstreetmap.org
   envía "Access-Control-Allow-Origin: *", así que el canvas no queda
   "manchado" (tainted) y se puede exportar con toDataURL(). */
const RUTA_MAPA_W = 880, RUTA_MAPA_H = 460;
const RUTA_MAPA_MINI_W = 640, RUTA_MAPA_MINI_H = 400;
function lonToPx(lon, zoom){ return (lon + 180) / 360 * Math.pow(2, zoom) * 256; }
function latToPx(lat, zoom){
  const rad = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, zoom) * 256;
}
function cargarTile(zoom, x, y){
  return new Promise(resolve => {
    const maxTile = Math.pow(2, zoom) - 1;
    if(y < 0 || y > maxTile){ resolve(null); return; }
    const wrappedX = ((x % (maxTile + 1)) + (maxTile + 1)) % (maxTile + 1);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`;
  });
}
/* Encuentra el zoom más alto (más "cerca") en el que todos los puntos
   entran dentro de width×height (con margen). zoomMin evita alejarse
   demasiado cuando hay un solo punto o puntos casi pegados — sin esto, un
   equipo con una sola parada saldría con un zoom mundial en vez de una
   vista de barrio. */
function encuadrar(puntos, width, height, zoomMax, zoomMin){
  const pad = 40;
  if(puntos.length === 1){
    const zoom = zoomMax;
    return { zoom, topLeftX: lonToPx(puntos[0].lon, zoom) - width / 2, topLeftY: latToPx(puntos[0].lat, zoom) - height / 2 };
  }
  for(let zoom = zoomMax; zoom >= zoomMin; zoom--){
    const xs = puntos.map(p => lonToPx(p.lon, zoom)), ys = puntos.map(p => latToPx(p.lat, zoom));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    if(maxX - minX <= width - pad * 2 && maxY - minY <= height - pad * 2){
      return { zoom, topLeftX: (minX + maxX) / 2 - width / 2, topLeftY: (minY + maxY) / 2 - height / 2 };
    }
  }
  const xs = puntos.map(p => lonToPx(p.lon, zoomMin)), ys = puntos.map(p => latToPx(p.lat, zoomMin));
  return { zoom: zoomMin, topLeftX: (Math.min(...xs) + Math.max(...xs)) / 2 - width / 2, topLeftY: (Math.min(...ys) + Math.max(...ys)) / 2 - height / 2 };
}
async function dibujarTiles(ctx, width, height, zoom, topLeftX, topLeftY){
  ctx.fillStyle = '#e8e6e1'; ctx.fillRect(0, 0, width, height);
  const txMin = Math.floor(topLeftX / 256), txMax = Math.floor((topLeftX + width) / 256);
  const tyMin = Math.floor(topLeftY / 256), tyMax = Math.floor((topLeftY + height) / 256);
  const tiles = [];
  for(let tx = txMin; tx <= txMax; tx++){
    for(let ty = tyMin; ty <= tyMax; ty++) tiles.push({ tx, ty, p: cargarTile(zoom, tx, ty) });
  }
  for(const t of tiles){
    const img = await t.p;
    if(img) ctx.drawImage(img, t.tx * 256 - topLeftX, t.ty * 256 - topLeftY);
  }
}
function dibujarMarcador(ctx, zoom, topLeftX, topLeftY, lat, lon, color, radio, numero){
  const x = lonToPx(lon, zoom) - topLeftX, y = latToPx(lat, zoom) - topLeftY;
  ctx.beginPath();
  ctx.arc(x, y, radio, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  if(numero != null){
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(radio * 1.15) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(numero), x, y + 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
}
function dibujarAtribucion(ctx, width, height){
  const attr = '© OpenStreetMap contributors';
  ctx.font = '10px sans-serif';
  const tw = ctx.measureText(attr).width;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillRect(width - tw - 10, height - 17, tw + 8, 15);
  ctx.fillStyle = '#333';
  ctx.fillText(attr, width - tw - 6, height - 6);
}

/* Mapa general: todos los equipos + el origen, encuadrado para que entre
   todo (esta es la vista "principal" que se ve en pantalla y arriba del
   PDF). */
async function generarMapaRuta(origen, puntos){
  if(!origen || origen.lat == null || origen.lon == null) return null;
  const todos = [{ lat: origen.lat, lon: origen.lon }, ...puntos.filter(p => p.lat != null && p.lon != null)];
  if(todos.length < 2) return null;
  const { zoom, topLeftX, topLeftY } = encuadrar(todos, RUTA_MAPA_W, RUTA_MAPA_H, 17, 2);
  const canvas = document.createElement('canvas');
  canvas.width = RUTA_MAPA_W; canvas.height = RUTA_MAPA_H;
  const ctx = canvas.getContext('2d');
  await dibujarTiles(ctx, RUTA_MAPA_W, RUTA_MAPA_H, zoom, topLeftX, topLeftY);
  puntos.forEach(p => { if(p.lat != null && p.lon != null) dibujarMarcador(ctx, zoom, topLeftX, topLeftY, p.lat, p.lon, p.color || '#0B7285', 7); });
  dibujarMarcador(ctx, zoom, topLeftX, topLeftY, origen.lat, origen.lon, '#0D0D0D', 9);
  dibujarAtribucion(ctx, RUTA_MAPA_W, RUTA_MAPA_H);
  return canvas.toDataURL('image/jpeg', 0.82);
}

/* Mapa "cercano" de un solo equipo: encuadra SOLO sus paradas (sin el
   origen, que suele estar lejos) y no deja bajar el zoom de nivel barrio,
   para que las calles se lean bien — a diferencia del mapa general, que
   prioriza mostrar todo el panorama. Cada marcador lleva el número de
   orden de visita, igual que la lista de direcciones de al lado. Solo se
   usa en el PDF (en pantalla ya se ve el detalle en la lista). */
async function generarMapaEquipo(paradas, color){
  const validos = (paradas || []).filter(p => p.lat != null && p.lon != null);
  if(!validos.length) return null;
  const { zoom, topLeftX, topLeftY } = encuadrar(validos, RUTA_MAPA_MINI_W, RUTA_MAPA_MINI_H, 16, 11);
  const canvas = document.createElement('canvas');
  canvas.width = RUTA_MAPA_MINI_W; canvas.height = RUTA_MAPA_MINI_H;
  const ctx = canvas.getContext('2d');
  await dibujarTiles(ctx, RUTA_MAPA_MINI_W, RUTA_MAPA_MINI_H, zoom, topLeftX, topLeftY);
  validos.forEach((p, idx) => dibujarMarcador(ctx, zoom, topLeftX, topLeftY, p.lat, p.lon, color, 11, idx + 1));
  dibujarAtribucion(ctx, RUTA_MAPA_MINI_W, RUTA_MAPA_MINI_H);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function renderMapaRuta(){
  const cont = g('rutas-mapa-wrap');
  if(!cont) return;
  if(!rutaMapaDataUrl){ cont.style.display = 'none'; cont.innerHTML = ''; return; }
  cont.style.display = '';
  cont.innerHTML = `<img src="${rutaMapaDataUrl}" alt="Mapa con las paradas de la ruta">`;
}

/* PDF con el detalle de la ruta (uno o varios equipos, con sus paradas en
   orden), reutilizando el mismo encabezado/branding que el resto de los
   reportes de la app (ver src/modules/evaluaciones-pdf.js). */
/* Reparto por equipo en columnas lado a lado (como tarjetas), en vez de
   bloques apilados uno debajo del otro: para las cantidades típicas de
   equipos/paradas de una ruta diaria, esto entra completo en una sola
   página y queda parejo/centrado en el ancho de la hoja. Cada columna lleva
   un encabezado sólido del color de su equipo (mismo color que su marcador
   en el mapa y que su tarjeta en pantalla) con el operador asignado. */
async function buildRutaPDFDoc(origenDireccion, fechaTexto, equipos, mapaDataUrl){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 36;
  const pageW = doc.internal.pageSize.getWidth();
  pdfDrawHeader(doc, pageW);
  let y = pdfDrawTitleBlock(doc, pageW, marginX, 'Rutas de instalación', `${fechaTexto} · Origen: ${origenDireccion || '—'}`);

  if(mapaDataUrl){
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(90);
    doc.text('MAPA GENERAL — TODOS LOS EQUIPOS', pageW / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 12;
    const imgW = pageW - marginX * 2, imgH = imgW * (RUTA_MAPA_H / RUTA_MAPA_W);
    y = pdfCheckPageBreak(doc, y, imgH + 16);
    doc.addImage(mapaDataUrl, 'JPEG', marginX, y, imgW, imgH);
    y += imgH + 22;
  }

  const list = equipos || [];
  if(list.length){
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    doc.text('REPARTO POR EQUIPO (mapa cercano de cada uno)', pageW / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 18;

    const nCols = list.length <= 3 ? list.length : Math.ceil(list.length / 2);
    const gap = 14;
    const colW = (pageW - marginX * 2 - gap * (nCols - 1)) / nCols;
    const headerH = 24, mapH = colW * (RUTA_MAPA_MINI_H / RUTA_MAPA_MINI_W), mapGap = 8, metaH = 13, lineH = 12, padTop = 9, padBot = 11, padX = 9;

    /* Los mapas cercanos se generan ANTES de dibujar nada (jsPDF necesita la
       imagen ya lista para addImage), uno por equipo, cada uno encuadrado
       solo en sus propias paradas para que se vean las calles. */
    const miniMapas = await Promise.all(list.map((eq, i) => generarMapaEquipo(eq.paradas, colorGrupo(i))));

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const cards = list.map((eq, i) => {
      const paradas = eq.paradas || [];
      const lineas = paradas.map((p, idx) => doc.splitTextToSize(`${idx + 1}. ${p.texto}`, colW - padX * 2));
      const linesCount = lineas.reduce((s, l) => s + l.length, 0);
      const tieneMapa = !!miniMapas[i];
      const cardH = headerH + (tieneMapa ? mapGap + mapH : 0) + padTop + metaH + linesCount * lineH + padBot;
      return { eq, i, lineas, cardH, mapa: miniMapas[i] };
    });

    for(let start = 0; start < cards.length; start += nCols){
      const fila = cards.slice(start, start + nCols);
      const rowH = Math.max(...fila.map(c => c.cardH));
      y = pdfCheckPageBreak(doc, y, rowH);
      fila.forEach((c, colIdx) => {
        const x = marginX + colIdx * (colW + gap);
        const color = hexToRgb(colorGrupo(c.i));

        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(x, y, colW, headerH, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        const operadoresTxt = (c.eq.operadores || []).join(', ');
        const headerTxt = `EQUIPO ${c.i + 1}` + (operadoresTxt ? ' — ' + operadoresTxt.toUpperCase() : ' — SIN OPERADOR');
        const headerLinea = doc.splitTextToSize(headerTxt, colW - padX * 2)[0] || headerTxt;
        doc.text(headerLinea, x + padX, y + 15.5);
        doc.setTextColor(0);

        let cy = y + headerH;
        if(c.mapa){
          cy += mapGap;
          doc.addImage(c.mapa, 'JPEG', x, cy, colW, mapH);
          cy += mapH;
        }
        cy += padTop;

        const paradas = c.eq.paradas || [];
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110);
        const meta = `${paradas.length} parada${paradas.length === 1 ? '' : 's'}` + (c.eq.distanciaM != null ? ` · ${fmtDist(c.eq.distanciaM)} · ${fmtDur(c.eq.duracionS)}` : '');
        doc.text(meta, x + padX, cy);
        doc.setTextColor(0);
        cy += metaH;

        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        c.lineas.forEach(lineasParada => {
          lineasParada.forEach(l => { doc.text(l, x + padX, cy); cy += lineH; });
        });

        doc.setDrawColor(color[0], color[1], color[2]); doc.setLineWidth(1.1);
        doc.rect(x, y, colW, c.cardH);
      });
      y += rowH + gap;
    }
  }
  return doc;
}

export async function exportRutaActualPDF(){
  if(!rutaFueCalculada()){ alert('Primero calcula las rutas.'); return; }
  if(!window.jspdf){ alert('No se pudo cargar el generador de PDF.'); return; }
  const btn = g('rutas-pdf-btn');
  const btnHtml = btn ? btn.innerHTML : '';
  if(btn){ btn.disabled = true; btn.innerHTML = 'Generando...'; }
  try{
    const doc = await buildRutaPDFDoc(rutaOrigen.direccion, new Date().toLocaleDateString('es-CL'), gruposRuta, rutaMapaDataUrl);
    doc.save(`Rutas_${safeId(new Date().toISOString().slice(0, 10))}.pdf`);
  }finally{
    if(btn){ btn.disabled = false; btn.innerHTML = btnHtml; }
  }
}

export async function exportRutaHistorialPDF(id){
  const r = rutas.find(x => x.id === id);
  if(!r) return;
  if(!window.jspdf){ alert('No se pudo cargar el generador de PDF.'); return; }
  const mapa = await generarMapaRuta(
    { lat: r.origenLat, lon: r.origenLon },
    (r.equipos || []).flatMap((eq, i) => (eq.paradas || []).map(p => ({ lat: p.lat, lon: p.lon, color: colorGrupo(i) })))
  );
  const doc = await buildRutaPDFDoc(r.origenDireccion, r.fecha || '', r.equipos || [], mapa);
  doc.save(`Rutas_${safeId(r.fecha || r.id)}.pdf`);
}

/* Resumen en texto plano (mismo contenido que el PDF, sin formato) para
   pre-cargarlo en WhatsApp. WhatsApp no permite adjuntar el PDF ni elegir un
   grupo específico por link (solo funciona así con contactos individuales):
   se abre el selector de chats con el texto ya escrito y la persona elige a
   quién enviárselo (grupo de técnicos u otro). */
function resumenRutaTexto(origenDireccion, fechaTexto, equipos){
  let msg = `*Rutas de instalación* — ${fechaTexto}\nOrigen: ${origenDireccion || '—'}\n`;
  (equipos || []).forEach((eq, i) => {
    const operadoresTxt = (eq.operadores || []).join(', ');
    msg += `\n*Equipo ${i + 1}*${operadoresTxt ? ' - ' + operadoresTxt : ' - sin operador asignado'}\n`;
    (eq.paradas || []).forEach((p, idx) => { msg += `${idx + 1}. ${p.texto}\n`; });
  });
  return msg;
}

export function enviarRutaWhatsapp(){
  if(!rutaFueCalculada()){ alert('Primero calcula las rutas.'); return; }
  const msg = resumenRutaTexto(rutaOrigen.direccion, new Date().toLocaleDateString('es-CL'), gruposRuta);
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

export function enviarRutaHistorialWhatsapp(id){
  const r = rutas.find(x => x.id === id);
  if(!r) return;
  const msg = resumenRutaTexto(r.origenDireccion, r.fecha || '', r.equipos || []);
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

/* Distancia en línea recta (metros) entre dos puntos {lat,lon} — se usa
   solo como respaldo si OSRM no responde, para no dejar el orden sin
   ningún criterio. */
function haversine(a, b){
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Distancia REAL de manejo (metros, por calles) desde la bodega a cada
   punto, en una sola consulta a la Table API de OSRM (una fila de
   distancias origen→todos). Se usa para decidir cuál parada es "la más
   lejana" al ordenar cada equipo — nunca línea recta cuando OSRM responde. */
async function distanciasDesdeOrigen(puntos){
  const mapa = new Map();
  if(!puntos.length) return mapa;
  const coords = [[rutaOrigen.lon, rutaOrigen.lat], ...puntos.map(p => [p.lon, p.lat])]
    .map(c => c.join(',')).join(';');
  const url = `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=distance`;
  try{
    const res = await fetch(url);
    const data = await res.json();
    if(data && data.code === 'Ok' && data.distances && data.distances[0]){
      const fila = data.distances[0];
      puntos.forEach((p, i) => mapa.set(p.id, fila[i + 1]));
      return mapa;
    }
  }catch(e){
    console.error('Error consultando distancias OSRM:', e);
  }
  puntos.forEach(p => mapa.set(p.id, haversine(rutaOrigen, p)));
  return mapa;
}

/* Ordena las paradas de un equipo: primero las marcadas como prioritarias
   (entre ellas, de la más lejana a la bodega a la más cercana), y después
   el resto con el mismo criterio de MÁS LEJANA a MÁS CERCANA (según
   distanciasDesdeOrigen). Ese orden queda fijo: el equipo arranca lejos y
   se va acercando, terminando el día cerca de la bodega. La bodega ya no se
   usa como punto simétrico de ida/vuelta para que OSRM "decida" el orden
   (como hacía el viaje redondo/TSP anterior) — acá el orden lo deciden la
   prioridad y la distancia a la bodega, y a OSRM solo se le pide la
   distancia/duración real de manejar ese recorrido ya fijado (bodega →
   parada más lejana → ... → parada más cercana → vuelta a la bodega). Si
   OSRM falla, se muestra igual el orden ya decidido, sin distancia/duración,
   en vez de romper el cálculo completo. */
async function ordenarGrupoPorLejania(grupo, distancias){
  const ordenado = [...grupo].sort((a, b) => {
    const pa = a.prioridad ? 1 : 0, pb = b.prioridad ? 1 : 0;
    if(pa !== pb) return pb - pa;
    return (distancias.get(b.id) ?? 0) - (distancias.get(a.id) ?? 0);
  });
  const coords = [[rutaOrigen.lon, rutaOrigen.lat], ...ordenado.map(d => [d.lon, d.lat]), [rutaOrigen.lon, rutaOrigen.lat]]
    .map(c => c.join(',')).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;
  try{
    const res = await fetch(url);
    const data = await res.json();
    if(data && data.code === 'Ok' && data.routes && data.routes[0]){
      const ruta = data.routes[0];
      return { paradas: ordenado.map(d => ({ texto: d.texto, lat: d.lat, lon: d.lon })), distanciaM: Math.round(ruta.distance), duracionS: Math.round(ruta.duration) };
    }
  }catch(e){
    console.error('Error consultando OSRM (route):', e);
  }
  return { paradas: ordenado.map(d => ({ texto: d.texto, lat: d.lat, lon: d.lon })), distanciaM: null, duracionS: null };
}

/* Reacomoda los clusters que arma agruparPorCercania para respetar el
   equipo que la persona haya fijado a mano en alguna dirección (selector
   "Equipo N" en la lista de direcciones) — esa elección manual siempre gana
   por sobre el reparto automático por cercanía, aunque geográficamente esa
   dirección le quedara mejor a otro equipo.
   1) A cada cluster natural (agrupado por sector) se le asigna el índice de
      equipo que más "votos" fijos tenga entre sus direcciones (mayoría);
      los clusters sin votos se reparten en los índices que van quedando.
   2) Cualquier dirección fijada a un equipo que no haya terminado con ese
      índice se saca de donde cayó por cercanía y se mueve a la fuerza a su
      equipo elegido. */
function remapGruposFijos(grupos, geocodificadas, n){
  const asignado = new Array(n).fill(-1);
  const usado = new Array(grupos.length).fill(false);

  const votos = grupos.map((cl, ci) => {
    const cuenta = {};
    cl.forEach(d => { if(d.equipoFijo != null && d.equipoFijo < n) cuenta[d.equipoFijo] = (cuenta[d.equipoFijo] || 0) + 1; });
    let mejorEquipo = null, mejorVotos = 0;
    for(const k in cuenta) if(cuenta[k] > mejorVotos){ mejorVotos = cuenta[k]; mejorEquipo = Number(k); }
    return { ci, equipo: mejorEquipo, votos: mejorVotos };
  }).filter(v => v.equipo != null).sort((a, b) => b.votos - a.votos);

  votos.forEach(v => {
    if(asignado[v.equipo] === -1 && !usado[v.ci]){ asignado[v.equipo] = v.ci; usado[v.ci] = true; }
  });

  let libreEquipo = 0;
  grupos.forEach((cl, ci) => {
    if(usado[ci]) return;
    while(libreEquipo < n && asignado[libreEquipo] !== -1) libreEquipo++;
    if(libreEquipo < n){ asignado[libreEquipo] = ci; usado[ci] = true; libreEquipo++; }
  });

  const resultado = asignado.map(ci => ci === -1 ? [] : grupos[ci].slice());

  geocodificadas.forEach(d => {
    if(d.equipoFijo == null || d.equipoFijo >= n) return;
    for(let i = 0; i < resultado.length; i++){
      if(i === d.equipoFijo) continue;
      const idx = resultado[i].indexOf(d);
      if(idx !== -1) resultado[i].splice(idx, 1);
    }
    if(!resultado[d.equipoFijo].includes(d)) resultado[d.equipoFijo].push(d);
  });

  return resultado;
}

export async function calcularRutas(){
  if(calculando) return;
  if(!rutaOrigen.direccion){ alert('Ingresa la dirección de origen (bodega).'); return; }
  if(!direccionesRuta.length){ alert('Agrega al menos una dirección para calcular la ruta.'); return; }

  calculando = true;
  const btn = g('rutas-calc-btn');
  const btnHtml = btn ? btn.innerHTML : '';
  if(btn){ btn.disabled = true; btn.innerHTML = 'Calculando...'; }
  try{
    if(!rutaOrigen.lat || !rutaOrigen.lon){
      const geo = await consultarNominatim(rutaOrigen.direccion);
      if(!geo){ alert('No se pudo ubicar la dirección de origen. Revisa que esté bien escrita.'); return; }
      rutaOrigen.lat = geo.lat; rutaOrigen.lon = geo.lon;
    }
    for(const d of direccionesRuta){
      if(d.lat && d.lon) continue;
      const geo = await consultarNominatim(d.texto + ', Chile');
      if(geo){ d.lat = geo.lat; d.lon = geo.lon; }
    }
    const geocodificadas = direccionesRuta.filter(d => d.lat && d.lon);
    const sinGeo = direccionesRuta.filter(d => !d.lat || !d.lon);
    if(sinGeo.length){
      alert('No se pudieron ubicar estas direcciones (revisa que estén bien escritas), se dejaron afuera del cálculo:\n' + sinGeo.map(d => '- ' + d.texto).join('\n'));
    }
    if(!geocodificadas.length){ alert('No se pudo ubicar ninguna dirección.'); return; }

    const n = Math.min(equiposCount, geocodificadas.length);
    let grupos = agruparPorCercania(geocodificadas, n);
    if(geocodificadas.some(d => d.equipoFijo != null)) grupos = remapGruposFijos(grupos, geocodificadas, n);
    const distancias = await distanciasDesdeOrigen(geocodificadas);

    const resultados = [];
    for(let i = 0; i < grupos.length; i++){
      const grupo = grupos[i];
      const operadoresPrevios = (gruposRuta[i] && gruposRuta[i].operadores) || [];
      if(!grupo.length){ resultados.push({ operadores: operadoresPrevios, paradas: [], distanciaM: null, duracionS: null }); continue; }
      const r = await ordenarGrupoPorLejania(grupo, distancias);
      resultados.push({ operadores: operadoresPrevios, ...r });
    }
    gruposRuta = resultados;
    if(equipoActivo >= gruposRuta.length) equipoActivo = 0;
    rutaMapaDataUrl = await generarMapaRuta(
      rutaOrigen,
      gruposRuta.flatMap((grp, i) => grp.paradas.map(p => ({ lat: p.lat, lon: p.lon, color: colorGrupo(i) })))
    );
    mostrarResultado(true);
    renderMapaRuta();
    renderGruposRuta();
    renderOperadoresRuta();
    const wrap = g('rutas-resultado-wrap');
    if(wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }catch(e){
    console.error('Error calculando rutas:', e);
    alert('Ocurrió un error calculando las rutas. Revisa tu conexión e inténtalo de nuevo.');
  }finally{
    calculando = false;
    if(btn){ btn.disabled = false; btn.innerHTML = btnHtml; }
  }
}

export function renderGruposRuta(){
  const cont = g('rutas-grupos');
  if(!cont) return;
  if(!gruposRuta.length){ cont.innerHTML = ''; return; }
  cont.innerHTML = gruposRuta.map((grp, i) => {
    const operadores = grp.operadores || [];
    const paradas = grp.paradas || [];
    const calculado = paradas.length > 0;
    return `
    <div class="ruta-grupo-card${i === equipoActivo ? ' activo' : ''}" style="--grp-color:${colorGrupo(i)}">
      <div class="ruta-grupo-head" onclick="seleccionarEquipoActivo(${i})" title="Elegir este equipo para asignarle operadores">
        <span class="ruta-grupo-titulo"><i class="ti ti-car" aria-hidden="true"></i> Equipo ${i + 1}</span>
        ${i === equipoActivo ? '<span class="ruta-grupo-activo-tag"><i class="ti ti-check" aria-hidden="true"></i> Seleccionado</span>' : '<span class="ruta-grupo-drop-hint">Elegir</span>'}
      </div>
      <div class="ruta-grupo-operadores">
        ${operadores.length
          ? operadores.map(nombre => `<span class="ruta-operador-asignado">${escapeRuta(nombre)}<button type="button" title="Quitar operador" onclick="quitarOperadorDeGrupo(${i}, '${nombre.replace(/'/g, "\\'")}')"><i class="ti ti-x" aria-hidden="true"></i></button></span>`).join('')
          : '<span class="ruta-grupo-sin-operador">Sin operador — elige este equipo y toca a alguien abajo</span>'}
      </div>
      ${calculado
        ? `<div class="ruta-grupo-meta">${paradas.length} parada${paradas.length === 1 ? '' : 's'} · ${fmtDist(grp.distanciaM)} · ${fmtDur(grp.duracionS)}</div>
      <ol class="ruta-parada-list">${paradas.map(p => `<li>${escapeRuta(p.texto)}</li>`).join('')}</ol>`
        : '<div class="ruta-grupo-meta ruta-grupo-pendiente">Todavía no se calculó la ruta de este equipo</div>'}
    </div>`;
  }).join('');
}

export function seleccionarEquipoActivo(i){
  if(!gruposRuta[i]) return;
  equipoActivo = i;
  renderGruposRuta();
  renderOperadoresRuta();
}

/* Asignar operadores es "elegir equipo y tocar personas" en vez de
   arrastrar: más simple y funciona igual en celular/tablet (el drag&drop
   nativo de HTML5 no anda bien en pantallas táctiles). Tocar un operador lo
   agrega al equipo activo (y lo saca de cualquier otro equipo donde
   estuviera); tocarlo de nuevo estando ese mismo equipo activo lo saca. */
export function toggleOperadorEquipo(nombre){
  const grp = gruposRuta[equipoActivo];
  if(!grp) return;
  if(!grp.operadores) grp.operadores = [];
  const yaEnActivo = grp.operadores.includes(nombre);
  gruposRuta.forEach(g => { if(g.operadores) g.operadores = g.operadores.filter(n => n !== nombre); });
  if(!yaEnActivo) grp.operadores.push(nombre);
  renderGruposRuta();
  renderOperadoresRuta();
}

export function quitarOperadorDeGrupo(i, nombre){
  if(!gruposRuta[i] || !gruposRuta[i].operadores) return;
  gruposRuta[i].operadores = gruposRuta[i].operadores.filter(n => n !== nombre);
  renderGruposRuta();
  renderOperadoresRuta();
}

export function renderOperadoresRuta(){
  const cont = g('rutas-operadores');
  if(!cont) return;
  const colorPorOperador = {};
  gruposRuta.forEach((grp, i) => (grp.operadores || []).forEach(nombre => { colorPorOperador[nombre] = colorGrupo(i); }));
  const tecs = tecnicosList();
  if(!tecs.length){
    cont.innerHTML = '<p class="eval-empty" style="margin:0">No hay operadores cargados en Listas → Personas.</p>';
    return;
  }
  cont.innerHTML = tecs.map(nombre => {
    const color = colorPorOperador[nombre];
    const nombreAttr = nombre.replace(/'/g, "\\'");
    const style = color ? ` style="--chip-color:${color}"` : '';
    return `<span class="ruta-operador-chip${color ? ' asignado' : ''}"${style} onclick="toggleOperadorEquipo('${nombreAttr}')">${escapeRuta(nombre)}${color ? ' <i class="ti ti-check" aria-hidden="true"></i>' : ''}</span>`;
  }).join('');
}

export async function guardarRutaActual(){
  if(!rutaFueCalculada()){ alert('Primero calcula las rutas.'); return; }
  const sinOperador = gruposRuta.filter(g => !(g.operadores && g.operadores.length)).length;
  if(sinOperador && !confirm(`${sinOperador} equipo(s) todavía no tienen operador asignado. ¿Guardar de todos modos?`)) return;

  const payload = {
    id: 'ruta_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    fecha: new Date().toISOString().slice(0, 10),
    origenDireccion: rutaOrigen.direccion, origenLat: rutaOrigen.lat, origenLon: rutaOrigen.lon,
    cantidadEquipos: gruposRuta.length,
    equipos: gruposRuta.map(grp => ({
      operadores: grp.operadores || [],
      paradas: grp.paradas.map((p, idx) => ({ texto: p.texto, lat: p.lat, lon: p.lon, orden: idx + 1 })),
      distanciaM: grp.distanciaM, duracionS: grp.duracionS
    })),
    creadoPor: currentUserName()
  };
  const ok = await dbUpsertRuta(payload);
  if(ok){
    __set_rutas([{ ...payload, creadoEn: new Date().toISOString() }, ...rutas]);
    renderHistorialRutas();
    showToast('toast-rutas');
  }
}

export function renderHistorialRutas(){
  const cont = g('rutas-historial');
  if(!cont) return;
  if(!rutas.length){
    cont.innerHTML = '<p class="eval-empty" style="margin:0">Todavía no hay rutas guardadas.</p>';
    return;
  }
  cont.innerHTML = rutas.map(r => `
    <div class="ruta-hist-row">
      <div>
        <strong>${r.fecha || ''}</strong>
        <span>${escapeRuta(r.origenDireccion || '')} · ${r.cantidadEquipos || (r.equipos || []).length} equipo(s)</span>
      </div>
      <button type="button" class="btn-sec btn-sm" onclick="verRutaHistorial('${r.id}')"><i class="ti ti-eye" aria-hidden="true"></i> Ver</button>
    </div>`).join('');
}

export async function verRutaHistorial(id){
  const r = rutas.find(x => x.id === id);
  const cont = g('rutas-hist-detalle');
  if(!r || !cont) return;
  cont.innerHTML = `
    <div class="card" style="--sec-color:#0B7285;margin-top:1rem">
      <div class="ruta-resultado-head">
        <p class="card-title" style="margin-bottom:0;border-bottom:none;padding-bottom:0"><i class="ti ti-route" aria-hidden="true"></i> Ruta del ${r.fecha || ''} — ${escapeRuta(r.origenDireccion || '')}</p>
        <div class="ruta-toolbar">
          <button type="button" class="btn-sec btn-sm" onclick="exportRutaHistorialPDF('${r.id}')"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> PDF</button>
          <button type="button" class="btn-sec btn-sm" style="color:#1baf7a;border-color:#1baf7a" onclick="enviarRutaHistorialWhatsapp('${r.id}')"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i> WhatsApp</button>
        </div>
      </div>
      <div id="rutas-hist-mapa-${safeId(r.id)}" class="ruta-mapa-wrap" style="display:none"></div>
      <div class="ruta-grupos-grid">
        ${(r.equipos || []).map((eq, i) => `
          <div class="ruta-grupo-card" style="--grp-color:${colorGrupo(i)};cursor:default">
            <div class="ruta-grupo-head">
              <span class="ruta-grupo-titulo"><i class="ti ti-car" aria-hidden="true"></i> Equipo ${i + 1}</span>
            </div>
            <div class="ruta-grupo-operadores">
              ${(eq.operadores || []).length
                ? (eq.operadores || []).map(nombre => `<span class="ruta-operador-asignado">${escapeRuta(nombre)}</span>`).join('')
                : '<span class="ruta-grupo-sin-operador">Sin operador asignado</span>'}
            </div>
            <div class="ruta-grupo-meta">${(eq.paradas || []).length} parada${(eq.paradas || []).length === 1 ? '' : 's'} · ${fmtDist(eq.distanciaM)} · ${fmtDur(eq.duracionS)}</div>
            <ol class="ruta-parada-list">${(eq.paradas || []).map(p => `<li>${escapeRuta(p.texto)}</li>`).join('')}</ol>
          </div>`).join('')}
      </div>
    </div>`;
  const mapa = await generarMapaRuta(
    { lat: r.origenLat, lon: r.origenLon },
    (r.equipos || []).flatMap((eq, i) => (eq.paradas || []).map(p => ({ lat: p.lat, lon: p.lon, color: colorGrupo(i) })))
  );
  const mapaCont = g('rutas-hist-mapa-' + safeId(r.id));
  if(mapa && mapaCont){
    mapaCont.style.display = '';
    mapaCont.innerHTML = `<img src="${mapa}" alt="Mapa con las paradas de la ruta">`;
  }
}
