-- ============================================================
-- NUTRISUR — Migración: sistema de gestión del tambo
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================
-- Registra qué sistema de gestión usa cada tambo
-- (DairyComp 305, Carpeta CREA, Lechero SM, planillas...).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sistema_gestion TEXT;

-- LISTO ✅
