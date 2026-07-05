-- ============================================================
-- NUTRISUR — Migración: columna sistema_productivo en clients
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================
-- El formulario de cliente tiene el campo "Sistema productivo"
-- pero la tabla clients no tenía la columna, así que nunca se
-- guardaba. Este script la agrega (es seguro correrlo dos veces).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sistema_productivo TEXT;

-- LISTO ✅
