    -- ==============================================================================
    -- TalentOS - Políticas de Seguridad, Multi-Inquilino y RLS en Supabase
    -- Basado en SECURITY.md y Arquitectura Zero-Trust
    -- ==============================================================================

    -- 1. Habilitar extensión UUID si no existe
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 2. Asegurar columnas de usuario y multi-inquilino en 'vacantes'
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'vacantes' AND column_name = 'user_id'
        ) THEN
            ALTER TABLE public.vacantes 
            ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'vacantes' AND column_name = 'is_demo'
        ) THEN
            ALTER TABLE public.vacantes 
            ADD COLUMN is_demo BOOLEAN DEFAULT FALSE;
        END IF;
    END $$;

    -- 3. Asegurar columnas de usuario en 'candidates'
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'candidates' AND column_name = 'user_id'
        ) THEN
            ALTER TABLE public.candidates 
            ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END $$;

    -- 4. Marcar vacantes predeterminadas como ejemplos/demo
    UPDATE public.vacantes 
    SET is_demo = TRUE 
    WHERE id IN ('REQ-2026-01', 'REQ-2026-02', 'REQ-2026-03', 'REQ-2026-04', 'REQ-2026-05') 
    OR user_id IS NULL;

    -- 5. Crear índices de rendimiento para consultas multi-inquilino
    CREATE INDEX IF NOT EXISTS idx_vacantes_user_id ON public.vacantes (user_id);
    CREATE INDEX IF NOT EXISTS idx_vacantes_is_demo ON public.vacantes (is_demo);
    CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON public.candidates (user_id);
    CREATE INDEX IF NOT EXISTS idx_candidates_vacante_user ON public.candidates (vacante_id, user_id);

    -- 6. Habilitar Row Level Security (RLS) en tablas públicas
    ALTER TABLE public.vacantes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

    -- 7. Limpiar políticas anteriores si existían
    DROP POLICY IF EXISTS "vacantes_select_policy" ON public.vacantes;
    DROP POLICY IF EXISTS "vacantes_insert_policy" ON public.vacantes;
    DROP POLICY IF EXISTS "vacantes_update_policy" ON public.vacantes;
    DROP POLICY IF EXISTS "vacantes_delete_policy" ON public.vacantes;

    DROP POLICY IF EXISTS "candidates_select_policy" ON public.candidates;
    DROP POLICY IF EXISTS "candidates_insert_policy" ON public.candidates;
    DROP POLICY IF EXISTS "candidates_update_policy" ON public.candidates;
    DROP POLICY IF EXISTS "candidates_delete_policy" ON public.candidates;

    -- 8. Políticas RLS para 'vacantes'
    -- Un usuario autenticado ve sus propias vacantes y las vacantes de ejemplo (is_demo = true)
    CREATE POLICY "vacantes_select_policy" 
    ON public.vacantes 
    FOR SELECT 
    TO authenticated 
    USING (
        (select auth.uid()) = user_id 
        OR is_demo = TRUE
    );

    -- Solo puede crear vacantes vinculadas a su propio user_id
    CREATE POLICY "vacantes_insert_policy" 
    ON public.vacantes 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (
        (select auth.uid()) = user_id
    );

    -- Solo puede modificar sus propias vacantes (no puede alterar las demo)
    CREATE POLICY "vacantes_update_policy" 
    ON public.vacantes 
    FOR UPDATE 
    TO authenticated 
    USING (
        (select auth.uid()) = user_id
    )
    WITH CHECK (
        (select auth.uid()) = user_id
    );

    -- Solo puede borrar sus propias vacantes
    CREATE POLICY "vacantes_delete_policy" 
    ON public.vacantes 
    FOR DELETE 
    TO authenticated 
    USING (
        (select auth.uid()) = user_id
    );

    -- 9. Políticas RLS para 'candidates'
    -- Un usuario ve candidatos que pertenecen a su cuenta o a sus vacantes
    CREATE POLICY "candidates_select_policy" 
    ON public.candidates 
    FOR SELECT 
    TO authenticated 
    USING (
        (select auth.uid()) = user_id 
        OR (user_id IS NULL AND vacante_id IN (SELECT id FROM public.vacantes WHERE is_demo = TRUE OR user_id = (select auth.uid())))
    );

    -- Inserción de candidatos por el usuario autenticado
    CREATE POLICY "candidates_insert_policy" 
    ON public.candidates 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (
        (select auth.uid()) = user_id 
        OR user_id IS NULL
    );

    -- Actualización exclusiva de sus candidatos
    CREATE POLICY "candidates_update_policy" 
    ON public.candidates 
    FOR UPDATE 
    TO authenticated 
    USING (
        (select auth.uid()) = user_id
    )
    WITH CHECK (
        (select auth.uid()) = user_id
    );

    -- Eliminación exclusiva de sus candidatos
    CREATE POLICY "candidates_delete_policy" 
    ON public.candidates 
    FOR DELETE 
    TO authenticated 
    USING (
        (select auth.uid()) = user_id
    );

    -- 10. Políticas de Storage para el bucket 'cvs' (si existe el esquema storage)
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
            DROP POLICY IF EXISTS "Permitir subida a usuarios autenticados" ON storage.objects;
            DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON storage.objects;

            CREATE POLICY "Permitir subida a usuarios autenticados"
            ON storage.objects FOR INSERT
            TO authenticated
            WITH CHECK (bucket_id = 'cvs');

            CREATE POLICY "Permitir lectura a usuarios autenticados"
            ON storage.objects FOR SELECT
            TO authenticated
            USING (bucket_id = 'cvs');
        END IF;
    END $$;
