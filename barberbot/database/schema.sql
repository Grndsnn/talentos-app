-- ==============================================================================
-- SaaS BarberBot IA (Recepción IA) - Esquema Relacional de Base de Datos
-- Plataforma: PostgreSQL 14+ / Supabase
-- Arquitectura de 3 Servicios: API, Gateway WhatsApp, Worker con Colas en Postgres
-- ==============================================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. Tabla de Barberos (Personal)
CREATE TABLE IF NOT EXISTS public.barbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    working_hours JSONB NOT NULL DEFAULT '{
        "monday": {"start": "09:00", "end": "20:00", "active": true},
        "tuesday": {"start": "09:00", "end": "20:00", "active": true},
        "wednesday": {"start": "09:00", "end": "20:00", "active": true},
        "thursday": {"start": "09:00", "end": "20:00", "active": true},
        "friday": {"start": "09:00", "end": "21:00", "active": true},
        "saturday": {"start": "09:00", "end": "21:00", "active": true},
        "sunday": {"start": "10:00", "end": "16:00", "active": false}
    }'::jsonb,
    commission_rate NUMERIC(4,2) NOT NULL DEFAULT 0.40, -- 40% de comisión por defecto
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabla de Catálogo de Servicios
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
    category TEXT NOT NULL DEFAULT 'corte',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabla de Clientes (CRM & Historial)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    total_visits INTEGER NOT NULL DEFAULT 0,
    tags TEXT[] NOT NULL DEFAULT ARRAY['nuevo']::TEXT[],
    notes TEXT,
    last_visit TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tabla de Citas (Appointments)
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE RESTRICT,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('confirmed', 'pending', 'no_show', 'completed', 'cancelled', 'blocked')),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_method IN ('cash', 'card', 'transfer', 'pending')),
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
    notes TEXT,
    reminder_24h_sent BOOLEAN NOT NULL DEFAULT false,
    reminder_2h_sent BOOLEAN NOT NULL DEFAULT false,
    source VARCHAR(20) NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'dashboard', 'manual'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_appointment_time CHECK (end_datetime > datetime)
);

-- 6. Tabla de Conversaciones (Estado persistente del Gateway & Bot)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    client_name TEXT NOT NULL DEFAULT 'Cliente WhatsApp',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'bot_paused', 'suspended')),
    unread_count INTEGER NOT NULL DEFAULT 0,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Tabla de Mensajes (Historial Completo; el modelo solo ve los últimos 12 mensajes)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_call_id TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Tabla de Cola en Postgres (pending_actions / jobs)
-- Soporta procesamiento asíncrono, concurrencia por conversación y transacciones seguras
CREATE TABLE IF NOT EXISTS public.pending_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL DEFAULT 'incoming_whatsapp_message',
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Índices para Alto Rendimiento
CREATE INDEX IF NOT EXISTS idx_appointments_barber_range 
    ON public.appointments(barber_id, datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_status 
    ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_clients_phone 
    ON public.clients(phone);

CREATE INDEX IF NOT EXISTS idx_conversations_phone 
    ON public.conversations(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_status 
    ON public.conversations(status);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_time 
    ON public.messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_actions_queue 
    ON public.pending_actions(status, created_at) 
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pending_actions_conversation 
    ON public.pending_actions(conversation_id);

-- 10. Función SQL: Dequeue con bloqueo de 1 turno por conversación
-- Evita condiciones de carrera: Si la conversación ya tiene un job 'processing', no toma otro de la misma conversación
CREATE OR REPLACE FUNCTION public.fn_dequeue_next_action(p_worker_id TEXT)
RETURNS SETOF public.pending_actions
LANGUAGE plpgsql
AS $$
DECLARE
    v_action_id UUID;
BEGIN
    -- Seleccionar la acción más antigua cuya conversación NO esté siendo procesada actualmente
    SELECT a.id INTO v_action_id
    FROM public.pending_actions a
    WHERE a.status = 'pending'
      AND NOT EXISTS (
          SELECT 1 FROM public.pending_actions running
          WHERE running.conversation_id = a.conversation_id
            AND running.status = 'processing'
      )
    ORDER BY a.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_action_id IS NOT NULL THEN
        RETURN QUERY
        UPDATE public.pending_actions
        SET status = 'processing',
            locked_at = now(),
            locked_by = p_worker_id,
            attempts = attempts + 1
        WHERE id = v_action_id
        RETURNING *;
    END IF;
END;
$$;

-- 11. Función SQL: Obtener los últimos 12 mensajes ordenados cronológicamente
CREATE OR REPLACE FUNCTION public.fn_get_recent_12_messages(p_conversation_id UUID)
RETURNS TABLE (
    id UUID,
    role VARCHAR(20),
    content TEXT,
    tool_calls JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    SELECT id, role, content, tool_calls, created_at
    FROM (
        SELECT id, role, content, tool_calls, created_at
        FROM public.messages
        WHERE conversation_id = p_conversation_id
        ORDER BY created_at DESC
        LIMIT 12
    ) sub
    ORDER BY created_at ASC;
$$;

-- 12. Row Level Security (RLS)
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura general de barberos" ON public.barbers FOR SELECT USING (true);
CREATE POLICY "Permitir escritura de barberos" ON public.barbers FOR ALL USING (true);
CREATE POLICY "Permitir lectura general de servicios" ON public.services FOR SELECT USING (true);
CREATE POLICY "Permitir escritura de servicios" ON public.services FOR ALL USING (true);
CREATE POLICY "Permitir lectura de clientes" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Permitir gestión de clientes" ON public.clients FOR ALL USING (true);
CREATE POLICY "Permitir lectura de citas" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "Permitir gestión de citas" ON public.appointments FOR ALL USING (true);
CREATE POLICY "Permitir gestión de conversaciones" ON public.conversations FOR ALL USING (true);
CREATE POLICY "Permitir gestión de mensajes" ON public.messages FOR ALL USING (true);
CREATE POLICY "Permitir gestión de pending_actions" ON public.pending_actions FOR ALL USING (true);
