// Revisa el semáforo de "Estado de Flota" (misma lógica que src/modules/estado-flota.js)
// y manda un correo resumen por Resend con todo lo que esté en amarillo o rojo.
// Pensado para correr una vez al día vía pg_cron (ver supabase/cron.sql) — se reenvía
// todos los días mientras la mantención siga sin ponerse al día, no solo la primera vez.
import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Secreto compartido con supabase/cron.sql (header "x-cron-secret"): sin
// esto, cualquiera en internet que conozca la URL de la función puede
// dispararla, gastar la cuota de Resend y mandar spam a gerencia.
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
// Remitente verificado en Resend (Domains). Si todavía no verificaste un dominio propio,
// deja RESEND_FROM sin definir y usa el de pruebas de Resend.
const REMITENTE = Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev';

const DESTINATARIOS = [
  'gerencia@cortinasrolzzo.cl',
  'cortinasrolzzogerencia@gmail.com',
  'rolzzoa@gmail.com',
  'marketing@cortinasrolzzo.cl'
];

type Estado = 'verde' | 'amarillo' | 'rojo';

function claseSemaforoPct(pct: number): Estado {
  if (pct >= 50) return 'verde';
  if (pct >= 25) return 'amarillo';
  return 'rojo';
}

// Mismo cálculo que calcEstadoReglaFlota() en src/modules/estado-flota.js — si cambian
// los cortes de color o el criterio allá, hay que replicarlo acá también.
function calcEstado(regla: any, kmActual: number | null): { estado: Estado; restanteTexto?: string } {
  if (regla.modo === 'km') {
    const intervalo = parseInt(regla.intervaloKm) || 0;
    const ultimo = parseInt(regla.ultimoKm) || 0;
    if (!intervalo) return { estado: 'verde' };
    const proximo = ultimo + intervalo;
    if (kmActual === null) return { estado: 'verde' };
    if (kmActual < ultimo) return { estado: 'verde' }; // dato inconsistente: no se alarma con un cálculo que no tiene sentido
    const restanteKm = proximo - kmActual;
    const pct = Math.max(0, Math.min(100, Math.round((restanteKm / intervalo) * 100)));
    const restanteTexto = restanteKm <= 0
      ? `${Math.abs(restanteKm).toLocaleString('es-CL')} km excedidos`
      : `${restanteKm.toLocaleString('es-CL')} km restantes`;
    return { estado: claseSemaforoPct(pct), restanteTexto };
  }
  const meses = parseInt(regla.intervaloMeses) || 0;
  if (!meses || !regla.ultimaFecha) return { estado: 'verde' };
  const base = new Date(regla.ultimaFecha + 'T12:00:00');
  const venc = new Date(base);
  venc.setMonth(venc.getMonth() + meses);
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  const diasTotales = Math.max(1, Math.round((venc.getTime() - base.getTime()) / 86400000));
  const diasRest = Math.round((venc.getTime() - hoy.getTime()) / 86400000);
  const pct = Math.max(0, Math.min(100, Math.round((diasRest / diasTotales) * 100)));
  const mesesRest = Math.round(diasRest / 30);
  const restanteTexto = diasRest <= 0
    ? `vencido hace ${Math.abs(mesesRest)} ${Math.abs(mesesRest) === 1 ? 'mes' : 'meses'}`
    : mesesRest >= 1
      ? `quedan ${mesesRest} ${mesesRest === 1 ? 'mes' : 'meses'}`
      : `quedan ${diasRest} día(s)`;
  return { estado: claseSemaforoPct(pct), restanteTexto };
}

Deno.serve(async (req) => {
  // Verificación de autorización: solo el cron interno (supabase/cron.sql)
  // conoce este secreto. Se corta acá, antes de tocar la base de datos o
  // gastar cuota de Resend, si no coincide.
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: vehiculos, error: errV } = await supabase.from('rolzzo_vehiculos').select('patente, reglas_mant');
  if (errV) return new Response(JSON.stringify({ error: errV.message }), { status: 500 });

  const { data: unidades, error: errU } = await supabase.from('rolzzo_unidades').select('patente, kmf');
  if (errU) return new Response(JSON.stringify({ error: errU.message }), { status: 500 });

  const kmPorPatente: Record<string, number> = {};
  (unidades || []).forEach((u: any) => {
    if (u.kmf == null) return;
    if (!(u.patente in kmPorPatente) || u.kmf > kmPorPatente[u.patente]) kmPorPatente[u.patente] = u.kmf;
  });

  const alertas: { patente: string; desc: string; estado: Estado; restanteTexto?: string }[] = [];
  (vehiculos || []).forEach((v: any) => {
    const reglas = v.reglas_mant || [];
    reglas.forEach((regla: any) => {
      const kmActual = v.patente in kmPorPatente ? kmPorPatente[v.patente] : null;
      const { estado, restanteTexto } = calcEstado(regla, kmActual);
      if (estado === 'amarillo' || estado === 'rojo') {
        alertas.push({ patente: v.patente, desc: regla.desc, estado, restanteTexto });
      }
    });
  });

  if (!alertas.length) {
    return new Response(JSON.stringify({ ok: true, enviado: false, motivo: 'sin alertas pendientes' }), { status: 200 });
  }

  alertas.sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'rojo' ? -1 : 1));

  const filas = alertas
    .map(
      (a) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${a.patente}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee">${a.desc}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee;color:${a.estado === 'rojo' ? '#C22C2C' : '#8A5A0F'};font-weight:700">${a.estado.toUpperCase()}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee">${a.restanteTexto || '—'}</td></tr>`
    )
    .join('');

  const html = `
    <h2 style="font-family:sans-serif">Estado de Flota — mantenciones pendientes</h2>
    <p style="font-family:sans-serif;font-size:13px">Estas mantenciones están en amarillo o rojo y necesitan atención:</p>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:13px">
      <thead>
        <tr style="background:#f5f4f0;text-align:left">
          <th style="padding:6px 10px">Patente</th>
          <th style="padding:6px 10px">Mantención</th>
          <th style="padding:6px 10px">Estado</th>
          <th style="padding:6px 10px">Detalle</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <p style="color:#888;font-size:11px;font-family:sans-serif;margin-top:16px">Este correo se reenvía todos los días mientras la mantención siga pendiente.</p>
  `;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: DESTINATARIOS,
      subject: `Estado de Flota: ${alertas.length} mantención(es) pendiente(s)`,
      html
    })
  });

  const resendBody = await resendRes.text();
  return new Response(JSON.stringify({ ok: resendRes.ok, alertas: alertas.length, resend: resendBody }), {
    status: resendRes.ok ? 200 : 500
  });
});
