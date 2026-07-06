-- ============================================================
-- NUTRISUR — Migración: frecuencia de visitas por cliente
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================
-- Permite definir cada cuántos días corresponde visitar cada
-- tambo (agenda de visitas en el inicio de la app).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS frecuencia_dias INTEGER;

-- LISTO ✅
