-- ==============================================================================
-- SaaS BarberBot IA (Recepción IA) - Datos Iniciales de Prueba (Seed)
-- ==============================================================================

-- 1. Insertar Barberos
INSERT INTO public.barbers (id, name, phone, commission_rate, working_hours)
VALUES 
    (
        '11111111-1111-1111-1111-111111111111',
        'Toño El Máster',
        '+573001234567',
        0.45,
        '{
            "monday": {"start": "09:00", "end": "19:00", "active": true},
            "tuesday": {"start": "09:00", "end": "19:00", "active": true},
            "wednesday": {"start": "09:00", "end": "19:00", "active": true},
            "thursday": {"start": "09:00", "end": "19:00", "active": true},
            "friday": {"start": "09:00", "end": "20:00", "active": true},
            "saturday": {"start": "09:00", "end": "20:00", "active": true},
            "sunday": {"start": "10:00", "end": "15:00", "active": false}
        }'::jsonb
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'Memo Barber',
        '+573007654321',
        0.40,
        '{
            "monday": {"start": "10:00", "end": "20:00", "active": true},
            "tuesday": {"start": "10:00", "end": "20:00", "active": true},
            "wednesday": {"start": "10:00", "end": "20:00", "active": true},
            "thursday": {"start": "10:00", "end": "20:00", "active": true},
            "friday": {"start": "10:00", "end": "21:00", "active": true},
            "saturday": {"start": "09:00", "end": "21:00", "active": true},
            "sunday": {"start": "10:00", "end": "15:00", "active": false}
        }'::jsonb
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'Carlos Estilos',
        '+573119876543',
        0.40,
        '{
            "monday": {"start": "11:00", "end": "20:00", "active": true},
            "tuesday": {"start": "11:00", "end": "20:00", "active": true},
            "wednesday": {"start": "11:00", "end": "20:00", "active": true},
            "thursday": {"start": "11:00", "end": "20:00", "active": true},
            "friday": {"start": "11:00", "end": "21:00", "active": true},
            "saturday": {"start": "10:00", "end": "20:00", "active": true},
            "sunday": {"start": "10:00", "end": "16:00", "active": false}
        }'::jsonb
    )
ON CONFLICT (id) DO NOTHING;

-- 2. Insertar Servicios
INSERT INTO public.services (id, name, description, price, duration_minutes, category)
VALUES
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Corte Clásico / Fade Degradado',
        'Corte a tijera o máquina con lavado y peinado con producto premium.',
        25000,
        35,
        'corte'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'Perfilado y Arreglo de Barba',
        'Ritual de toalla caliente, vapor ozono y perfilado navaja con aceite de argán.',
        18000,
        25,
        'barba'
    ),
    (
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'Combo Barber VIP (Corte + Barba + Mascarilla)',
        'Experiencia completa: corte personalizado, diseño de barba y exfoliación facial.',
        38000,
        50,
        'combo'
    ),
    (
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'Cera / Pomada Moldeadora Premium (Producto)',
        'Fijación mate de larga duración a base de agua.',
        28000,
        5,
        'producto'
    )
ON CONFLICT (id) DO NOTHING;

-- 3. Insertar Clientes Frecuentes
INSERT INTO public.clients (id, phone, name, total_visits, tags, notes)
VALUES
    (
        '99999991-9999-9999-9999-999999999991',
        '+573105551122',
        'Andrés Felipe Gómez',
        6,
        ARRAY['vip', 'puntual', 'fade-medio']::TEXT[],
        'Le gusta el corte bien pulido en los costados y café mientras espera.'
    ),
    (
        '99999992-9999-9999-9999-999999999992',
        '+573124443355',
        'Sebastián Martínez',
        3,
        ARRAY['frecuente', 'barba-larga']::TEXT[],
        'Pide siempre toalla caliente para la barba.'
    ),
    (
        '99999993-9999-9999-9999-999999999993',
        '+573158889900',
        'David Restrepo',
        1,
        ARRAY['nuevo']::TEXT[],
        'Contactó por primera vez por el bot de WhatsApp.'
    )
ON CONFLICT (phone) DO UPDATE 
SET name = EXCLUDED.name, total_visits = EXCLUDED.total_visits;

-- 4. Insertar Citas Iniciales para Visualización en la Agenda (Hoy)
-- Nota: Usamos fechas relativas a hoy para que siempre sea visible en el Dashboard
INSERT INTO public.appointments (
    client_name, client_phone, barber_id, service_id, client_id,
    datetime, end_datetime, status, payment_method, total_amount, commission_amount, notes, source
)
VALUES
    -- Cita de Toño (Hoy 10:00 AM - Completada)
    (
        'Andrés Felipe Gómez',
        '+573105551122',
        '11111111-1111-1111-1111-111111111111',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '99999991-9999-9999-9999-999999999991',
        date_trunc('day', now()) + INTERVAL '10 hours',
        date_trunc('day', now()) + INTERVAL '10 hours 50 minutes',
        'completed',
        'card',
        38000,
        17100,
        'Pagado con tarjeta datafono',
        'whatsapp'
    ),
    -- Cita de Toño (Hoy 12:00 PM - Confirmada)
    (
        'Sebastián Martínez',
        '+573124443355',
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '99999992-9999-9999-9999-999999999992',
        date_trunc('day', now()) + INTERVAL '12 hours',
        date_trunc('day', now()) + INTERVAL '12 hours 35 minutes',
        'confirmed',
        'pending',
        25000,
        11250,
        'Confirmado por WhatsApp bot',
        'whatsapp'
    ),
    -- Cita de Memo (Hoy 11:30 AM - Apartada/Pendiente)
    (
        'David Restrepo',
        '+573158889900',
        '22222222-2222-2222-2222-222222222222',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '99999993-9999-9999-9999-999999999993',
        date_trunc('day', now()) + INTERVAL '11 hours 30 minutes',
        date_trunc('day', now()) + INTERVAL '11 hours 55 minutes',
        'pending',
        'pending',
        18000,
        7200,
        'Pendiente de re-confirmar a 2h',
        'whatsapp'
    ),
    -- Cita de Memo (Hoy 02:00 PM - No asistió)
    (
        'Juan Pablo Ruiz',
        '+573187776655',
        '22222222-2222-2222-2222-222222222222',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        NULL,
        date_trunc('day', now()) + INTERVAL '14 hours',
        date_trunc('day', now()) + INTERVAL '14 hours 35 minutes',
        'no_show',
        'pending',
        25000,
        10000,
        'No contestó el recordatorio anti-faltas',
        'whatsapp'
    ),
    -- Bloqueo de horario Toño (Hoy 04:00 PM - Bloqueada / Almuerzo / Descanso)
    (
        'Horario Bloqueado (Descanso)',
        '+573000000000',
        '11111111-1111-1111-1111-111111111111',
        NULL,
        NULL,
        date_trunc('day', now()) + INTERVAL '16 hours',
        date_trunc('day', now()) + INTERVAL '17 hours',
        'blocked',
        'pending',
        0,
        0,
        'Espacio reservado por el barbero',
        'dashboard'
    );
