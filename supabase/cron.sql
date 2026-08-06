-- Pega y ejecuta esto en Supabase → SQL Editor, UNA sola vez, después de
-- desplegar la función "check-flota-estado" (ver supabase/functions/check-flota-estado/index.ts).
-- Programa la revisión diaria de Estado de Flota y el envío del correo resumen.
--
-- IMPORTANTE: antes de correr esto, reemplaza REEMPLAZA_CON_TU_CRON_SECRET
-- de la línea "headers" más abajo por el MISMO valor que configuraste como
-- secret CRON_SECRET en Dashboard → Edge Functions → Secrets. Si no coinciden,
-- la función va a responder 401 y el correo diario no se va a enviar.

-- 1) Habilitar las extensiones necesarias para programar tareas y hacer
--    peticiones HTTP desde Postgres (una sola vez por proyecto).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2) Programar la tarea: todos los días a las 12:00 UTC (08:00 en Chile,
--    horario de invierno UTC-4 — ajusta la hora si prefieres otro horario).
select
  cron.schedule(
    'check-flota-estado-diario',
    '0 12 * * *',
    $$
    select
      net.http_post(
          url := 'https://dcbsdwqkmeepxuvaykxb.supabase.co/functions/v1/check-flota-estado',
          headers := '{"Content-Type": "application/json", "x-cron-secret": "REEMPLAZA_CON_TU_CRON_SECRET"}'::jsonb,
          body := '{}'::jsonb
      ) as request_id;
    $$
  );

-- Para revisar que quedó programada:
-- select * from cron.job;

-- Para eliminarla si alguna vez quieres desactivarla:
-- select cron.unschedule('check-flota-estado-diario');
