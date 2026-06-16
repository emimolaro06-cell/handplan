-- ================================================================
-- HANDBALL DEFENSA Y JUSTICIA — Schema v1.0
-- Ejecutar en: Supabase → SQL Editor → New Query
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Extiende auth.users. Login por username (email interno generado).
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'coach' CHECK (role IN ('admin','coach')),
  categories    TEXT[] NOT NULL DEFAULT '{}',
  club_name     TEXT NOT NULL DEFAULT 'Handball Defensa y Justicia',
  avatar_color  TEXT NOT NULL DEFAULT '#1e8a1e',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── exercise_labels ───────────────────────────────────────────────────────────
-- Lista desplegable personalizable para el "nombre del ejercicio" en momentos
CREATE TABLE IF NOT EXISTS public.exercise_labels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Labels iniciales de ejemplo
INSERT INTO public.exercise_labels (label, created_by) VALUES
  ('Lúdico libre',               NULL),
  ('Ejercicio de Téc. individual', NULL),
  ('Drill ofensivo',             NULL),
  ('Drill defensivo',            NULL),
  ('Técnica colectiva',          NULL),
  ('Juego reducido',             NULL),
  ('Circuito físico',            NULL),
  ('Trabajo de arquero',         NULL),
  ('Transiciones',               NULL),
  ('Partido de práctica',        NULL)
ON CONFLICT DO NOTHING;

-- ── training_sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_name          TEXT NOT NULL,
  team_category       TEXT NOT NULL,
  content_category    TEXT NOT NULL,
  session_date        DATE NOT NULL,
  session_number      INTEGER NOT NULL DEFAULT 1,
  total_duration_min  INTEGER NOT NULL DEFAULT 90,
  general_objective   TEXT NOT NULL,
  main_content        TEXT,
  status              TEXT NOT NULL DEFAULT 'saved'
                        CHECK (status IN ('draft','saved')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── moments ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL
                        REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  order_index         INTEGER NOT NULL DEFAULT 0,
  exercise_label      TEXT,
  duration_min        INTEGER NOT NULL DEFAULT 10,
  exercise_category   TEXT,
  image_url           TEXT,
  description         TEXT,
  observations        TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── exercises ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exercises (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  image_url        TEXT,
  description      TEXT,
  objectives       TEXT,
  recommended_age  TEXT,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_user       ON public.training_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_team_cat   ON public.training_sessions(team_category);
CREATE INDEX IF NOT EXISTS idx_sessions_content    ON public.training_sessions(content_category);
CREATE INDEX IF NOT EXISTS idx_sessions_date       ON public.training_sessions(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_coach      ON public.training_sessions(coach_name);
CREATE INDEX IF NOT EXISTS idx_moments_session     ON public.moments(session_id, order_index);
CREATE INDEX IF NOT EXISTS idx_exercises_category  ON public.exercises(category);
CREATE INDEX IF NOT EXISTS idx_labels_created_by   ON public.exercise_labels(created_by);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_labels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises         ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- exercise_labels: todos los auth leen, los autenticados insertan/borran los suyos
CREATE POLICY "labels_select_all"
  ON public.exercise_labels FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "labels_insert_auth"
  ON public.exercise_labels FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "labels_delete_own"
  ON public.exercise_labels FOR DELETE USING (auth.uid() = created_by OR created_by IS NULL);

-- training_sessions
CREATE POLICY "sessions_select_own"
  ON public.training_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sessions_insert_own"
  ON public.training_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions_update_own"
  ON public.training_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sessions_delete_own"
  ON public.training_sessions FOR DELETE USING (auth.uid() = user_id);

-- moments (acceso vía sesión propia)
CREATE POLICY "moments_select"
  ON public.moments FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );
CREATE POLICY "moments_insert"
  ON public.moments FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );
CREATE POLICY "moments_update"
  ON public.moments FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );
CREATE POLICY "moments_delete"
  ON public.moments FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

-- exercises: todos leen, autenticados insertan, el creador borra
CREATE POLICY "exercises_select"
  ON public.exercises FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "exercises_insert"
  ON public.exercises FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "exercises_delete"
  ON public.exercises FOR DELETE USING (auth.uid() = created_by);

-- ── Trigger: crear perfil automáticamente al registrar usuario ────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role, categories, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username',  split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Sin nombre'),
    COALESCE(NEW.raw_user_meta_data->>'role',      'coach'),
    ARRAY[]::TEXT[],
    COALESCE(NEW.raw_user_meta_data->>'avatar_color', '#1e8a1e')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Storage buckets ───────────────────────────────────────────────────────────
-- Ejecutar en Storage → New Bucket (marcar como Public):
--   Nombre: exercises
--   Nombre: moments
--
-- Luego en SQL Editor agregar las policies de storage:
--
-- CREATE POLICY "moments_upload" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'moments' AND auth.role() = 'authenticated');
-- CREATE POLICY "moments_read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'moments');
-- CREATE POLICY "exercises_upload" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'exercises' AND auth.role() = 'authenticated');
-- CREATE POLICY "exercises_read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'exercises');

-- ── Crear primer entrenador (REEMPLAZAR el UUID con el del usuario creado) ────
-- 1. Ir a Authentication → Users → Invite user
-- 2. Email: juan_perez@hbdj.internal  (username = juan_perez)
-- 3. Después de que el usuario confirme su cuenta, ejecutar:
--
-- UPDATE public.profiles SET
--   full_name    = 'Juan Pérez',
--   username     = 'juan_perez',
--   role         = 'coach',
--   categories   = ARRAY['Menores','Infantiles'],
--   avatar_color = '#1e8a1e'
-- WHERE id = '<UUID_DEL_USUARIO>';
