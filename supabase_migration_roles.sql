-- ============================================================
-- NUTRISUR — Migración: Sistema de Roles (Técnico / Cliente)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Agregar columna access_code a la tabla clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

-- Índice para búsqueda rápida por código
CREATE INDEX IF NOT EXISTS idx_clients_access_code
  ON clients (access_code);

-- ============================================================
-- 2. Función RPC: Obtener cliente por código de acceso
--    Bypasa RLS para permitir acceso anónimo (sin auth)
-- ============================================================
CREATE OR REPLACE FUNCTION get_client_by_code(p_code TEXT)
RETURNS TABLE (
  id          UUID,
  nombre      TEXT,
  establecimiento TEXT,
  localidad   TEXT,
  provincia   TEXT,
  contacto    TEXT,
  email       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER   -- corre con privilegios del owner, ignora RLS
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.nombre,
    c.establecimiento,
    c.localidad,
    c.provincia,
    c.contacto,
    c.email
  FROM clients c
  WHERE c.access_code = UPPER(TRIM(p_code))
  LIMIT 1;
END;
$$;

-- ============================================================
-- 3. Función RPC: Obtener visitas por código de acceso del cliente
-- ============================================================
CREATE OR REPLACE FUNCTION get_visits_by_client_code(p_code TEXT)
RETURNS TABLE (
  id          UUID,
  client_id   UUID,
  category_id TEXT,
  fecha       DATE,
  tecnico     TEXT,
  data        JSONB,
  updated_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.client_id,
    v.category_id,
    v.fecha,
    v.tecnico,
    v.data,
    v.updated_at,
    v.created_at
  FROM visits v
  JOIN clients c ON v.client_id = c.id
  WHERE c.access_code = UPPER(TRIM(p_code))
  ORDER BY v.fecha DESC;
END;
$$;

-- ============================================================
-- 4. Permisos: permitir que el rol anon ejecute las funciones
-- ============================================================
GRANT EXECUTE ON FUNCTION get_client_by_code(TEXT)     TO anon;
GRANT EXECUTE ON FUNCTION get_visits_by_client_code(TEXT) TO anon;

-- ============================================================
-- LISTO ✅
-- Después de ejecutar este script:
--   1. Los técnicos pueden generar códigos para sus clientes
--      desde el detalle del cliente en la app.
--   2. Los clientes ingresan con su código en la pantalla
--      de login → "Soy cliente".
--   3. Los clientes ven su historial de visitas (solo lectura).
-- ============================================================
