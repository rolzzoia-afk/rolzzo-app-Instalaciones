// Valida el PIN de 4 dígitos del login contra rolzzo_personas usando la
// service_role key (solo del lado servidor, nunca expuesta al navegador).
// Reemplaza la validación anterior, que descargaba la tabla completa (con
// el PIN de todo el personal) al cliente antes de mostrar el login — ver
// tryRestoreSession()/checkPin() en src/modules/login.js.
//
// Devuelve solo los datos de LA PERSONA QUE COINCIDE (nunca la lista
// completa ni el PIN de otros) y un error genérico si no coincide, para no
// dar pistas de si el código existe o no.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

const PERMISOS_DEFAULT = ['regnew', 'regrep', 'dash', 'unireg', 'unimant', 'unirep'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);

  let codigo = '';
  try {
    const body = await req.json();
    codigo = String(body?.codigo ?? '').trim();
  } catch {
    return json({ ok: false, error: 'Solicitud inválida' }, 400);
  }

  // Mismo formato que ya exige el frontend (4 dígitos numéricos): rechazo
  // rápido sin tocar la base de datos si claramente no puede ser un PIN.
  if (!/^\d{4}$/.test(codigo)) return json({ ok: false, error: 'Código no reconocido' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('rolzzo_personas')
    .select('codigo,nombre,rut,rol,es_nuevo,dias_prueba,fecha_ingreso,permisos,induccion')
    .eq('codigo', codigo)
    .maybeSingle();

  if (error) {
    console.error('Error consultando rolzzo_personas:', error);
    return json({ ok: false, error: 'No se pudo verificar el código' }, 500);
  }
  // Mismo mensaje genérico tanto si el código no existe como si hay
  // cualquier otro problema de "no match" — no se da pista de cuál es el caso.
  if (!data) return json({ ok: false, error: 'Código no reconocido' });

  return json({
    ok: true,
    persona: {
      nombre: data.nombre,
      rut: data.rut || '',
      codigo: data.codigo,
      rol: data.rol,
      esNuevo: data.es_nuevo,
      diasPrueba: data.dias_prueba,
      fechaIngreso: data.fecha_ingreso,
      permisos: data.permisos || PERMISOS_DEFAULT,
      induccion: data.induccion || {}
    }
  });
});
