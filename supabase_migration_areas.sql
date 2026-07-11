-- ============================================================
-- NUTRISUR — Migración: áreas configurables por tambo
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================
-- Guarda por cliente qué áreas tiene el tambo (guachera, recría,
-- preparto, frescas, ordeñe...) y la plantilla de variables que
-- se miden en cada área de ese tambo.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS areas_config JSONB;

-- LISTO ✅
