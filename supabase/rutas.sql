-- Pega y ejecuta esto en Supabase → SQL Editor, UNA sola vez, para crear la
-- tabla que guarda el historial de rutas armadas en la sección "Rutas" de la app.

create table if not exists rolzzo_rutas (
  id text primary key,
  fecha date,
  origen_direccion text,
  origen_lat double precision,
  origen_lon double precision,
  cantidad_equipos int,
  equipos jsonb default '[]'::jsonb, -- [{operador, paradas:[{texto,lat,lon,orden}], distancia_m, duracion_s}]
  creado_por text,
  creado_en timestamptz default now()
);

-- Si el resto de las tablas rolzzo_* tienen Row Level Security (RLS)
-- habilitado con una policy que permite acceso al rol "authenticated" (ver
-- el comentario sobre ensureAnonSession() en src/modules/bootstrap.js),
-- replica la misma policy aquí para que rolzzo_rutas quede accesible igual
-- que las demás:
-- alter table rolzzo_rutas enable row level security;
-- create policy "Acceso autenticado" on rolzzo_rutas for all
--   using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
