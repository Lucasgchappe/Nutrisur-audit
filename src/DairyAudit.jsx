import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./lib/supabaseClient";


// ─── Utility helpers ───
const uid = () =>
  (globalThis.crypto?.randomUUID?.() ??
   (Date.now().toString(36) + Math.random().toString(36).slice(2)));
const today = () => new Date().toISOString().split("T")[0];
const fmt = (d) => { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// ─── Supabase tables (ajustá SOLO acá si tu tabla se llama distinto) ───
const TB_CLIENTS = "clients";
const TB_VISITS = "visits";

// ─── snake<->camel normalizers ───
const toClientUI = (row) => ({
  id: row.id ?? null,
  clientId: row.client_id ?? null,
  updatedAt: row.updated_at ?? null,
  createdAt: row.created_at ?? null,
  data: row.data ?? {},
});

const toVisitUI = (row) => ({
  id: row.id ?? null,
  clientId: row.client_id ?? null,
  categoryId: row.category_id ?? null,
  updatedAt: row.updated_at ?? null,
  createdAt: row.created_at ?? null,
  data: row.data ?? {},
});

const toClientDB = (userId, client) => ({
  id: client.id ?? undefined,
  owner_id: userId,
  client_id: client.clientId,
  data: client.data ?? {},
  updated_at: new Date().toISOString(),
});

const toVisitDB = (userId, visit) => ({
  id: visit.id ?? undefined,
  owner_id: userId,
  client_id: visit.clientId,
  category_id: visit.categoryId ?? null,
  data: visit.data ?? {},
  updated_at: new Date().toISOString(),
});

// ─── FEED INGREDIENTS DATABASE ───
const FEED_INGREDIENTS = [
  { id: "ensilaje_maiz", name: "Ensilaje de maíz", category: "Forrajes", ms_typical: 33 },
  { id: "ensilaje_alfalfa", name: "Ensilaje de alfalfa", category: "Forrajes", ms_typical: 35 },
  { id: "ensilaje_raigrass", name: "Ensilaje de raigrás", category: "Forrajes", ms_typical: 30 },
  { id: "ensilaje_sorgo", name: "Ensilaje de sorgo", category: "Forrajes", ms_typical: 30 },
  { id: "ensilaje_avena", name: "Ensilaje de avena", category: "Forrajes", ms_typical: 28 },
  { id: "ensilaje_cebada", name: "Ensilaje de cebada", category: "Forrajes", ms_typical: 32 },
  { id: "heno_alfalfa", name: "Heno de alfalfa", category: "Forrajes", ms_typical: 88 },
  { id: "heno_raigrass", name: "Heno de raigrás", category: "Forrajes", ms_typical: 87 },
  { id: "rollo_alfalfa", name: "Rollo de alfalfa", category: "Forrajes", ms_typical: 85 },
  { id: "rollo_moha", name: "Rollo de moha", category: "Forrajes", ms_typical: 86 },
  { id: "paja_trigo", name: "Paja de trigo", category: "Forrajes", ms_typical: 90 },
  { id: "paja_cebada", name: "Paja de cebada", category: "Forrajes", ms_typical: 89 },
  { id: "fardo_trigo", name: "Fardo de trigo", category: "Forrajes", ms_typical: 88 },
  { id: "fardo_alfalfa", name: "Fardo de alfalfa", category: "Forrajes", ms_typical: 87 },
  { id: "pastura_base_alfalfa", name: "Pastura base alfalfa", category: "Forrajes", ms_typical: 22 },
  { id: "pastura_raigrass", name: "Pastura raigrás", category: "Forrajes", ms_typical: 18 },
  { id: "verdeo_avena", name: "Verdeo de avena", category: "Forrajes", ms_typical: 16 },
  { id: "verdeo_raigrass", name: "Verdeo de raigrás", category: "Forrajes", ms_typical: 17 },
  { id: "grano_maiz", name: "Grano de maíz", category: "Energéticos", ms_typical: 87 },
  { id: "grano_maiz_humedo", name: "Grano de maíz húmedo", category: "Energéticos", ms_typical: 72 },
  { id: "grano_cebada", name: "Grano de cebada", category: "Energéticos", ms_typical: 88 },
  { id: "grano_sorgo", name: "Grano de sorgo", category: "Energéticos", ms_typical: 87 },
  { id: "grano_avena", name: "Grano de avena", category: "Energéticos", ms_typical: 89 },
  { id: "grano_trigo", name: "Grano de trigo", category: "Energéticos", ms_typical: 88 },
  { id: "afrechillo_trigo", name: "Afrechillo de trigo", category: "Energéticos", ms_typical: 88 },
  { id: "semilla_algodon", name: "Semilla de algodón", category: "Energéticos", ms_typical: 91 },
  { id: "cascarilla_soja", name: "Cascarilla de soja", category: "Energéticos", ms_typical: 90 },
  { id: "melaza", name: "Melaza", category: "Energéticos", ms_typical: 75 },
  { id: "glicerina", name: "Glicerina", category: "Energéticos", ms_typical: 84 },
  { id: "ddgs", name: "DDGS (burlanda seca)", category: "Proteicos", ms_typical: 90 },
  { id: "wdgs", name: "WDGS (burlanda húmeda)", category: "Proteicos", ms_typical: 35 },
  { id: "harina_soja", name: "Harina de soja", category: "Proteicos", ms_typical: 89 },
  { id: "expeller_soja", name: "Expeller de soja", category: "Proteicos", ms_typical: 90 },
  { id: "pellet_girasol", name: "Pellet de girasol", category: "Proteicos", ms_typical: 91 },
  { id: "expeller_girasol", name: "Expeller de girasol", category: "Proteicos", ms_typical: 92 },
  { id: "harina_canola", name: "Harina de canola", category: "Proteicos", ms_typical: 90 },
  { id: "poroto_soja_crudo", name: "Poroto de soja crudo", category: "Proteicos", ms_typical: 90 },
  { id: "poroto_soja_desactivado", name: "Poroto de soja desactivado", category: "Proteicos", ms_typical: 91 },
  { id: "urea", name: "Urea", category: "Proteicos", ms_typical: 99 },
  { id: "bicarb_sodio", name: "Bicarbonato de sodio", category: "Aditivos/Minerales", ms_typical: 99 },
  { id: "oxido_magnesio", name: "Óxido de magnesio", category: "Aditivos/Minerales", ms_typical: 99 },
  { id: "sal", name: "Sal", category: "Aditivos/Minerales", ms_typical: 99 },
  { id: "premezcla_mineral", name: "Premezcla mineral", category: "Aditivos/Minerales", ms_typical: 95 },
  { id: "premezcla_vitaminica", name: "Premezcla vitamínica", category: "Aditivos/Minerales", ms_typical: 95 },
  { id: "monensina", name: "Monensina/Ionóforo", category: "Aditivos/Minerales", ms_typical: 95 },
  { id: "levadura", name: "Levadura", category: "Aditivos/Minerales", ms_typical: 95 },
  { id: "grasa_bypass", name: "Grasa bypass", category: "Aditivos/Minerales", ms_typical: 97 },
  { id: "metionina_protegida", name: "Metionina protegida", category: "Aditivos/Minerales", ms_typical: 95 },
  { id: "lisina_protegida", name: "Lisina protegida", category: "Aditivos/Minerales", ms_typical: 95 },
  { id: "sales_anionicas", name: "Sales aniónicas", category: "Aditivos/Minerales", ms_typical: 95 },
  { id: "calcite", name: "Calcita / Calite", category: "Aditivos/Minerales", ms_typical: 99 },
  { id: "fosfato_dicalcico", name: "Fosfato dicálcico", category: "Aditivos/Minerales", ms_typical: 99 },
];

const FEED_CATEGORIES_ORDER = ["Forrajes", "Energéticos", "Proteicos", "Aditivos/Minerales"];

// ─── Icons ───
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const icons = {
    home: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />,
    users: <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
    clipboard: <path d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
    plus: <path d="M12 4v16m8-8H4" />,
    download: <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
    logout: <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
    back: <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />,
    edit: <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
    trash: <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
    cow: <path d="M12 2C8 2 4 6 4 10c0 2 1 4 3 5v5h2v-4h6v4h2v-5c2-1 3-3 3-5 0-4-4-8-8-8zm-3 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />,
    chart: <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
    search: <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
    eye: <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
    check: <path d="M5 13l4 4L19 7" />,
    save: <path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />,
    x: <path d="M6 18L18 6M6 6l12 12" />,
    chevDown: <path d="M19 9l-7 7-7-7" />,
    thermo: <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />,
    wind: <path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />,
    sun: <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 6a6 6 0 100 12 6 6 0 000-12z" />,
    layers: <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
      filter: <path d="M3 4h18l-7 8v5l-4 2V12L3 4z" />,
    calendar: <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
    compare: <path d="M9 5l7 7-7 7" />,
};
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>);
};

// ─── Styles ───
const C = {
  bg: "#F1F5F9", card: "#FFFFFF", primary: "#1565C0", primaryLight: "#1E88E5", primaryDark: "#0D47A1",
  accent: "#E76F51", accentLight: "#F4A261", text: "#0F1D2E", textLight: "#64748B",
  border: "#CBD5E1", borderLight: "#E2EAF2", success: "#15803D", warning: "#D97706",
  danger: "#B91C1C", inputBg: "#F8FAFC",
};
const ff = "'Inter', system-ui, -apple-system, sans-serif";
const ffSerif = "'Playfair Display', Georgia, serif";

// ─── Base Components ───
const Btn = ({ children, onClick, variant = "primary", size = "md", icon, disabled, style: sx, ...r }) => {
  const vars = {
    primary: { bg: C.primary, c: "#fff", h: C.primaryLight },
    accent: { bg: C.accent, c: "#fff", h: "#d45a3e" },
    outline: { bg: "transparent", c: C.primary, h: C.borderLight, bd: `1.5px solid ${C.primary}` },
    ghost: { bg: "transparent", c: C.textLight, h: C.borderLight },
    danger: { bg: C.danger, c: "#fff", h: "#c94a35" },
    success: { bg: C.success, c: "#fff", h: "#3a7d5c" },
  };
  const v = vars[variant]; const sizes = { sm: { px: 10, py: 5, fs: 13 }, md: { px: 16, py: 8, fs: 14 }, lg: { px: 24, py: 12, fs: 16 } };
  const s = sizes[size]; const [hov, setHov] = useState(false);
  return (<button onClick={onClick} disabled={disabled} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: `${s.py}px ${s.px}px`, fontSize: s.fs, fontWeight: 600, fontFamily: ff, background: hov && !disabled ? v.h : v.bg, color: v.c, border: v.bd || "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "all 0.2s", whiteSpace: "nowrap", ...sx }} {...r}>{icon && <Icon name={icon} size={s.fs + 2} />}{children}</button>);
};

const Card = ({ children, style: sx, onClick }) => {
  const [hov, setHov] = useState(false);
  return (<div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.borderLight}`, boxShadow: onClick && hov ? "0 4px 12px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)", cursor: onClick ? "pointer" : "default", transform: onClick && hov ? "translateY(-1px)" : "none", transition: "all 0.2s", ...sx }}>{children}</div>);
};

const Badge = ({ children, color = C.primary }) => (<span style={{ display: "inline-block", padding: "2px 10px", fontSize: 12, fontWeight: 600, borderRadius: 20, background: color + "18", color }}>{children}</span>);

const inputStyle = { width: "100%", padding: "10px 12px", fontSize: 14, fontFamily: ff, border: `1.5px solid ${C.borderLight}`, borderRadius: 8, background: C.inputBg, color: C.text, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" };

// ═══════════════════════════════════════════════════
// 3) CALIDAD DE CAMA — Protocolo estandarizado
// ═══════════════════════════════════════════════════
const CALIDAD_CAMA_SECTIONS = [
  { id: "cama_medicion", title: "3.1 Medición directa (puntos definidos)", subtitle: "Temperatura, humedad y profundidad — mín. 5 puntos por corral", customComponent: "bedding", fields: [] },
  { id: "cama_rutina", title: "3.2 Rutina de mantenimiento (real vs planificada)", subtitle: "Agregado, raspado, aireado, reposición", fields: [
    { id: "cama_tipo", label: "Tipo de cama", type: "select", options: ["Compost (cama caliente)", "Arena", "Paja", "Aserrín/Viruta", "Cal + paja", "Tierra", "Otro"] },
    { id: "cama_freq_agregado", label: "Frecuencia agregado de cama", type: "select", options: ["Diario", "2-3x/semana", "Semanal", "Quincenal", "Irregular"] },
    { id: "cama_freq_plan", label: "Frecuencia planificada", type: "select", options: ["Diario", "2-3x/semana", "Semanal", "Quincenal", "No definida"] },
    { id: "cama_cumplimiento", label: "Cumplimiento del plan", type: "select", options: ["100% cumplimiento", "Parcial (>70%)", "Bajo (<70%)", "No hay plan"] },
    { id: "cama_raspado", label: "Raspado / limpieza", type: "select", options: ["Diario", "2-3x/semana", "Semanal", "No se hace"] },
    { id: "cama_aireado", label: "Aireado / rotovador", type: "select", options: ["Diario", "2-3x/semana", "Semanal", "No se hace", "No aplica"] },
    { id: "cama_reposicion", label: "Última reposición total/parcial", type: "text", placeholder: "Ej: Hace 3 meses, parcial" },
    { id: "cama_uniformidad", label: "Uniformidad de cama", type: "select", options: ["Uniforme", "Zonas desiguales", "Zonas muertas/compactadas", "Muy irregular"] },
    { id: "cama_compactacion", label: "Compactación", type: "select", options: ["Suelta/esponjosa", "Moderada", "Compactada", "Muy compactada"] },
    { id: "cama_obs_rutina", label: "Observaciones de rutina", type: "textarea", placeholder: "Zonas muertas, acumulación, problemas..." },
  ]},
  { id: "cama_ventilacion", title: "3.3 Circulación de aire / ventilación", subtitle: "Velocidad de aire, checklist ventiladores", fields: [
    { id: "cama_vel_aire", label: "Velocidad aire a altura de vaca (m/s)", type: "number", placeholder: "Ej: 2.0", unit: "m/s", step: "0.1" },
    { id: "cama_vel_puntos", label: "N° puntos medidos", type: "number", placeholder: "5" },
    { id: "cama_vel_rango", label: "Rango de velocidad medida", type: "text", placeholder: "Ej: 0.8 - 2.5 m/s" },
    { id: "cama_vent_total", label: "N° ventiladores total", type: "number", placeholder: "8" },
    { id: "cama_vent_func", label: "N° ventiladores funcionando", type: "number", placeholder: "7" },
    { id: "cama_vent_pct", label: "% funcionando", type: "number", placeholder: "87.5", unit: "%" },
    { id: "cama_vent_limpieza", label: "Limpieza de ventiladores", type: "select", options: ["Limpios", "Algo de polvo", "Sucios", "Muy sucios"] },
    { id: "cama_vent_orientacion", label: "Orientación / cobertura", type: "select", options: ["Correcta, buena cobertura", "Parcialmente correcta", "Incorrecta / mala cobertura"] },
    { id: "cama_vent_ruido", label: "Vibración / ruido anormal", type: "select", options: ["Sin problemas", "Algo de vibración", "Vibración/ruido significativo"] },
    { id: "cama_vent_obs", label: "Observaciones ventilación", type: "textarea", placeholder: "Zonas sin cobertura, problemas eléctricos..." },
  ]},
  { id: "cama_indicador", title: "3.4 Indicador animal — Puntaje de limpieza", subtitle: "Score 1-5 en ubre, patas y flanco (~20 vacas/lote)", customComponent: "cleanliness", fields: [] },
  { id: "cama_materiales", title: "3.5 Materiales y equipamiento", subtitle: "Termómetro, anemómetro, estado de equipos", fields: [
    { id: "cama_mat_termometro", label: "Termómetro sonda disponible", type: "select", options: ["Sí, calibrado", "Sí, sin calibrar", "No disponible"] },
    { id: "cama_mat_anemometro", label: "Anemómetro disponible", type: "select", options: ["Sí", "No"] },
    { id: "cama_mat_obs", label: "Observaciones equipamiento", type: "textarea", placeholder: "Estado, necesidades..." },
  ]},
  { id: "cama_plan", title: "3.6 Observaciones y Plan", subtitle: "Hallazgos y acciones", fields: [
    { id: "cama_hallazgos", label: "Principales hallazgos", type: "textarea", rows: 4 },
    { id: "cama_acciones", label: "Acciones priorizadas", type: "textarea", rows: 3 },
    { id: "cama_responsables", label: "Responsables y plazos", type: "textarea", rows: 2 },
  ]},
];

// ═══════════════════════════════════════════════════
// 4+5) CALIDAD ALIMENTO / PROCESAMIENTO GRANO
// ═══════════════════════════════════════════════════
const CALIDAD_ALIMENTO_SECTIONS = [
  { id: "ali_ensilaje", title: "4. Calidad de ensilajes y reservas", subtitle: "Análisis composición, micotoxinas, distribución de partículas", fields: [
    { id: "ali_tipo_ensilaje", label: "Tipo de ensilaje evaluado", type: "text", placeholder: "Ej: Ensilaje de maíz, silo bolsa #3" },
    { id: "ali_ms_ensilaje", label: "%MS del ensilaje", type: "number", placeholder: "33", unit: "%" },
    { id: "ali_ph_ensilaje", label: "pH del ensilaje", type: "number", placeholder: "3.8", step: "0.1" },
    { id: "ali_analisis", label: "Análisis de composición", type: "select", options: ["Completo reciente (<30 días)", "Parcial", "Desactualizado (>60 días)", "No se hizo"] },
    { id: "ali_micotoxinas", label: "Análisis de micotoxinas", type: "select", options: ["Realizado, sin problemas", "Realizado, con detección", "No realizado", "No corresponde"] },
    { id: "ali_micotoxinas_det", label: "Detalle micotoxinas (si aplica)", type: "textarea", placeholder: "Tipo, nivel, acción tomada..." },
    { id: "ali_cortado", label: "Distribución de partículas (ajuste de cortado)", type: "select", options: ["Adecuada", "Partículas muy largas", "Partículas muy cortas", "Irregular", "No evaluada"] },
    { id: "ali_grano_roto", label: "% granos rotos en ensilaje (evaluación campo)", type: "number", placeholder: "70", unit: "%" },
    { id: "ali_altura_picado", label: "Altura de picado (cm)", type: "number", placeholder: "35", unit: "cm" },
  ]},
  { id: "ali_bunker", title: "4b. Auditoría de bunker/silo (opcional)", subtitle: "Compactación, cara, pérdidas visibles", fields: [
    { id: "ali_bunker_tipo", label: "Tipo de almacenaje", type: "select", options: ["Bunker", "Silo bolsa", "Puente", "Pila", "Otro"] },
    { id: "ali_bunker_cara", label: "Estado de la cara del silo", type: "select", options: ["Lisa, sin calentamiento", "Algo irregular", "Cara floja/caliente", "Deteriorada/mohosa"] },
    { id: "ali_bunker_compact", label: "Compactación", type: "select", options: ["Buena (>250 kg MS/m³)", "Aceptable (200-250)", "Baja (<200)", "No evaluada"] },
    { id: "ali_bunker_perdidas", label: "Pérdidas visibles", type: "select", options: ["Mínimas (<5%)", "Moderadas (5-15%)", "Altas (>15%)"] },
    { id: "ali_bunker_cobertura", label: "Cobertura/sellado", type: "select", options: ["Doble lona + pesos", "Lona simple", "Parcial", "Sin cobertura"] },
    { id: "ali_bunker_obs", label: "Observaciones bunker", type: "textarea", placeholder: "Olor, color, presencia de moho..." },
  ]},
  { id: "ali_grano", title: "5. Procesamiento de grano — Método 5 bandejas", subtitle: "Evaluación de calidad de procesamiento y MPS", customComponent: "grain", fields: [
    { id: "ali_grano_tipo", label: "Tipo de grano evaluado", type: "text", placeholder: "Ej: Maíz seco molido" },
    { id: "ali_grano_metodo", label: "Método de procesamiento", type: "select", options: ["Molido (martillo)", "Rolado seco", "Rolado húmedo (steam flake)", "Partido", "Entero", "Otro"] },
    { id: "ali_grano_estado_equipo", label: "Estado del equipo (martillo/rolo/cuchillas)", type: "select", options: ["Bueno, recién revisado", "Aceptable", "Necesita mantenimiento", "Deteriorado"] },
  ]},
  { id: "ali_plan", title: "Observaciones y Plan", subtitle: "Hallazgos y acciones", fields: [
    { id: "ali_hallazgos", label: "Principales hallazgos", type: "textarea", rows: 4 },
    { id: "ali_acciones", label: "Acciones priorizadas", type: "textarea", rows: 3 },
    { id: "ali_responsables", label: "Responsables y plazos", type: "textarea", rows: 2 },
  ]},
];

// ═══════════════════════════════════════════════════
// 6) VERANO / ESTRÉS CALÓRICO
// ═══════════════════════════════════════════════════
const ESTRES_CALORICO_SECTIONS = [
  { id: "ec_ith", title: "6.1 Indicadores de estrés calórico (ITH/THI)", subtitle: "Temperatura, humedad, índice ITH y evaluación de impacto", fields: [
    { id: "ec_temp_amb", label: "Temperatura ambiente (°C)", type: "number", placeholder: "32", unit: "°C" },
    { id: "ec_humedad", label: "Humedad relativa (%)", type: "number", placeholder: "65", unit: "%" },
    { id: "ec_ith", label: "ITH calculado", type: "number", placeholder: "78" },
    { id: "ec_ith_nivel", label: "Nivel de estrés", type: "select", options: ["Sin estrés (ITH <68)", "Leve (68-72)", "Moderado (72-80)", "Severo (80-90)", "Emergencia (>90)"] },
    { id: "ec_hora_medicion", label: "Hora de medición", type: "text", placeholder: "Ej: 14:30" },
    { id: "ec_temp_min", label: "Temperatura mínima nocturna (°C)", type: "number", placeholder: "22", unit: "°C" },
    { id: "ec_obs_ith", label: "Observaciones clima", type: "textarea", placeholder: "Pronóstico, días consecutivos de calor..." },
  ]},
  { id: "ec_rutina", title: "6.2 Rutina de refrigeración", subtitle: "Encendido, horarios, secuencias", fields: [
    { id: "ec_rutina_horario", label: "Horario de encendido ventiladores", type: "text", placeholder: "Ej: 8:00-20:00 o 24h" },
    { id: "ec_rutina_auto", label: "Encendido automático (termostato)", type: "select", options: ["Sí, automático", "Manual", "Parcialmente automático"] },
    { id: "ec_rutina_secuencia", label: "Secuencia ventiladores + aspersores", type: "textarea", placeholder: "Ciclos de aspersión, secuencia, tiempos..." },
    { id: "ec_rutina_cumplimiento", label: "Cumplimiento de la rutina", type: "select", options: ["Total", "Parcial", "Bajo", "No hay rutina definida"] },
  ]},
  { id: "ec_equipos", title: "6.3 Ventiladores y aspersores", subtitle: "Funcionamiento, cobertura, mantenimiento", fields: [
    { id: "ec_vent_n", label: "N° ventiladores", type: "number", placeholder: "12" },
    { id: "ec_vent_func", label: "N° funcionando", type: "number", placeholder: "10" },
    { id: "ec_vent_pct", label: "% funcionando", type: "number", placeholder: "83", unit: "%" },
    { id: "ec_vent_cobertura", label: "Cobertura", type: "select", options: ["Total (>90%)", "Buena (70-90%)", "Parcial (50-70%)", "Baja (<50%)"] },
    { id: "ec_vent_mant", label: "Estado mantenimiento", type: "select", options: ["Óptimo", "Aceptable", "Necesita mantenimiento", "Malo"] },
    { id: "ec_asp_n", label: "N° aspersores/soakers", type: "number", placeholder: "8" },
    { id: "ec_asp_func", label: "N° aspersores funcionando", type: "number", placeholder: "7" },
    { id: "ec_asp_cobertura", label: "Cobertura aspersión", type: "select", options: ["Uniforme", "Parcial", "Insuficiente"] },
    { id: "ec_asp_gota", label: "Tamaño de gota", type: "select", options: ["Gruesa (correcto)", "Fina/niebla (evitar)", "Variable"] },
    { id: "ec_obs_equipos", label: "Observaciones equipos", type: "textarea", placeholder: "Problemas eléctricos, presión agua, suciedad..." },
  ]},
  { id: "ec_agua", title: "6.4 Bebederos en verano", subtitle: "Ubicación, caudal, limpieza, acceso bajo estrés", fields: [
    { id: "ec_agua_n", label: "N° bebederos", type: "number", placeholder: "4" },
    { id: "ec_agua_caudal", label: "Caudal suficiente", type: "select", options: ["Sí, se recupera rápido", "Algo lento", "Insuficiente"] },
    { id: "ec_agua_temp", label: "Temperatura del agua", type: "select", options: ["Fresca", "Templada", "Caliente"] },
    { id: "ec_agua_sombra", label: "Bebederos a la sombra", type: "select", options: ["Todos", "Parcialmente", "Ninguno"] },
    { id: "ec_agua_acceso", label: "Acceso (competencia)", type: "select", options: ["Sin competencia", "Algo de competencia", "Competencia significativa"] },
    { id: "ec_agua_limpieza", label: "Limpieza", type: "select", options: ["Limpia", "Aceptable", "Sucia", "Muy sucia / algas"] },
  ]},
  { id: "ec_dieta", title: "6.5 Ajustes de dieta por calor", subtitle: "%MS, push-up, horarios, consistencia", fields: [
    { id: "ec_dieta_ms", label: "%MS actual del TMR", type: "number", placeholder: "50", unit: "%" },
    { id: "ec_dieta_ajuste", label: "¿Se ajustó dieta por calor?", type: "select", options: ["Sí, ajuste completo", "Ajuste parcial", "No se ajustó", "No necesario"] },
    { id: "ec_dieta_pushup", label: "Frecuencia de push-up", type: "select", options: ["Cada 1-2h", "Cada 2-4h", ">4h", "No se empuja"] },
    { id: "ec_dieta_horarios", label: "Horarios de entrega (ajustados)", type: "text", placeholder: "Ej: 5:00 (60%), 20:00 (40%)" },
    { id: "ec_dieta_obs", label: "Observaciones dieta verano", type: "textarea", placeholder: "Cambios realizados, aditivos, agua en TMR..." },
  ]},
  { id: "ec_animales", title: "6.6 Evaluación de animales", subtitle: "Signos visibles de estrés calórico, % jadeo", fields: [
    { id: "ec_anim_n_eval", label: "N° vacas evaluadas", type: "number", placeholder: "30" },
    { id: "ec_anim_jadeo_pct", label: "% vacas jadeando", type: "number", placeholder: "20", unit: "%" },
    { id: "ec_anim_jadeo_score", label: "Score de jadeo predominante", type: "select", options: ["0 - Sin jadeo", "1 - Respiración levemente elevada", "2 - Jadeo, boca cerrada, babeo", "3 - Jadeo, boca abierta, babeo excesivo", "4 - Jadeo severo, lengua afuera, cabeza extendida"] },
    { id: "ec_anim_agrupamiento", label: "Agrupamiento / hacinamiento", type: "select", options: ["Normal", "Algo de agrupamiento", "Agrupamiento significativo en sombra", "Hacinamiento severo"] },
    { id: "ec_anim_echadas", label: "% vacas echadas (obs. 10-14h)", type: "number", placeholder: "30", unit: "%" },
    { id: "ec_anim_agua", label: "Competencia en bebederos", type: "select", options: ["Normal", "Algo de cola", "Cola significativa", "Competencia agresiva"] },
    { id: "ec_anim_obs", label: "Observaciones animales", type: "textarea", placeholder: "Vacas problema, signos clínicos..." },
  ]},
  { id: "ec_impacto", title: "6.7 Impacto productivo", subtitle: "Cambios en leche, reproducción, salud", fields: [
    { id: "ec_imp_leche_baja", label: "Caída de producción estimada (%)", type: "number", placeholder: "10", unit: "%" },
    { id: "ec_imp_cms_baja", label: "Caída de CMS estimada (%)", type: "number", placeholder: "15", unit: "%" },
    { id: "ec_imp_repro", label: "Impacto reproductivo", type: "select", options: ["Sin impacto aparente", "Baja en tasa de preñez", "Mortalidad embrionaria", "Significativo"] },
    { id: "ec_imp_salud", label: "Problemas de salud asociados", type: "textarea", placeholder: "Laminitis, mastitis, acidosis..." },
  ]},
  { id: "ec_plan", title: "6.8 Plan de Acción Verano", subtitle: "Hallazgos, prioridades, inversiones", fields: [
    { id: "ec_hallazgos", label: "Principales hallazgos", type: "textarea", rows: 4 },
    { id: "ec_acciones", label: "Acciones priorizadas", type: "textarea", rows: 3 },
    { id: "ec_inversiones", label: "Inversiones recomendadas", type: "textarea", placeholder: "Más ventiladores, aspersores, sombra..." },
    { id: "ec_responsables", label: "Responsables y plazos", type: "textarea", rows: 2 },
  ]},
];


// ═══════════════════════════════════════════════════
// INGREDIENT SELECTOR COMPONENT
// ═══════════════════════════════════════════════════
const IngredientSelector = ({ value = [], onChange, readOnly }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [filterCat, setFilterCat] = useState("Todos");
  const [filterText, setFilterText] = useState("");

  const addIngredient = (ing) => {
    if (value.find(v => v.id === ing.id)) return;
    onChange([...value, { id: ing.id, name: ing.name, kg_tal_cual: "", kg_ms: "", ms_pct: ing.ms_typical, category: ing.category }]);
  };

  const removeIngredient = (id) => onChange(value.filter(v => v.id !== id));

  const updateIngredient = (id, field, val) => {
    onChange(value.map(v => {
      if (v.id !== id) return v;
      const updated = { ...v, [field]: val };
      if (field === "kg_tal_cual" && updated.ms_pct) {
        updated.kg_ms = round(parseFloat(val || 0) * parseFloat(updated.ms_pct || 0) / 100, 2) || "";
      }
      if (field === "ms_pct" && updated.kg_tal_cual) {
        updated.kg_ms = round(parseFloat(updated.kg_tal_cual || 0) * parseFloat(val || 0) / 100, 2) || "";
      }
      if (field === "kg_ms" && updated.ms_pct) {
        updated.kg_tal_cual = round(parseFloat(val || 0) / (parseFloat(updated.ms_pct || 1) / 100), 2) || "";
      }
      return updated;
    }));
  };

  const totalTalCual = value.reduce((s, v) => s + (parseFloat(v.kg_tal_cual) || 0), 0);
  const totalMS = value.reduce((s, v) => s + (parseFloat(v.kg_ms) || 0), 0);
  const pctMS = totalTalCual > 0 ? round(totalMS / totalTalCual * 100, 1) : 0;

  const filtered = FEED_INGREDIENTS.filter(i => {
    if (filterCat !== "Todos" && i.category !== filterCat) return false;
    if (filterText && !i.name.toLowerCase().includes(filterText.toLowerCase())) return false;
    return true;
  });

  const grouped = FEED_CATEGORIES_ORDER.map(cat => ({
    cat,
    items: filtered.filter(i => i.category === cat),
  })).filter(g => g.items.length > 0);

  if (readOnly) {
    if (!value.length) return <div style={{ color: C.textLight, fontStyle: "italic", padding: 8 }}>— Sin ingredientes cargados —</div>;
    return (
      <div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.primary + "10" }}>
                <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.text }}>Ingrediente</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: C.text }}>kg Tal Cual</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: C.text }}>%MS</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: C.text }}>kg MS</th>
              </tr>
            </thead>
            <tbody>
              {value.map(v => (
                <tr key={v.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                  <td style={{ padding: "6px 10px" }}>{v.name}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>{v.kg_tal_cual || "—"}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>{v.ms_pct}%</td>
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>{v.kg_ms || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: C.primary + "08", fontWeight: 700 }}>
                <td style={{ padding: "8px 10px" }}>TOTAL</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{round(totalTalCual, 1)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{pctMS}%</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>{round(totalMS, 1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Current ingredients table */}
      {value.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.primary + "10" }}>
                <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Ingrediente</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, width: 100 }}>kg Tal Cual</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, width: 80 }}>%MS</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, width: 90 }}>kg MS</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {value.map(v => (
                <tr key={v.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                  <td style={{ padding: "4px 10px" }}>
                    <span style={{ fontSize: 13 }}>{v.name}</span>
                    <span style={{ fontSize: 11, color: C.textLight, marginLeft: 6 }}>{v.category}</span>
                  </td>
                  <td style={{ padding: "4px 4px" }}>
                    <input type="number" step="0.1" value={v.kg_tal_cual} onChange={e => updateIngredient(v.id, "kg_tal_cual", e.target.value)} placeholder="0.0" style={{ ...inputStyle, padding: "6px 8px", fontSize: 13, textAlign: "right", width: "100%" }} />
                  </td>
                  <td style={{ padding: "4px 4px" }}>
                    <input type="number" step="1" value={v.ms_pct} onChange={e => updateIngredient(v.id, "ms_pct", e.target.value)} style={{ ...inputStyle, padding: "6px 8px", fontSize: 13, textAlign: "right", width: "100%" }} />
                  </td>
                  <td style={{ padding: "4px 4px" }}>
                    <input type="number" step="0.1" value={v.kg_ms} onChange={e => updateIngredient(v.id, "kg_ms", e.target.value)} placeholder="0.0" style={{ ...inputStyle, padding: "6px 8px", fontSize: 13, textAlign: "right", width: "100%", background: "#f0fdf4" }} />
                  </td>
                  <td style={{ padding: "4px 4px" }}>
                    <button onClick={() => removeIngredient(v.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}>
                      <Icon name="x" size={16} color={C.danger} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: C.primary + "08", fontWeight: 700, fontSize: 13 }}>
                <td style={{ padding: "8px 10px" }}>TOTAL</td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>{round(totalTalCual, 1)} kg</td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>{pctMS}%</td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>{round(totalMS, 1)} kg</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add ingredient button/panel */}
      {!showAdd ? (
        <Btn variant="outline" size="sm" icon="plus" onClick={() => setShowAdd(true)}>Agregar ingrediente</Btn>
      ) : (
        <div style={{ border: `1.5px solid ${C.primary}30`, borderRadius: 10, padding: 14, background: C.primary + "05" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Seleccionar ingrediente</span>
            <button onClick={() => { setShowAdd(false); setFilterText(""); }} style={{ background: "none", border: "none", cursor: "pointer" }}><Icon name="x" size={18} color={C.textLight} /></button>
          </div>
          <input type="text" placeholder="Buscar ingrediente..." value={filterText} onChange={e => setFilterText(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} autoFocus />
          <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
            {["Todos", ...FEED_CATEGORIES_ORDER].map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)} style={{
                padding: "4px 10px", fontSize: 12, fontWeight: 600, fontFamily: ff, borderRadius: 16, border: "none", cursor: "pointer",
                background: filterCat === cat ? C.primary : C.borderLight, color: filterCat === cat ? "#fff" : C.text, transition: "all 0.15s",
              }}>{cat}</button>
            ))}
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto", border: `1px solid ${C.borderLight}`, borderRadius: 8, background: "#fff" }}>
            {grouped.map(g => (
              <div key={g.cat}>
                <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 700, color: C.textLight, background: C.bg, textTransform: "uppercase", letterSpacing: 0.5, position: "sticky", top: 0 }}>{g.cat}</div>
                {g.items.map(i => {
                  const added = value.find(v => v.id === i.id);
                  return (
                    <div key={i.id} onClick={() => !added && addIngredient(i)} style={{
                      padding: "8px 12px", cursor: added ? "default" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                      borderBottom: `1px solid ${C.borderLight}`, background: added ? C.primary + "08" : "transparent", opacity: added ? 0.6 : 1,
                    }}>
                      <span style={{ fontSize: 13 }}>{i.name}</span>
                      <span style={{ fontSize: 12, color: C.textLight }}>{added ? "✓ Agregado" : `MS ~${i.ms_typical}%`}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            {grouped.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.textLight, fontSize: 13 }}>No se encontraron ingredientes</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════
// PENN STATE WITH INICIO/MEDIO/FINAL + AUTO VARIATION
// ═══════════════════════════════════════════════════
const PennStateWidget = ({ value = {}, onChange, readOnly }) => {
  const trays = [
    { id: "sup", label: "Bandeja superior (>19mm)", unit: "%" },
    { id: "med", label: "Bandeja media (8-19mm)", unit: "%" },
    { id: "inf", label: "Bandeja inferior (1.18-8mm)", unit: "%" },
    { id: "fondo", label: "Fondo (<1.18mm)", unit: "%" },
  ];
  const positions = [
    { id: "inicio", label: "Inicio comedero" },
    { id: "medio", label: "Medio comedero" },
    { id: "final", label: "Final comedero" },
  ];

  const handleChange = (tray, pos, val) => {
    const newVal = { ...value, [`${tray}_${pos}`]: val };
    // Calculate averages and variation for each tray
    trays.forEach(t => {
      const vals = positions.map(p => parseFloat(newVal[`${t.id}_${p.id}`]) || 0).filter(v => v > 0);
      if (vals.length > 0) {
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        newVal[`${t.id}_avg`] = round(avg, 1);
        newVal[`${t.id}_var`] = round(max - min, 1);
        newVal[`${t.id}_cv`] = avg > 0 ? round((Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length) / avg) * 100, 1) : 0;
      }
    });
    onChange(newVal);
  };

  const inp = (tray, pos) => (
    readOnly
      ? <span style={{ fontSize: 13 }}>{value[`${tray}_${pos}`] || "—"}</span>
      : <input type="number" step="0.1" value={value[`${tray}_${pos}`] || ""} onChange={e => handleChange(tray, pos, e.target.value)} placeholder="%" style={{ ...inputStyle, padding: "6px 8px", fontSize: 13, textAlign: "center", width: 70 }} />
  );

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.primary + "10" }}>
              <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 600 }}>Bandeja</th>
              {positions.map(p => <th key={p.id} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, minWidth: 80 }}>{p.label}</th>)}
              <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, background: C.primary + "15", minWidth: 65 }}>Prom.</th>
              <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, background: C.warning + "25", minWidth: 65 }}>Var.</th>
              <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, background: C.accent + "15", minWidth: 55 }}>CV%</th>
            </tr>
          </thead>
          <tbody>
            {trays.map(t => {
              const variation = parseFloat(value[`${t.id}_var`]) || 0;
              const varColor = variation > 5 ? C.danger : variation > 3 ? C.warning : C.success;
              return (
                <tr key={t.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                  <td style={{ padding: "6px 8px", fontWeight: 500, fontSize: 12 }}>{t.label}</td>
                  {positions.map(p => <td key={p.id} style={{ padding: "4px 4px", textAlign: "center" }}>{inp(t.id, p.id)}</td>)}
                  <td style={{ padding: "6px 6px", textAlign: "center", fontWeight: 700, background: C.primary + "08" }}>{value[`${t.id}_avg`] || "—"}%</td>
                  <td style={{ padding: "6px 6px", textAlign: "center", fontWeight: 700, color: varColor, background: C.warning + "08" }}>{value[`${t.id}_var`] || "—"}%</td>
                  <td style={{ padding: "6px 6px", textAlign: "center", fontWeight: 600, fontSize: 12, color: C.textLight, background: C.accent + "05" }}>{value[`${t.id}_cv`] || "—"}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: "#fffbe6", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
          💡 <b>Tip:</b> Variación &gt;5% indica sorting significativo. Cargá inicio, medio y final del comedero y los promedios, variación y CV se calculan solos.
        </div>
      )}
      {/* Sorting select + observations */}
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Evidencia de sorting</label>
        {readOnly
          ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, fontSize: 14, border: `1px solid ${C.borderLight}` }}>{value.sorting || "—"}</div>
          : <select value={value.sorting || ""} onChange={e => onChange({ ...value, sorting: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">— Seleccionar —</option>
              {["Sin sorting", "Sorting leve", "Sorting moderado", "Sorting severo"].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        }
      </div>
      <div style={{ marginTop: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Observaciones Penn State</label>
        {readOnly
          ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, fontSize: 14, border: `1px solid ${C.borderLight}`, whiteSpace: "pre-wrap" }}>{value.obs || "—"}</div>
          : <textarea value={value.obs || ""} onChange={e => onChange({ ...value, obs: e.target.value })} placeholder="Diferencias ofrecido vs. rechazado..." style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
        }
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// INDIVIDUAL COW SCORING COMPONENT
// ═══════════════════════════════════════════════════
const CowScoring = ({ value = { cows: [], obs: "" }, onChange, readOnly, scoreType }) => {
  const configs = {
    bcs: { label: "BCS", min: 1, max: 5, step: 0.25, target: [3.0, 3.5], desc: "Condición Corporal (1-5, objetivo 3.0-3.5)" },
    heces: { label: "Score", min: 1, max: 5, step: 0.5, target: [3.0, 3.5], desc: "Score de Heces (1=líquida, 5=seca, objetivo 3.0-3.5)" },
    rumen: { label: "Score", min: 1, max: 5, step: 0.5, target: [3.5, 4.5], desc: "Llenado Ruminal (1=vacío, 5=lleno, objetivo 3.5-4.5)" },
  };
  const cfg = configs[scoreType];
  const cows = value.cows || [];

  const addCow = () => {
    const nextNum = cows.length + 1;
    onChange({ ...value, cows: [...cows, { id: uid(), num: nextNum, caravana: "", score: "", nota: "" }] });
  };

  const updateCow = (id, field, val) => {
    onChange({ ...value, cows: cows.map(c => c.id === id ? { ...c, [field]: val } : c) });
  };

  const removeCow = (id) => {
    const updated = cows.filter(c => c.id !== id).map((c, i) => ({ ...c, num: i + 1 }));
    onChange({ ...value, cows: updated });
  };

  // Stats
  const scores = cows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
  const n = scores.length;
  const avg = n > 0 ? round(scores.reduce((s, v) => s + v, 0) / n, 2) : null;
  const min = n > 0 ? Math.min(...scores) : null;
  const max = n > 0 ? Math.max(...scores) : null;
  const sd = n > 1 ? round(Math.sqrt(scores.reduce((s, v) => s + (v - avg) ** 2, 0) / (n - 1)), 2) : null;
  const outOfTarget = n > 0 ? round(scores.filter(v => v < cfg.target[0] || v > cfg.target[1]).length / n * 100, 1) : null;

  // Score distribution
  const distribution = {};
  scores.forEach(s => { const k = s.toFixed(cfg.step < 1 ? 2 : 1); distribution[k] = (distribution[k] || 0) + 1; });

  const StatBox = ({ label, val, color, unit = "" }) => (
    <div style={{ textAlign: "center", padding: "8px 12px", background: (color || C.primary) + "10", borderRadius: 8, minWidth: 70 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || C.primary }}>{val !== null && val !== undefined ? val : "—"}{unit}</div>
      <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: 12, color: C.textLight, margin: "0 0 10px", fontStyle: "italic" }}>{cfg.desc}</p>

      {/* Stats summary */}
      {n > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <StatBox label="Promedio" val={avg} />
          <StatBox label="Mínimo" val={min} color={C.accent} />
          <StatBox label="Máximo" val={max} color={C.primaryLight} />
          <StatBox label="Desvío" val={sd} color="#7C3AED" />
          <StatBox label="N evaluadas" val={n} color={C.text} />
          <StatBox label="% Fuera obj." val={outOfTarget} color={outOfTarget > 20 ? C.danger : C.success} unit="%" />
        </div>
      )}

      {/* Distribution bar */}
      {n >= 3 && (
        <div style={{ marginBottom: 14, padding: 10, background: C.bg, borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: C.textLight }}>Distribución de scores</div>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 50 }}>
            {Object.entries(distribution).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([score, count]) => {
              const pct = (count / n) * 100;
              const sv = parseFloat(score);
              const inTarget = sv >= cfg.target[0] && sv <= cfg.target[1];
              return (
                <div key={score} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: Math.max(pct * 0.4, 4), background: inTarget ? C.success : C.accent, borderRadius: "4px 4px 0 0", transition: "height 0.3s", margin: "0 1px" }} />
                  <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>{score}</div>
                  <div style={{ fontSize: 9, color: C.textLight }}>{count}x</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 6, fontSize: 10 }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.success, marginRight: 4 }} />En objetivo ({cfg.target[0]}-{cfg.target[1]})</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.accent, marginRight: 4 }} />Fuera de objetivo</span>
          </div>
        </div>
      )}

      {/* Cow table */}
      {cows.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.primary + "10" }}>
                <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, width: 36 }}>#</th>
                <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>Caravana / ID</th>
                <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, width: 90 }}>{cfg.label}</th>
                <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>Nota</th>
                {!readOnly && <th style={{ width: 32 }}></th>}
              </tr>
            </thead>
            <tbody>
              {cows.map(cow => {
                const sv = parseFloat(cow.score);
                const inTarget = !isNaN(sv) && sv >= cfg.target[0] && sv <= cfg.target[1];
                return (
                  <tr key={cow.id} style={{ borderBottom: `1px solid ${C.borderLight}`, background: !isNaN(sv) && !inTarget ? C.accent + "08" : "transparent" }}>
                    <td style={{ padding: "4px 8px", textAlign: "center", color: C.textLight, fontSize: 12 }}>{cow.num}</td>
                    <td style={{ padding: "4px 4px" }}>
                      {readOnly ? <span>{cow.caravana || "—"}</span>
                        : <input type="text" value={cow.caravana} onChange={e => updateCow(cow.id, "caravana", e.target.value)} placeholder="N° caravana" style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />}
                    </td>
                    <td style={{ padding: "4px 4px", textAlign: "center" }}>
                      {readOnly ? <span style={{ fontWeight: 700, color: inTarget ? C.success : C.accent }}>{cow.score || "—"}</span>
                        : <input type="number" min={cfg.min} max={cfg.max} step={cfg.step} value={cow.score} onChange={e => updateCow(cow.id, "score", e.target.value)} placeholder={cfg.label} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, textAlign: "center", width: 80, fontWeight: 700, color: !isNaN(sv) ? (inTarget ? C.success : C.accent) : C.text }} />}
                    </td>
                    <td style={{ padding: "4px 4px" }}>
                      {readOnly ? <span style={{ fontSize: 12 }}>{cow.nota || "—"}</span>
                        : <input type="text" value={cow.nota || ""} onChange={e => updateCow(cow.id, "nota", e.target.value)} placeholder="Obs..." style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} />}
                    </td>
                    {!readOnly && (
                      <td style={{ padding: "4px 4px" }}>
                        <button onClick={() => removeCow(cow.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Icon name="x" size={14} color={C.danger} /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && (
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="outline" size="sm" icon="plus" onClick={addCow}>Agregar vaca</Btn>
          <Btn variant="ghost" size="sm" onClick={() => { for (let i = 0; i < 5; i++) addCow(); }}>+5 vacas</Btn>
        </div>
      )}

      {/* Observations */}
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Observaciones</label>
        {readOnly
          ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, fontSize: 14, border: `1px solid ${C.borderLight}`, whiteSpace: "pre-wrap" }}>{value.obs || "—"}</div>
          : <textarea value={value.obs || ""} onChange={e => onChange({ ...value, obs: e.target.value })} placeholder={`Observaciones sobre ${cfg.desc.toLowerCase()}...`} style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} />
        }
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// KETOSIS TRACKER (individual cow BHBA/test)
// ═══════════════════════════════════════════════════
const KetosisTracker = ({ value = { cows: [], obs: "" }, onChange, readOnly }) => {
  const cows = value.cows || [];
  const addC = () => onChange({ ...value, cows: [...cows, { id: uid(), num: cows.length + 1, caravana: "", dim: "", metodo: "Leche (BHBA)", resultado: "", positivo: false, nota: "" }] });
  const updC = (id, f, v) => {
    onChange({ ...value, cows: cows.map(c => {
      if (c.id !== id) return c;
      const u = { ...c, [f]: v };
      if (f === "resultado") { const val = parseFloat(v); if (u.metodo.includes("BHBA")) u.positivo = val >= 1.2; else u.positivo = val > 0; }
      return u;
    })});
  };
  const remC = (id) => onChange({ ...value, cows: cows.filter(c => c.id !== id).map((c, i) => ({ ...c, num: i + 1 })) });

  const tested = cows.length;
  const positivos = cows.filter(c => c.positivo).length;
  const prevalencia = tested > 0 ? round(positivos / tested * 100, 1) : null;
  const resultados = cows.map(c => parseFloat(c.resultado)).filter(v => !isNaN(v));
  const avgBHBA = resultados.length > 0 ? round(resultados.reduce((s, v) => s + v, 0) / resultados.length, 2) : null;

  const StatB = ({ label, val, color, unit = "" }) => (
    <div style={{ textAlign: "center", padding: "8px 12px", background: (color || C.primary) + "10", borderRadius: 8, minWidth: 70 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || C.primary }}>{val !== null ? val : "—"}{unit}</div>
      <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: 12, color: C.textLight, margin: "0 0 10px", fontStyle: "italic" }}>Monitoreo cetosis subclínica. BHBA ≥1.2 mmol/L = positivo.</p>
      {tested > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <StatB label="Testeadas" val={tested} color={C.text} />
          <StatB label="Positivas" val={positivos} color={positivos > 0 ? C.danger : C.success} />
          <StatB label="Prevalencia" val={prevalencia} color={prevalencia > 15 ? C.danger : prevalencia > 10 ? C.warning : C.success} unit="%" />
          <StatB label="BHBA prom." val={avgBHBA} color={avgBHBA >= 1.2 ? C.danger : C.success} unit=" mmol/L" />
        </div>
      )}
      {prevalencia !== null && (
        <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 8, fontSize: 13, background: prevalencia > 15 ? C.danger + "15" : prevalencia > 10 ? C.warning + "20" : C.success + "15", color: prevalencia > 15 ? C.danger : prevalencia > 10 ? "#92400e" : C.success, fontWeight: 600 }}>
          {prevalencia > 15 ? "⚠️ Prevalencia alta (>15%). Revisar dieta transición y energía." : prevalencia > 10 ? "⚡ Prevalencia moderada (10-15%). Monitorear." : "✅ Prevalencia dentro de objetivo (<10%)."}
        </div>
      )}
      {cows.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: C.primary + "10" }}><th style={{ padding: "6px 6px", textAlign: "center", fontWeight: 600, width: 30 }}>#</th><th style={{ padding: "6px 6px", textAlign: "left", fontWeight: 600 }}>Caravana</th><th style={{ padding: "6px 6px", textAlign: "center", fontWeight: 600, width: 55 }}>DIM</th><th style={{ padding: "6px 6px", textAlign: "center", fontWeight: 600, width: 130 }}>Método</th><th style={{ padding: "6px 6px", textAlign: "center", fontWeight: 600, width: 80 }}>Resultado</th><th style={{ padding: "6px 6px", textAlign: "center", fontWeight: 600, width: 40 }}>+/−</th><th style={{ padding: "6px 6px", textAlign: "left", fontWeight: 600 }}>Nota</th>{!readOnly && <th style={{ width: 30 }}></th>}</tr></thead>
            <tbody>{cows.map(cow => (
              <tr key={cow.id} style={{ borderBottom: `1px solid ${C.borderLight}`, background: cow.positivo ? C.danger + "08" : "transparent" }}>
                <td style={{ padding: "4px 6px", textAlign: "center", fontSize: 12, color: C.textLight }}>{cow.num}</td>
                <td style={{ padding: "4px 4px" }}>{readOnly ? cow.caravana || "—" : <input type="text" value={cow.caravana} onChange={e => updC(cow.id, "caravana", e.target.value)} placeholder="ID" style={{ ...inputStyle, padding: "5px 6px", fontSize: 13 }} />}</td>
                <td style={{ padding: "4px 4px" }}>{readOnly ? cow.dim || "—" : <input type="number" value={cow.dim} onChange={e => updC(cow.id, "dim", e.target.value)} placeholder="DIM" style={{ ...inputStyle, padding: "5px 6px", fontSize: 13, textAlign: "center", width: 55 }} />}</td>
                <td style={{ padding: "4px 4px" }}>{readOnly ? cow.metodo || "—" : <select value={cow.metodo || "Leche (BHBA)"} onChange={e => updC(cow.id, "metodo", e.target.value)} style={{ ...inputStyle, padding: "5px 4px", fontSize: 12, cursor: "pointer" }}><option>Leche (BHBA)</option><option>Sangre (BHBA)</option><option>Orina (acetoacetato)</option><option>Tira reactiva</option></select>}</td>
                <td style={{ padding: "4px 4px" }}>{readOnly ? <span style={{ fontWeight: 700, color: cow.positivo ? C.danger : C.success }}>{cow.resultado || "—"}</span> : <input type="number" step="0.1" value={cow.resultado} onChange={e => updC(cow.id, "resultado", e.target.value)} placeholder="mmol/L" style={{ ...inputStyle, padding: "5px 6px", fontSize: 13, textAlign: "center", width: 75, fontWeight: 700, color: cow.positivo ? C.danger : C.success }} />}</td>
                <td style={{ textAlign: "center", fontSize: 16 }}>{cow.positivo ? "🔴" : cow.resultado ? "🟢" : "—"}</td>
                <td style={{ padding: "4px 4px" }}>{readOnly ? <span style={{ fontSize: 12 }}>{cow.nota || "—"}</span> : <input type="text" value={cow.nota || ""} onChange={e => updC(cow.id, "nota", e.target.value)} placeholder="Obs..." style={{ ...inputStyle, padding: "5px 6px", fontSize: 12 }} />}</td>
                {!readOnly && <td style={{ padding: "4px 2px" }}><button onClick={() => remC(cow.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Icon name="x" size={14} color={C.danger} /></button></td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {!readOnly && <div style={{ display: "flex", gap: 8 }}><Btn variant="outline" size="sm" icon="plus" onClick={addC}>Agregar vaca</Btn><Btn variant="ghost" size="sm" onClick={() => { for (let i = 0; i < 5; i++) addC(); }}>+5 vacas</Btn></div>}
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Protocolo de monitoreo y observaciones</label>
        {readOnly ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, fontSize: 14, border: `1px solid ${C.borderLight}`, whiteSpace: "pre-wrap" }}>{value.obs || "—"}</div>
          : <textarea value={value.obs || ""} onChange={e => onChange({ ...value, obs: e.target.value })} placeholder="Frecuencia de testeo, DIM, protocolo tratamiento..." style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// DISEASE INCIDENCE TRACKER
// ═══════════════════════════════════════════════════
const DiseaseTracker = ({ value = {}, onChange, readOnly }) => {
  const diseases = [
    { id: "da", label: "DA (Desplaz. Abomaso)", ref: "<5%" },
    { id: "hipocalcemia", label: "Hipocalcemia clínica", ref: "<5%" },
    { id: "rp", label: "Retención placentaria", ref: "<8%" },
    { id: "metritis", label: "Metritis", ref: "<10%" },
    { id: "cetosis_cl", label: "Cetosis clínica", ref: "<5%" },
    { id: "mastitis", label: "Mastitis clínica", ref: "<2%/mes" },
    { id: "neumonia", label: "Neumonía", ref: "<2%" },
    { id: "cojera", label: "Cojera", ref: "<5%" },
  ];

  const handleCh = (dId, field, val) => {
    const nv = { ...value, [`${dId}_${field}`]: val };
    const casos = parseFloat(nv[`${dId}_casos`]) || 0;
    const paridas = parseFloat(nv.paridas_ventana) || 0;
    if (paridas > 0) nv[`${dId}_incidencia`] = round(casos / paridas * 100, 1);
    onChange(nv);
  };

  const recalcAll = (paridas) => {
    const nv = { ...value, paridas_ventana: paridas };
    const p = parseFloat(paridas) || 0;
    if (p > 0) diseases.forEach(d => { const c = parseFloat(nv[`${d.id}_casos`]) || 0; nv[`${d.id}_incidencia`] = round(c / p * 100, 1); });
    onChange(nv);
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: C.textLight, margin: "0 0 10px", fontStyle: "italic" }}>Denominador: vacas paridas en ventana (últimas 3-4 sem. o desde última visita). Incidencia = casos nuevos / paridas.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Vacas paridas en ventana</label>{readOnly ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, border: `1px solid ${C.borderLight}` }}>{value.paridas_ventana || "—"}</div> : <input type="number" value={value.paridas_ventana || ""} onChange={e => recalcAll(e.target.value)} placeholder="Ej: 40" style={inputStyle} />}</div>
        <div><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Período</label>{readOnly ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, border: `1px solid ${C.borderLight}` }}>{value.periodo_dias || "—"}</div> : <input type="text" value={value.periodo_dias || ""} onChange={e => onChange({ ...value, periodo_dias: e.target.value })} placeholder="28 días / desde última visita" style={inputStyle} />}</div>
      </div>
      <div style={{ overflowX: "auto", marginBottom: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: C.primary + "10" }}><th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Enfermedad</th><th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, width: 80 }}>Casos</th><th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, width: 70 }}>Incid. %</th><th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, width: 55 }}>Ref.</th><th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, width: 70 }}>Reincid.</th><th style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600 }}>Protocolo/Notas</th></tr></thead>
          <tbody>{diseases.map(d => {
            const inc = parseFloat(value[`${d.id}_incidencia`]) || 0;
            const refN = parseFloat(d.ref.replace(/[<%\/mes]/g, "")) || 10;
            const cl = inc > refN * 1.5 ? C.danger : inc > refN ? C.warning : C.success;
            return (
              <tr key={d.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: "6px 10px", fontWeight: 500 }}>{d.label}</td>
                <td style={{ padding: "4px 4px" }}>{readOnly ? <span style={{ display: "block", textAlign: "center" }}>{value[`${d.id}_casos`] || "—"}</span> : <input type="number" value={value[`${d.id}_casos`] || ""} onChange={e => handleCh(d.id, "casos", e.target.value)} placeholder="0" style={{ ...inputStyle, padding: "5px 6px", fontSize: 13, textAlign: "center" }} />}</td>
                <td style={{ padding: "6px 6px", textAlign: "center", fontWeight: 700, color: cl }}>{value[`${d.id}_incidencia`] ? `${value[`${d.id}_incidencia`]}%` : "—"}</td>
                <td style={{ padding: "6px 6px", textAlign: "center", fontSize: 12, color: C.textLight }}>{d.ref}</td>
                <td style={{ padding: "4px 4px" }}>{readOnly ? <span style={{ display: "block", textAlign: "center" }}>{value[`${d.id}_reincid`] || "—"}</span> : <input type="number" value={value[`${d.id}_reincid`] || ""} onChange={e => onChange({ ...value, [`${d.id}_reincid`]: e.target.value })} placeholder="0" style={{ ...inputStyle, padding: "5px 6px", fontSize: 13, textAlign: "center" }} />}</td>
                <td style={{ padding: "4px 4px" }}>{readOnly ? <span style={{ fontSize: 12 }}>{value[`${d.id}_protocolo`] || "—"}</span> : <input type="text" value={value[`${d.id}_protocolo`] || ""} onChange={e => onChange({ ...value, [`${d.id}_protocolo`]: e.target.value })} placeholder="Protocolo..." style={{ ...inputStyle, padding: "5px 6px", fontSize: 12 }} />}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Mortalidad 0-60 DIM</label>{readOnly ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, border: `1px solid ${C.borderLight}` }}>{value.mortalidad || "—"}</div> : <input type="text" value={value.mortalidad || ""} onChange={e => onChange({ ...value, mortalidad: e.target.value })} placeholder="Ej: 2/40 = 5%" style={inputStyle} />}</div>
        <div><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Descartes 0-60 DIM</label>{readOnly ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, border: `1px solid ${C.borderLight}` }}>{value.descartes || "—"}</div> : <input type="text" value={value.descartes || ""} onChange={e => onChange({ ...value, descartes: e.target.value })} placeholder="Ej: 3/40 = 7.5%" style={inputStyle} />}</div>
        <div><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Días a 1ª IA</label>{readOnly ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, border: `1px solid ${C.borderLight}` }}>{value.dias_1ia || "—"}</div> : <input type="text" value={value.dias_1ia || ""} onChange={e => onChange({ ...value, dias_1ia: e.target.value })} placeholder="Ej: 65 DIM" style={inputStyle} />}</div>
      </div>
      <div><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Observaciones de salud</label>{readOnly ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, border: `1px solid ${C.borderLight}`, whiteSpace: "pre-wrap" }}>{value.obs_salud || "—"}</div> : <textarea value={value.obs_salud || ""} onChange={e => onChange({ ...value, obs_salud: e.target.value })} placeholder="Tendencias, protocolos, cumplimiento..." style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// BEDDING EVALUATION (Temp/Humidity multi-point)
// ═══════════════════════════════════════════════════
const BeddingEval = ({ value = { points: [], obs: "" }, onChange, readOnly }) => {
  const pts = value.points || [];
  const addPt = () => onChange({ ...value, points: [...pts, { id: uid(), num: pts.length + 1, ubicacion: "", temp_sup: "", temp_prof: "", hum_sup: "", hum_prof: "", profundidad: "" }] });
  const updPt = (id, f, v) => onChange({ ...value, points: pts.map(p => p.id === id ? { ...p, [f]: v } : p) });
  const remPt = (id) => onChange({ ...value, points: pts.filter(p => p.id !== id).map((p, i) => ({ ...p, num: i + 1 })) });

  const vals = (field) => pts.map(p => parseFloat(p[field])).filter(v => !isNaN(v));
  const avg = (arr) => arr.length > 0 ? round(arr.reduce((s, v) => s + v, 0) / arr.length, 1) : null;
  const mn = (arr) => arr.length > 0 ? round(Math.min(...arr), 1) : null;
  const mx = (arr) => arr.length > 0 ? round(Math.max(...arr), 1) : null;

  const tempSup = vals("temp_sup"); const tempProf = vals("temp_prof"); const profVals = vals("profundidad");
  const avgTempSup = avg(tempSup); const avgTempProf = avg(tempProf); const avgProf = avg(profVals); const minProf = mn(profVals);

  const StatB = ({ label, val, color, unit = "" }) => (
    <div style={{ textAlign: "center", padding: "6px 10px", background: (color || C.primary) + "10", borderRadius: 8, minWidth: 65 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || C.primary }}>{val !== null ? val : "—"}{unit}</div>
      <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>{label}</div>
    </div>
  );

  const tempColor = (v) => { const n = parseFloat(v); if (isNaN(n)) return C.text; return n > 40 ? C.danger : n > 35 ? C.warning : C.success; };

  return (
    <div>
      <p style={{ fontSize: 12, color: C.textLight, margin: "0 0 10px", fontStyle: "italic" }}>Mínimo 5 puntos. Medir superficial (0-5cm) y profunda (10-15cm). Temp. cama &gt;35°C = alerta.</p>
      {pts.length >= 3 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <StatB label="T° sup. prom." val={avgTempSup} color={tempColor(avgTempSup)} unit="°C" />
          <StatB label="T° prof. prom." val={avgTempProf} color={tempColor(avgTempProf)} unit="°C" />
          <StatB label="Prof. prom." val={avgProf} color={C.primary} unit=" cm" />
          <StatB label="Prof. mín." val={minProf} color={minProf && minProf < 15 ? C.danger : C.success} unit=" cm" />
          <StatB label="Puntos" val={pts.length} color={C.text} />
        </div>
      )}
      {pts.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: C.primary + "10" }}>
              <th style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600, width: 28 }}>#</th>
              <th style={{ padding: "6px 4px", textAlign: "left", fontWeight: 600 }}>Ubicación</th>
              <th style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600 }}>T° sup (°C)</th>
              <th style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600 }}>T° prof (°C)</th>
              <th style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600 }}>Hum. sup</th>
              <th style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600 }}>Hum. prof</th>
              <th style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600 }}>Prof. (cm)</th>
              {!readOnly && <th style={{ width: 28 }}></th>}
            </tr></thead>
            <tbody>{pts.map(pt => (
              <tr key={pt.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: "3px 4px", textAlign: "center", color: C.textLight }}>{pt.num}</td>
                <td style={{ padding: "3px 3px" }}>{readOnly ? pt.ubicacion || "—" : <input type="text" value={pt.ubicacion} onChange={e => updPt(pt.id, "ubicacion", e.target.value)} placeholder="Zona" style={{ ...inputStyle, padding: "4px 6px", fontSize: 12 }} />}</td>
                {["temp_sup", "temp_prof", "hum_sup", "hum_prof", "profundidad"].map(f => (
                  <td key={f} style={{ padding: "3px 3px", textAlign: "center" }}>
                    {readOnly ? <span style={{ fontWeight: f.startsWith("temp") ? 700 : 400, color: f.startsWith("temp") ? tempColor(pt[f]) : C.text }}>{pt[f] || "—"}</span>
                      : <input type="number" step="0.1" value={pt[f] || ""} onChange={e => updPt(pt.id, f, e.target.value)} style={{ ...inputStyle, padding: "4px 4px", fontSize: 12, textAlign: "center", width: 60, fontWeight: f.startsWith("temp") ? 700 : 400, color: f.startsWith("temp") ? tempColor(pt[f]) : C.text }} />}
                  </td>
                ))}
                {!readOnly && <td style={{ padding: "3px 2px" }}><button onClick={() => remPt(pt.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Icon name="x" size={14} color={C.danger} /></button></td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {!readOnly && <div style={{ display: "flex", gap: 8 }}><Btn variant="outline" size="sm" icon="plus" onClick={addPt}>Agregar punto</Btn><Btn variant="ghost" size="sm" onClick={() => { for (let i = 0; i < 5; i++) addPt(); }}>+5 puntos</Btn></div>}
      <div style={{ marginTop: 12 }}><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Observaciones</label>{readOnly ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, border: `1px solid ${C.borderLight}`, whiteSpace: "pre-wrap" }}>{value.obs || "—"}</div> : <textarea value={value.obs || ""} onChange={e => onChange({ ...value, obs: e.target.value })} placeholder="Zonas calientes, compactación, uniformidad..." style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} />}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// CLEANLINESS SCORING (ubre, patas, flanco)
// ═══════════════════════════════════════════════════
const CleanlinessScoring = ({ value = { cows: [], obs: "" }, onChange, readOnly }) => {
  const cows = value.cows || [];
  const addC = () => onChange({ ...value, cows: [...cows, { id: uid(), num: cows.length + 1, caravana: "", ubre: "", patas: "", flanco: "" }] });
  const updC = (id, f, v) => onChange({ ...value, cows: cows.map(c => c.id === id ? { ...c, [f]: v } : c) });
  const remC = (id) => onChange({ ...value, cows: cows.filter(c => c.id !== id).map((c, i) => ({ ...c, num: i + 1 })) });

  const scores = (f) => cows.map(c => parseFloat(c[f])).filter(v => !isNaN(v));
  const avg2 = (arr) => arr.length > 0 ? round(arr.reduce((s, v) => s + v, 0) / arr.length, 1) : null;
  const pct3 = (arr) => arr.length > 0 ? round(arr.filter(v => v >= 3).length / arr.length * 100, 1) : null;

  const ubreS = scores("ubre"); const patasS = scores("patas"); const flancoS = scores("flanco");
  const n = Math.max(ubreS.length, patasS.length, flancoS.length);

  const StatB = ({ label, val, color, unit = "" }) => (
    <div style={{ textAlign: "center", padding: "6px 10px", background: (color || C.primary) + "10", borderRadius: 8, minWidth: 60 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || C.primary }}>{val !== null ? val : "—"}{unit}</div>
      <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>{label}</div>
    </div>
  );
  const clnColor = (v) => { if (v === null) return C.text; return v > 30 ? C.danger : v > 15 ? C.warning : C.success; };

  return (
    <div>
      <p style={{ fontSize: 12, color: C.textLight, margin: "0 0 10px", fontStyle: "italic" }}>Puntaje limpieza 1-5 (1=limpio, 5=muy sucio). Muestra ~20 vacas/lote. Objetivo: &lt;15% con score ≥3.</p>
      {n >= 3 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <StatB label="Prom. ubre" val={avg2(ubreS)} color={avg2(ubreS) >= 3 ? C.danger : C.success} />
          <StatB label="% ubre ≥3" val={pct3(ubreS)} color={clnColor(pct3(ubreS))} unit="%" />
          <StatB label="Prom. patas" val={avg2(patasS)} color={avg2(patasS) >= 3 ? C.danger : C.success} />
          <StatB label="% patas ≥3" val={pct3(patasS)} color={clnColor(pct3(patasS))} unit="%" />
          <StatB label="Prom. flanco" val={avg2(flancoS)} color={avg2(flancoS) >= 3 ? C.danger : C.success} />
          <StatB label="% flanco ≥3" val={pct3(flancoS)} color={clnColor(pct3(flancoS))} unit="%" />
          <StatB label="N" val={n} color={C.text} />
        </div>
      )}
      {cows.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: C.primary + "10" }}><th style={{ padding: "6px 6px", textAlign: "center", fontWeight: 600, width: 30 }}>#</th><th style={{ padding: "6px 6px", textAlign: "left", fontWeight: 600 }}>Caravana</th><th style={{ padding: "6px 6px", textAlign: "center", fontWeight: 600 }}>Ubre (1-5)</th><th style={{ padding: "6px 6px", textAlign: "center", fontWeight: 600 }}>Patas (1-5)</th><th style={{ padding: "6px 6px", textAlign: "center", fontWeight: 600 }}>Flanco (1-5)</th>{!readOnly && <th style={{ width: 28 }}></th>}</tr></thead>
            <tbody>{cows.map(cow => (
              <tr key={cow.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: "4px 6px", textAlign: "center", color: C.textLight, fontSize: 12 }}>{cow.num}</td>
                <td style={{ padding: "4px 4px" }}>{readOnly ? cow.caravana || "—" : <input type="text" value={cow.caravana} onChange={e => updC(cow.id, "caravana", e.target.value)} placeholder="ID" style={{ ...inputStyle, padding: "5px 6px", fontSize: 13 }} />}</td>
                {["ubre", "patas", "flanco"].map(f => { const sv = parseFloat(cow[f]); const bad = !isNaN(sv) && sv >= 3; return (
                  <td key={f} style={{ padding: "4px 4px", textAlign: "center", background: bad ? C.danger + "08" : "transparent" }}>
                    {readOnly ? <span style={{ fontWeight: 700, color: bad ? C.danger : C.success }}>{cow[f] || "—"}</span>
                      : <input type="number" min="1" max="5" step="1" value={cow[f] || ""} onChange={e => updC(cow.id, f, e.target.value)} style={{ ...inputStyle, padding: "5px 6px", fontSize: 13, textAlign: "center", width: 60, fontWeight: 700, color: bad ? C.danger : !isNaN(sv) ? C.success : C.text }} />}
                  </td>
                ); })}
                {!readOnly && <td><button onClick={() => remC(cow.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Icon name="x" size={14} color={C.danger} /></button></td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {!readOnly && <div style={{ display: "flex", gap: 8 }}><Btn variant="outline" size="sm" icon="plus" onClick={addC}>Agregar vaca</Btn><Btn variant="ghost" size="sm" onClick={() => { for (let i = 0; i < 10; i++) addC(); }}>+10 vacas</Btn></div>}
      <div style={{ marginTop: 12 }}><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Observaciones limpieza</label>{readOnly ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, border: `1px solid ${C.borderLight}`, whiteSpace: "pre-wrap" }}>{value.obs || "—"}</div> : <textarea value={value.obs || ""} onChange={e => onChange({ ...value, obs: e.target.value })} placeholder="Relación con camas, barro, problemas..." style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} />}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// GRAIN PROCESSING (5 tray method)
// ═══════════════════════════════════════════════════
const GrainProcessing = ({ value = {}, onChange, readOnly }) => {
  const trays = [
    { id: "t1", label: "Bandeja 1 (>4.75mm)", desc: "Granos enteros/grandes" },
    { id: "t2", label: "Bandeja 2 (3.35mm)", desc: "Granos parciales" },
    { id: "t3", label: "Bandeja 3 (2.36mm)", desc: "Granos quebrados" },
    { id: "t4", label: "Bandeja 4 (1.18mm)", desc: "Molido grueso" },
    { id: "t5", label: "Fondo (<1.18mm)", desc: "Molido fino" },
  ];

  const handleCh = (trayId, val) => {
    const nv = { ...value, [trayId]: val };
    const weights = trays.map(t => parseFloat(nv[t.id]) || 0);
    const total = weights.reduce((s, v) => s + v, 0);
    if (total > 0) {
      trays.forEach((t, i) => { nv[`${t.id}_pct`] = round(weights[i] / total * 100, 1); });
      nv.total_g = round(total, 1);
      const rotos = weights[2] + weights[3] + weights[4];
      nv.pct_rotos = round(rotos / total * 100, 1);
      // Mean particle size estimate
      const midpoints = [5.5, 4.0, 2.85, 1.77, 0.59];
      const mps = weights.reduce((s, w, i) => s + w * midpoints[i], 0) / total;
      nv.mps = round(mps * 1000, 0); // to microns
    }
    onChange(nv);
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: C.textLight, margin: "0 0 10px", fontStyle: "italic" }}>Método de 5 bandejas. Pesar muestra en cada bandeja (gramos). Maíz seco molido: objetivo MPS &lt;400-500 micrones. % granos rotos objetivo &gt;70%.</p>
      <div style={{ overflowX: "auto", marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: C.primary + "10" }}><th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 600 }}>Bandeja</th><th style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600, fontSize: 12 }}>Descripción</th><th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, width: 90 }}>Peso (g)</th><th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, width: 70, background: C.primary + "15" }}>%</th></tr></thead>
          <tbody>{trays.map(t => (
            <tr key={t.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              <td style={{ padding: "6px 8px", fontWeight: 500 }}>{t.label}</td>
              <td style={{ padding: "6px 8px", fontSize: 12, color: C.textLight }}>{t.desc}</td>
              <td style={{ padding: "4px 4px" }}>{readOnly ? <span style={{ display: "block", textAlign: "center" }}>{value[t.id] || "—"}</span> : <input type="number" step="0.1" value={value[t.id] || ""} onChange={e => handleCh(t.id, e.target.value)} placeholder="g" style={{ ...inputStyle, padding: "5px 6px", fontSize: 13, textAlign: "center" }} />}</td>
              <td style={{ padding: "6px 6px", textAlign: "center", fontWeight: 700, background: C.primary + "08" }}>{value[`${t.id}_pct`] ? `${value[`${t.id}_pct`]}%` : "—"}</td>
            </tr>
          ))}</tbody>
          {value.total_g && <tfoot><tr style={{ background: C.primary + "08", fontWeight: 700 }}><td colSpan={2} style={{ padding: "8px 8px" }}>TOTAL</td><td style={{ padding: "8px 6px", textAlign: "center" }}>{value.total_g}g</td><td style={{ padding: "8px 6px", textAlign: "center" }}>100%</td></tr></tfoot>}
        </table>
      </div>
      {value.pct_rotos !== undefined && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center", padding: "8px 14px", background: (value.pct_rotos >= 70 ? C.success : C.danger) + "10", borderRadius: 8 }}><div style={{ fontSize: 22, fontWeight: 700, color: value.pct_rotos >= 70 ? C.success : C.danger }}>{value.pct_rotos}%</div><div style={{ fontSize: 11, color: C.textLight }}>% Granos rotos (obj &gt;70%)</div></div>
          <div style={{ textAlign: "center", padding: "8px 14px", background: (value.mps <= 500 ? C.success : value.mps <= 700 ? C.warning : C.danger) + "10", borderRadius: 8 }}><div style={{ fontSize: 22, fontWeight: 700, color: value.mps <= 500 ? C.success : value.mps <= 700 ? C.warning : C.danger }}>~{value.mps}μ</div><div style={{ fontSize: 11, color: C.textLight }}>MPS estimado (obj &lt;500μ)</div></div>
        </div>
      )}
      <div><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Observaciones procesamiento</label>{readOnly ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, border: `1px solid ${C.borderLight}`, whiteSpace: "pre-wrap" }}>{value.obs || "—"}</div> : <textarea value={value.obs || ""} onChange={e => onChange({ ...value, obs: e.target.value })} placeholder="Tipo de grano, método de procesamiento, estado de cuchillas/molino..." style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} />}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// GENERIC FIELD RENDERER
// ═══════════════════════════════════════════════════
const Field = ({ field, value, onChange, readOnly }) => {
  if (readOnly) {
    return (
      <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, fontSize: 14, minHeight: 38, border: `1px solid ${C.borderLight}`, whiteSpace: "pre-wrap" }}>
        {value || <span style={{ color: C.textLight, fontStyle: "italic" }}>— Sin dato —</span>}
        {value && field.unit ? ` ${field.unit}` : ""}
      </div>
    );
  }
  const common = { ...inputStyle };
  if (field.type === "textarea") return <textarea style={{ ...common, minHeight: (field.rows || 3) * 28, resize: "vertical" }} placeholder={field.placeholder} value={value || ""} onChange={e => onChange(field.id, e.target.value)} />;
  if (field.type === "select") return (<select style={{ ...common, cursor: "pointer" }} value={value || ""} onChange={e => onChange(field.id, e.target.value)}><option value="">— Seleccionar —</option>{field.options.map(o => <option key={o} value={o}>{o}</option>)}</select>);
  return (
    <div style={{ position: "relative" }}>
      <input type={field.type || "text"} step={field.step} style={{ ...common, paddingRight: field.unit ? 42 : 12 }} placeholder={field.placeholder} value={value || ""} onChange={e => onChange(field.id, e.target.value)} />
      {field.unit && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.textLight, fontWeight: 500 }}>{field.unit}</span>}
    </div>
  );
};

// ═══════════════════════════════════════════════════
// SECTION DEFINITIONS (PREPARTO)
// ═══════════════════════════════════════════════════
const PREPARTO_SECTIONS = [
  {
    id: "dieta", title: "a) Evaluación de la dieta de preparto", subtitle: "Composición y %MS",
    customComponent: "ingredients",
    fields: [
      { id: "frecuencia_medicion_ms", label: "Frecuencia de medición de MS", type: "select", options: ["Diaria", "Semanal", "Quincenal", "Mensual", "No se mide"] },
      { id: "ajustes_dieta", label: "Ajustes realizados", type: "textarea", placeholder: "Describir ajustes recientes..." },
    ],
  },
  {
    id: "cms", title: "b) Consumo de Materia Seca (CMS/DMI)", subtitle: "Oferta, rechazo y % de refusas",
    fields: [
      { id: "cms_oferta_kg", label: "Oferta (kg MS/vaca/día)", type: "number", placeholder: "Ej: 12.5", unit: "kg" },
      { id: "cms_rechazo_kg", label: "Rechazo (kg MS/vaca/día)", type: "number", placeholder: "Ej: 1.5", unit: "kg" },
      { id: "cms_refusas_pct", label: "% Refusas", type: "number", placeholder: "Ej: 8", unit: "%" },
      { id: "cms_observaciones", label: "Observaciones CMS", type: "textarea", placeholder: "Estado del alimento, frescura, etc." },
    ],
  },
  {
    id: "ph", title: "c) Evaluación de pH", subtitle: "Promedio, rango y distribución de valores",
    fields: [
      { id: "ph_promedio", label: "pH Promedio", type: "number", placeholder: "Ej: 6.2", step: "0.1" },
      { id: "ph_minimo", label: "pH Mínimo", type: "number", placeholder: "Ej: 5.8", step: "0.1" },
      { id: "ph_maximo", label: "pH Máximo", type: "number", placeholder: "Ej: 6.8", step: "0.1" },
      { id: "ph_n_muestras", label: "N° de muestras", type: "number", placeholder: "Ej: 10" },
      { id: "ph_distribucion", label: "Distribución / Observaciones", type: "textarea", placeholder: "% por debajo de 6.0, etc." },
    ],
  },
  {
    id: "penn_state", title: "d) Separador Penn State", subtitle: "Distribución de partículas y evidencia de selección (sorting)",
    customComponent: "pennstate",
    fields: [],
  },
  {
    id: "bcs", title: "e) Condición Corporal (BCS)", subtitle: "Evaluación vaca por vaca con cálculos automáticos",
    customComponent: "cowscore_bcs",
    fields: [],
  },
  {
    id: "heces", title: "f) Score de Heces", subtitle: "Evaluación vaca por vaca con cálculos automáticos",
    customComponent: "cowscore_heces",
    fields: [],
  },
  {
    id: "llenado_ruminal", title: "g) Score de Llenado Ruminal", subtitle: "Evaluación vaca por vaca con cálculos automáticos",
    customComponent: "cowscore_rumen",
    fields: [],
  },
  {
    id: "instalaciones", title: "h) Instalaciones y Confort", subtitle: "Espacio de comedero, densidad, acceso y condiciones de descanso",
    fields: [
      { id: "inst_espacio_comedero_cm", label: "Espacio de comedero (cm/vaca)", type: "number", placeholder: "Ej: 76", unit: "cm" },
      { id: "inst_densidad_pct", label: "Densidad (% ocupación)", type: "number", placeholder: "Ej: 85", unit: "%" },
      { id: "inst_camas_tipo", label: "Tipo de cama / descanso", type: "text", placeholder: "Ej: Arena, compost, pasto..." },
      { id: "inst_camas_estado", label: "Estado de las camas", type: "select", options: ["Excelente", "Bueno", "Regular", "Malo"] },
      { id: "inst_ventilacion", label: "Ventilación / sombra", type: "select", options: ["Adecuada", "Parcialmente adecuada", "Inadecuada"] },
      { id: "inst_observaciones", label: "Observaciones instalaciones", type: "textarea", placeholder: "Barro, hacinamiento, accesos..." },
    ],
  },
  {
    id: "aguadas", title: "i) Aguadas", subtitle: "Disponibilidad, limpieza, caudal y ubicación",
    fields: [
      { id: "agua_n_bebederos", label: "N° de bebederos", type: "number", placeholder: "Ej: 3" },
      { id: "agua_cm_lineales", label: "cm lineales de agua/vaca", type: "number", placeholder: "Ej: 10", unit: "cm" },
      { id: "agua_limpieza", label: "Limpieza", type: "select", options: ["Limpia", "Aceptable", "Sucia", "Muy sucia"] },
      { id: "agua_caudal", label: "Caudal", type: "select", options: ["Adecuado", "Insuficiente", "No evaluado"] },
      { id: "agua_ubicacion", label: "Ubicación respecto al comedero", type: "text", placeholder: "Ej: A 5m del comedero" },
      { id: "agua_observaciones", label: "Observaciones aguadas", type: "textarea", placeholder: "Accesibilidad, sombra en bebederos..." },
    ],
  },
  {
    id: "datos_lote", title: "j) Datos del Lote", subtitle: "Días en preparto, número de animales y tiempo promedio",
    fields: [
      { id: "lote_n_animales", label: "N° de animales en lote", type: "number", placeholder: "Ej: 40" },
      { id: "lote_dias_preparto_promedio", label: "Días promedio en preparto", type: "number", placeholder: "Ej: 21", unit: "días" },
      { id: "lote_dias_preparto_rango", label: "Rango de días en preparto", type: "text", placeholder: "Ej: 14-28 días" },
      { id: "lote_vaquillonas_pct", label: "% Vaquillonas", type: "number", placeholder: "Ej: 30", unit: "%" },
      { id: "lote_observaciones", label: "Observaciones del lote", type: "textarea", placeholder: "Composición, mezcla de categorías..." },
    ],
  },
  {
    id: "observaciones_finales", title: "k) Observaciones y Recomendaciones", subtitle: "Principales hallazgos, acciones priorizadas y responsables",
    fields: [
      { id: "hallazgos_principales", label: "Principales hallazgos", type: "textarea", placeholder: "Resumen...", rows: 4 },
      { id: "acciones_priorizadas", label: "Acciones priorizadas", type: "textarea", placeholder: "1. ...\n2. ...\n3. ...", rows: 4 },
      { id: "responsables", label: "Responsables y plazos", type: "textarea", placeholder: "Acción → Responsable → Plazo", rows: 3 },
      { id: "proxima_visita", label: "Fecha tentativa próxima visita", type: "date" },
      { id: "notas_adicionales", label: "Notas adicionales", type: "textarea", placeholder: "Cualquier otra observación..." },
    ],
  },
];

// ═══════════════════════════════════════════════════
// FRESCAS (0-60 DIM) — AUDITORÍA COMPLETA
// ═══════════════════════════════════════════════════
const FRESCAS_SECTIONS = [
  { id: "fr_cetosis", title: "1. Cetosis subclínica", subtitle: "Monitoreo individual BHBA/acetoacetato — leche, sangre u orina", customComponent: "ketosis", fields: [] },
  { id: "fr_dmi", title: "2. DMI en frescas", subtitle: "Oferta-rechazo, variación día a día, % vacas que no comen", fields: [
    { id: "fr_dmi_oferta", label: "Oferta (kg MS/vaca/día)", type: "number", placeholder: "Ej: 22", unit: "kg" },
    { id: "fr_dmi_rechazo", label: "Rechazo (kg MS/vaca/día)", type: "number", placeholder: "Ej: 2.0", unit: "kg" },
    { id: "fr_dmi_refusas", label: "% Refusas", type: "number", placeholder: "Ej: 5", unit: "%" },
    { id: "fr_dmi_variacion", label: "Variación día a día en oferta", type: "select", options: ["Consistente (<5%)", "Moderada (5-10%)", "Alta (>10%)", "No evaluado"] },
    { id: "fr_dmi_no_comen", label: "% vacas que no comen (obs. comedero)", type: "number", placeholder: "Ej: 3", unit: "%" },
    { id: "fr_dmi_obs", label: "Observación de comedero (2h post-entrega, uniformidad, competencia)", type: "textarea", placeholder: "Estado a 2h post-entrega, uniformidad, competencia..." },
  ]},
  { id: "fr_ms_tmr", title: "2b. %MS del TMR y control de uniformidad", subtitle: "Frecuencia medición, ajuste por forraje, muestreos a lo largo del comedero", fields: [
    { id: "fr_ms_pct", label: "%MS del TMR", type: "number", placeholder: "Ej: 48", unit: "%" },
    { id: "fr_ms_freq", label: "Frecuencia medición de MS", type: "select", options: ["Diaria", "Semanal", "Quincenal", "Mensual", "No se mide"] },
    { id: "fr_ms_ajuste", label: "¿Se ajusta por cambios de forraje?", type: "select", options: ["Sí, siempre", "A veces", "No", "No aplica"] },
    { id: "fr_ms_uniformidad", label: "Control de uniformidad (muestreos comedero)", type: "select", options: ["Se hace regularmente", "Ocasional", "No se hace"] },
    { id: "fr_ms_obs", label: "Observaciones MS/TMR", type: "textarea", placeholder: "Variación entre muestreos, dif. inicio vs final..." },
  ]},
  { id: "fr_enfermedades", title: "3. Incidencia de enfermedades", subtitle: "Casos nuevos/paridas, reincidencias, protocolos, mortalidad, descartes y días a 1ª IA", customComponent: "diseases", fields: [] },
  { id: "fr_corral", title: "4. Condiciones del corral", subtitle: "Densidad, camas, descanso, barro, ventilación, agua, comedero", fields: [
    { id: "fr_corral_n", label: "N° animales en corral fresco", type: "number", placeholder: "50" },
    { id: "fr_corral_comedero", label: "Espacio comedero (cm/vaca)", type: "number", placeholder: "76", unit: "cm" },
    { id: "fr_corral_sobrepob", label: "Sobrepoblación (%)", type: "number", placeholder: "110", unit: "%" },
    { id: "fr_corral_camas_acceso", label: "Acceso a camas", type: "select", options: ["100% acceso", "80-99% acceso", "< 80% acceso", "Sin camas"] },
    { id: "fr_corral_camas_estado", label: "Estado de camas", type: "select", options: ["Excelente", "Bueno", "Regular", "Malo"] },
    { id: "fr_corral_descanso", label: "Tiempo descanso estimado (h/día)", type: "number", placeholder: "12", unit: "h" },
    { id: "fr_corral_barro", label: "Barro / estado del piso", type: "select", options: ["Seco y limpio", "Algo de barro", "Barro moderado", "Barro severo"] },
    { id: "fr_corral_ventilacion", label: "Ventilación / estrés calórico", type: "select", options: ["Adecuada, sin estrés", "Parcial, algo de estrés", "Inadecuada, estrés evidente"] },
    { id: "fr_corral_agua_n", label: "N° bebederos", type: "number", placeholder: "3" },
    { id: "fr_corral_agua_limp", label: "Limpieza de agua", type: "select", options: ["Limpia", "Aceptable", "Sucia", "Muy sucia"] },
    { id: "fr_corral_obs", label: "Observaciones del corral", type: "textarea", placeholder: "Accesos, sombra, pisos, problemas..." },
  ]},
  { id: "fr_dieta", title: "5. Dieta de frescas + manejo + protocolo", subtitle: "Composición, empuje, horarios, cambios de dieta, consistencia mezclado, fibra efectiva", customComponent: "ingredients", fields: [
    { id: "fr_dieta_empuje", label: "Rutina de empuje de comida", type: "select", options: ["Cada 1-2h", "Cada 2-4h", ">4h", "No se empuja", "No aplica"] },
    { id: "fr_dieta_horarios", label: "Horarios de entrega", type: "text", placeholder: "Ej: 6:00, 14:00, 20:00" },
    { id: "fr_dieta_freq_entrega", label: "Frecuencia de entrega", type: "select", options: ["1x/día", "2x/día", "3x/día", ">3x/día"] },
    { id: "fr_dieta_cambio", label: "Manejo de cambios de dieta (close-up → fresh → alta)", type: "textarea", placeholder: "Días en cada etapa, transición gradual o abrupta..." },
    { id: "fr_dieta_mezclado", label: "Consistencia de mezclado", type: "select", options: ["Excelente (orden, tiempo, cuchillas OK)", "Buena", "Regular (variabilidad)", "Mala (inconsistente)"] },
    { id: "fr_dieta_orden_carga", label: "Orden de carga y tiempo de mezclado", type: "textarea", placeholder: "Secuencia de ingredientes, minutos de mezcla..." },
    { id: "fr_dieta_fibra", label: "Fibra efectiva (evaluación)", type: "select", options: ["Adecuada", "Algo baja", "Baja (riesgo SARA/DA)", "Alta (limita consumo)"] },
    { id: "fr_dieta_sorting", label: "Sorting y relación con SARA/DA", type: "textarea", placeholder: "Evidencia de sorting, riesgo SARA..." },
  ]},
  { id: "fr_produccion", title: "6. Producción de leche", subtitle: "Leche a 7/14 DIM, % que alcanza metas, grasa/proteína, F:P", fields: [
    { id: "fr_prod_7dim", label: "Leche promedio a 7 DIM (lt/día)", type: "number", placeholder: "28", unit: "lt" },
    { id: "fr_prod_14dim", label: "Leche promedio a 14 DIM (lt/día)", type: "number", placeholder: "35", unit: "lt" },
    { id: "fr_prod_21dim", label: "Leche promedio a 21 DIM (lt/día, si disp.)", type: "number", placeholder: "40", unit: "lt" },
    { id: "fr_prod_meta", label: "Meta de producción (lt/día)", type: "number", placeholder: "38", unit: "lt" },
    { id: "fr_prod_pct_meta", label: "% vacas que alcanzan meta", type: "number", placeholder: "70", unit: "%" },
    { id: "fr_prod_grasa", label: "% Grasa", type: "number", placeholder: "3.8", step: "0.1", unit: "%" },
    { id: "fr_prod_prot", label: "% Proteína", type: "number", placeholder: "3.2", step: "0.1", unit: "%" },
    { id: "fr_prod_fp", label: "Ratio Grasa:Proteína (F:P)", type: "number", placeholder: "1.19", step: "0.01" },
    { id: "fr_prod_fp_interp", label: "Interpretación F:P", type: "textarea", placeholder: "F:P >1.4 → cetosis/BEN. F:P <1.0 → SARA. Observaciones..." },
    { id: "fr_prod_obs", label: "Observaciones producción", type: "textarea", placeholder: "Tendencias, vacas problema, curva de arranque..." },
  ]},
  { id: "fr_bcs", title: "7a. BCS en frescas", subtitle: "Evaluación vaca por vaca — variabilidad dentro del lote", customComponent: "cowscore_bcs", fields: [] },
  { id: "fr_heces", title: "7b. Score de Heces en frescas", subtitle: "Evaluación vaca por vaca — no solo el promedio", customComponent: "cowscore_heces", fields: [] },
  { id: "fr_rumen", title: "7c. Llenado Ruminal en frescas", subtitle: "Evaluación vaca por vaca — detección de vacas vacías", customComponent: "cowscore_rumen", fields: [] },
  { id: "fr_pennstate", title: "7d. Penn State en frescas", subtitle: "TMR vs refusas — sorting y variabilidad", customComponent: "pennstate", fields: [
    { id: "fr_ps_tmr_vs_ref", label: "Comparación TMR ofrecido vs refusas", type: "textarea", placeholder: "Diferencias de Penn State entre TMR fresco y rechazado..." },
    { id: "fr_ps_variab", label: "Variabilidad dentro del lote", type: "textarea", placeholder: "¿El promedio esconde problemas? Diferencias entre animales..." },
  ]},
  { id: "fr_plan", title: "8. Observaciones y Plan de Acción", subtitle: "Hallazgos, prioridades, responsables", fields: [
    { id: "fr_hallazgos", label: "Principales hallazgos", type: "textarea", placeholder: "Resumen de puntos críticos...", rows: 4 },
    { id: "fr_acciones", label: "Acciones priorizadas", type: "textarea", placeholder: "1. ...\n2. ...\n3. ...", rows: 4 },
    { id: "fr_responsables", label: "Responsables y plazos", type: "textarea", placeholder: "Acción → Responsable → Plazo", rows: 3 },
    { id: "fr_proxima", label: "Próxima visita", type: "date" },
    { id: "fr_notas", label: "Notas adicionales", type: "textarea" },
  ]},
];

const CATEGORIES = [
  { id: "preparto", name: "Preparto", icon: "cow", color: "#2D6A4F", sections: PREPARTO_SECTIONS },
  { id: "frescas", name: "Frescas (0-60 DIM)", icon: "chart", color: "#E76F51", sections: FRESCAS_SECTIONS },
  { id: "calidad_cama", name: "Calidad de Cama", icon: "thermo", color: "#7C3AED", sections: CALIDAD_CAMA_SECTIONS },
  { id: "calidad_alimento", name: "Calidad Alimento / Grano", icon: "layers", color: "#0891B2", sections: CALIDAD_ALIMENTO_SECTIONS },
  { id: "estres_calorico", name: "Verano / Estrés Calórico", icon: "sun", color: "#DC2626", sections: ESTRES_CALORICO_SECTIONS },
];

// ═══════════════════════════════════════════════════
// VISIT SUMMARY EXTRACTOR
// Extrae un resumen compacto de visit.data para mostrar
// en el historial sin abrir el detalle completo.
// ═══════════════════════════════════════════════════
const extractVisitSummary = (visit, category) => {
  const d = visit.data || {};
  const snippets = [];
  const kpis = [];

  if (!category) return { snippets: ["Sin categoría"], kpis: [] };

  // 1) Buscar hallazgos / observaciones principales (texto)
  const hallazgoKeys = [
    "hallazgos_principales", "fr_hallazgos", "cama_hallazgos",
    "ali_hallazgos", "ec_hallazgos",
  ];
  for (const k of hallazgoKeys) {
    if (d[k]) {
      const txt = String(d[k]).trim();
      snippets.push(txt.length > 120 ? txt.slice(0, 120) + "…" : txt);
      break; // solo el primero
    }
  }

  // ═══════════════════════════════════════════════════
// VISIT COMPARE — Δ entre 2 visitas del mismo módulo
// ═══════════════════════════════════════════════════
const VisitCompare = ({ visitA, visitB, category }) => {
  // visitA = más reciente, visitB = anterior
  if (!visitA || !visitB || !category) return null;
  const dA = visitA.data || {};
  const dB = visitB.data || {};

  // Recolectar todos los campos numéricos de las secciones
  const numericDiffs = [];
  const selectDiffs = [];

  category.sections.forEach(sec => {
    sec.fields.forEach(f => {
      const valA = dA[f.id];
      const valB = dB[f.id];
      if (valA == null && valB == null) return;

      if (f.type === "number") {
        const nA = parseFloat(valA);
        const nB = parseFloat(valB);
        if (!isNaN(nA) && !isNaN(nB) && nA !== nB) {
          const delta = round(nA - nB, 2);
          numericDiffs.push({
            label: f.label,
            prev: nB,
            curr: nA,
            delta,
            unit: f.unit || "",
            positive: delta > 0,
          });
        }
      } else if (f.type === "select" && valA && valB && valA !== valB) {
        selectDiffs.push({ label: f.label, prev: valB, curr: valA });
      }
    });

    // Compare cow score averages
    if (sec.customComponent?.startsWith("cowscore_")) {
      const csA = dA[`${sec.id}_cowscore`];
      const csB = dB[`${sec.id}_cowscore`];
      if (csA?.cows?.length && csB?.cows?.length) {
        const avgA = csA.cows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
        const avgB = csB.cows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
        if (avgA.length && avgB.length) {
          const mA = round(avgA.reduce((s, v) => s + v, 0) / avgA.length, 2);
          const mB = round(avgB.reduce((s, v) => s + v, 0) / avgB.length, 2);
          if (mA !== mB) {
            numericDiffs.push({
              label: sec.title + " (prom.)",
              prev: mB, curr: mA,
              delta: round(mA - mB, 2),
              unit: "", positive: mA > mB,
            });
          }
        }
      }
    }

    // Compare ketosis prevalence
    if (sec.customComponent === "ketosis") {
      const kA = dA[`${sec.id}_ketosis`];
      const kB = dB[`${sec.id}_ketosis`];
      if (kA?.cows?.length && kB?.cows?.length) {
        const prevA = round(kA.cows.filter(c => c.positivo).length / kA.cows.length * 100, 1);
        const prevB = round(kB.cows.filter(c => c.positivo).length / kB.cows.length * 100, 1);
        if (prevA !== prevB) {
          numericDiffs.push({
            label: "Prevalencia cetosis",
            prev: prevB, curr: prevA,
            delta: round(prevA - prevB, 1),
            unit: "%",
            positive: prevA < prevB, // lower is better
          });
        }
      }
    }
  });

  if (numericDiffs.length === 0 && selectDiffs.length === 0) {
    return (
      <div style={{ padding: "16px 20px", background: C.bg, borderRadius: 10, textAlign: "center", color: C.textLight, fontSize: 14 }}>
        No se encontraron diferencias comparables entre las dos visitas.
      </div>
    );
  }

  return (
    <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.borderLight}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: C.primaryDark, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Comparación entre visitas</span>
        <span style={{ fontSize: 12, opacity: 0.8 }}>{fmt(visitB.fecha)} → {fmt(visitA.fecha)}</span>
      </div>

      {numericDiffs.length > 0 && (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textLight, marginBottom: 10 }}>Valores numéricos (Δ)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {numericDiffs.map((d, i) => (
              <div key={i} style={{ padding: "10px 12px", background: C.bg, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: C.textLight, marginBottom: 2 }}>{d.label}</div>
                  <div style={{ fontSize: 12, color: C.textLight }}>
                    <span>{d.prev}{d.unit}</span>
                    <span style={{ margin: "0 6px", color: C.border }}>→</span>
                    <span style={{ fontWeight: 600, color: C.text }}>{d.curr}{d.unit}</span>
                  </div>
                </div>
                <div style={{
                  padding: "4px 10px", borderRadius: 6, fontWeight: 700, fontSize: 14,
                  background: d.positive ? C.success + "15" : C.danger + "15",
                  color: d.positive ? C.success : C.danger,
                }}>
                  {d.delta > 0 ? "+" : ""}{d.delta}{d.unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectDiffs.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textLight, marginBottom: 10 }}>Cambios categóricos</div>
          {selectDiffs.map((d, i) => (
            <div key={i} style={{ padding: "8px 12px", background: C.bg, borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: C.text }}>{d.label}: </span>
              <span style={{ color: C.textLight, textDecoration: "line-through" }}>{d.prev}</span>
              <span style={{ margin: "0 6px", color: C.border }}>→</span>
              <span style={{ fontWeight: 600, color: C.primary }}>{d.curr}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

  // 2) Buscar acciones priorizadas
  const accionKeys = [
    "acciones_priorizadas", "fr_acciones", "cama_acciones",
    "ali_acciones", "ec_acciones",
  ];
  for (const k of accionKeys) {
    if (d[k]) {
      const lines = String(d[k]).split("\n").filter(l => l.trim());
      kpis.push({ label: "Acciones", value: `${lines.length}`, color: C.accent });
      break;
    }
  }

  // 3) BCS promedio (preparto o frescas)
  for (const sec of category.sections) {
    if (sec.customComponent === "cowscore_bcs") {
      const cs = d[`${sec.id}_cowscore`];
      if (cs?.cows?.length) {
        const scores = cs.cows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
        if (scores.length) {
          const avg = round(scores.reduce((s, v) => s + v, 0) / scores.length, 2);
          kpis.push({ label: "BCS prom.", value: avg, color: avg >= 3.0 && avg <= 3.5 ? C.success : C.accent });
        }
      }
    }
  }

  // 4) Cetosis prevalencia
  for (const sec of category.sections) {
    if (sec.customComponent === "ketosis") {
      const kt = d[`${sec.id}_ketosis`];
      if (kt?.cows?.length) {
        const pos = kt.cows.filter(c => c.positivo).length;
        const prev = round(pos / kt.cows.length * 100, 1);
        kpis.push({ label: "Cetosis", value: `${prev}%`, color: prev > 15 ? C.danger : prev > 10 ? C.warning : C.success });
      }
    }
  }

  // 5) Enfermedades — incidencias altas
  for (const sec of category.sections) {
    if (sec.customComponent === "diseases") {
      const dis = d[`${sec.id}_diseases`];
      if (dis?.paridas_ventana) {
        const dIds = ["da", "hipocalcemia", "rp", "metritis", "cetosis_cl", "mastitis", "neumonia", "cojera"];
        let alertCount = 0;
        dIds.forEach(dId => {
          const inc = parseFloat(dis[`${dId}_incidencia`]) || 0;
          if (inc > 10) alertCount++;
        });
        if (alertCount > 0) kpis.push({ label: "Enf. altas", value: alertCount, color: C.danger });
      }
    }
  }

  // 6) Producción a 14 DIM
  if (d.fr_prod_14dim) {
    kpis.push({ label: "Lt 14DIM", value: d.fr_prod_14dim, color: C.primary });
  }

  // 7) ITH
  if (d.ec_ith) {
    const ith = parseFloat(d.ec_ith);
    kpis.push({ label: "ITH", value: ith, color: ith > 80 ? C.danger : ith > 72 ? C.warning : C.success });
  }

  // 8) CMS / DMI
  if (d.cms_oferta_kg || d.fr_dmi_oferta) {
    const val = d.fr_dmi_oferta || d.cms_oferta_kg;
    kpis.push({ label: "CMS", value: `${val} kg`, color: C.primary });
  }

  // 9) Ingredientes count
  for (const sec of category.sections) {
    if (sec.customComponent === "ingredients") {
      const ings = d[`${sec.id}_ingredients`];
      if (ings?.length) {
        const totalMS = ings.reduce((s, i) => s + (parseFloat(i.kg_ms) || 0), 0);
        if (totalMS > 0) kpis.push({ label: "Dieta kgMS", value: round(totalMS, 1), color: C.primaryLight });
        break;
      }
    }
  }

  // Fallback si no hay snippets
  if (snippets.length === 0) {
    // Contar campos con datos
    let filled = 0;
    for (const sec of category.sections) {
      sec.fields.forEach(f => { if (d[f.id]) filled++; });
    }
    snippets.push(filled > 0 ? `${filled} campos completados` : "Visita sin datos cargados");
  }

  return { snippets, kpis };
};

// ═══════════════════════════════════════════════════
// VISIT HISTORY PANEL — Filtros + Timeline + Expand
// Se usa dentro de ClientDetail en vez del listado plano
// ═══════════════════════════════════════════════════
const VisitHistoryPanel = ({
  visits,
  onView, onEdit, onDelete,
  onDownloadTxt, onDownloadCsv,
}) => {
  const [filterCat, setFilterCat] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterText, setFilterText] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [compareVisitId, setCompareVisitId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Categorías presentes en las visitas de este cliente
  const presentCats = useMemo(() => {
    const ids = new Set(visits.map(v => v.categoryId));
    return CATEGORIES.filter(c => ids.has(c.id));
  }, [visits]);

  // Filtrado
  const filtered = useMemo(() => {
    return visits.filter(v => {
      if (filterCat !== "all" && v.categoryId !== filterCat) return false;
      if (filterDateFrom && v.fecha < filterDateFrom) return false;
      if (filterDateTo && v.fecha > filterDateTo) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        const d = v.data || {};
        const cat = CATEGORIES.find(c => c.id === v.categoryId);
        const catName = cat?.name?.toLowerCase() || "";
        const tecnico = (v.tecnico || "").toLowerCase();
        // Buscar en hallazgos, acciones, notas
        const haystack = [
          catName, tecnico,
          d.hallazgos_principales, d.fr_hallazgos, d.cama_hallazgos, d.ali_hallazgos, d.ec_hallazgos,
          d.acciones_priorizadas, d.fr_acciones, d.cama_acciones, d.ali_acciones, d.ec_acciones,
          d.notas_adicionales, d.fr_notas,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [visits, filterCat, filterDateFrom, filterDateTo, filterText]);

  // Agrupar por mes para timeline
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(v => {
      const key = v.fecha ? v.fecha.slice(0, 7) : "sin-fecha"; // YYYY-MM
      if (!map[key]) map[key] = [];
      map[key].push(v);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const monthLabel = (ym) => {
    if (ym === "sin-fecha") return "Sin fecha";
    const [y, m] = ym.split("-");
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  // Para comparar: buscar visita anterior del mismo módulo
  const findPrevVisit = (visit) => {
    const sameCat = visits
      .filter(v => v.categoryId === visit.categoryId && v.id !== visit.id && v.fecha <= visit.fecha)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    return sameCat[0] || null;
  };

  const activeFilters = (filterCat !== "all" ? 1 : 0) + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0) + (filterText ? 1 : 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="clipboard" size={20} color={C.primary} />
          Historial de visitas
          <span style={{ fontSize: 13, fontWeight: 400, color: C.textLight }}>({filtered.length}{filtered.length !== visits.length ? ` de ${visits.length}` : ""})</span>
        </h3>
        <Btn
          variant={showFilters ? "primary" : "outline"}
          size="sm"
          icon="filter"
          onClick={() => setShowFilters(!showFilters)}
        >
          Filtros{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </Btn>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card style={{ marginBottom: 16, padding: 16, background: C.bg, border: `1.5px solid ${C.primary}20` }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Módulo</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: "8px 10px", cursor: "pointer" }}>
                <option value="all">Todos los módulos</option>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Desde</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Hasta</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Buscar en notas</label>
              <input type="text" placeholder="Buscar..." value={filterText} onChange={e => setFilterText(e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }} />
            </div>
          </div>
          {activeFilters > 0 && (
            <div style={{ marginTop: 10, textAlign: "right" }}>
              <Btn variant="ghost" size="sm" onClick={() => { setFilterCat("all"); setFilterDateFrom(""); setFilterDateTo(""); setFilterText(""); }}>
                Limpiar filtros
              </Btn>
            </div>
          )}
        </Card>
      )}

      {/* Category quick-filter pills (always visible) */}
      {presentCats.length > 1 && !showFilters && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <button onClick={() => setFilterCat("all")} style={{
            padding: "5px 12px", fontSize: 12, fontWeight: 600, fontFamily: ff, borderRadius: 16, border: "none", cursor: "pointer",
            background: filterCat === "all" ? C.primary : C.borderLight, color: filterCat === "all" ? "#fff" : C.text,
          }}>Todos</button>
          {presentCats.map(c => (
            <button key={c.id} onClick={() => setFilterCat(filterCat === c.id ? "all" : c.id)} style={{
              padding: "5px 12px", fontSize: 12, fontWeight: 600, fontFamily: ff, borderRadius: 16, border: "none", cursor: "pointer",
              background: filterCat === c.id ? c.color : c.color + "15", color: filterCat === c.id ? "#fff" : c.color,
            }}>{c.name}</button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
          <p style={{ color: C.textLight, margin: 0 }}>
            {visits.length === 0 ? "Sin visitas registradas aún." : "No hay visitas que coincidan con los filtros."}
          </p>
        </Card>
      )}

      {/* Timeline grouped by month */}
      {grouped.map(([ym, monthVisits]) => (
        <div key={ym} style={{ marginBottom: 20 }}>
          {/* Month label */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.primary }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: 0.5 }}>{monthLabel(ym)}</span>
            <div style={{ flex: 1, height: 1, background: C.borderLight }} />
            <span style={{ fontSize: 12, color: C.textLight }}>{monthVisits.length} visita{monthVisits.length > 1 ? "s" : ""}</span>
          </div>

          {/* Visit cards */}
          {monthVisits.map(v => {
            const cat = CATEGORIES.find(c => c.id === v.categoryId);
            const isExpanded = expandedId === v.id;
            const summary = extractVisitSummary(v, cat);
            const prevVisit = findPrevVisit(v);
            const isComparing = compareVisitId === v.id;

            return (
              <div key={v.id} style={{ marginLeft: 4, borderLeft: `3px solid ${cat?.color || C.primary}25`, paddingLeft: 16, marginBottom: 8 }}>
                <Card style={{ padding: 14, borderLeft: `4px solid ${cat?.color || C.primary}` }}>
                  {/* Card header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <Badge color={cat?.color}>{cat?.name || v.categoryId}</Badge>
                        <span style={{ fontSize: 13, color: C.textLight }}>{fmt(v.fecha)}</span>
                        <span style={{ fontSize: 12, color: C.textLight + "80" }}>— {v.tecnico}</span>
                      </div>

                      {/* KPI pills */}
                      {summary.kpis.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                          {summary.kpis.map((kpi, i) => (
                            <span key={i} style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "2px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                              background: kpi.color + "15", color: kpi.color,
                            }}>
                              {kpi.label}: {kpi.value}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Snippet */}
                      {summary.snippets.map((s, i) => (
                        <p key={i} style={{ fontSize: 13, color: C.textLight, margin: 0, lineHeight: 1.4 }}>{s}</p>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0 }}>
                      <Btn variant="outline" size="sm" icon="eye" onClick={() => onView(v, cat)}>Ver</Btn>
                      <Btn variant="ghost" size="sm" icon="edit" onClick={() => onEdit(v, cat)} />
                      <Btn variant="ghost" size="sm" icon="download" onClick={() => onDownloadTxt(v)} title="Descargar TXT" />
                      {prevVisit && (
                        <Btn
                          variant={isComparing ? "primary" : "ghost"}
                          size="sm"
                          icon="compare"
                          onClick={() => setCompareVisitId(isComparing ? null : v.id)}
                          title="Comparar con visita anterior"
                        >Δ</Btn>
                      )}
                      <Btn variant="ghost" size="sm" icon="trash" onClick={() => onDelete(v)} style={{ color: C.danger }} />
                    </div>
                  </div>

                  {/* Comparison panel (inline) */}
                  {isComparing && prevVisit && (
                    <div style={{ marginTop: 12 }}>
                      <VisitCompare visitA={v} visitB={prevVisit} category={cat} />
                    </div>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════
const generateTextReport = (visit, client, category) => {
  let txt = "═══════════════════════════════════════════════════════\n";
  txt += `  INFORME DE VISITA - ${category.name.toUpperCase()}\n`;
  txt += "═══════════════════════════════════════════════════════\n\n";
  txt += `  Cliente: ${client.nombre}\n  Establecimiento: ${client.establecimiento}\n`;
  txt += `  Localidad: ${client.localidad || "-"}\n  Fecha: ${fmt(visit.fecha)}\n  Técnico: ${visit.tecnico || "-"}\n\n`;

  category.sections.forEach(sec => {
    txt += `───────────────────────────────────────────────────────\n`;
    txt += `▸ ${sec.title}\n  ${sec.subtitle}\n\n`;

    // Ingredients
    if (sec.customComponent === "ingredients") {
      const ings = visit.data?.[`${sec.id}_ingredients`];
      if (ings?.length) {
        txt += "  Ingrediente                    kg TC    %MS    kg MS\n";
        txt += "  ─────────────────────────────────────────────────\n";
        ings.forEach(i => {
          txt += `  ${(i.name || "").padEnd(32)} ${(i.kg_tal_cual || "-").toString().padStart(6)} ${(i.ms_pct || "-").toString().padStart(5)}  ${(i.kg_ms || "-").toString().padStart(6)}\n`;
        });
        const totalTC = ings.reduce((s, i) => s + (parseFloat(i.kg_tal_cual) || 0), 0);
        const totalMS = ings.reduce((s, i) => s + (parseFloat(i.kg_ms) || 0), 0);
        txt += `  ${"TOTAL".padEnd(32)} ${round(totalTC, 1).toString().padStart(6)} ${(totalTC > 0 ? round(totalMS / totalTC * 100, 1) + "%" : "-").padStart(5)}  ${round(totalMS, 1).toString().padStart(6)}\n\n`;
      }
    }

    // Penn State
    if (sec.customComponent === "pennstate") {
      const ps = visit.data?.[`${sec.id}_pennstate`];
      if (ps) {
        ["sup", "med", "inf", "fondo"].forEach(t => {
          const labels = { sup: "Superior (>19mm)", med: "Media (8-19mm)", inf: "Inferior (1.18-8mm)", fondo: "Fondo (<1.18mm)" };
          txt += `  ${labels[t]}:\n`;
          txt += `    Inicio: ${ps[`${t}_inicio`] || "-"}%  Medio: ${ps[`${t}_medio`] || "-"}%  Final: ${ps[`${t}_final`] || "-"}%\n`;
          txt += `    → Promedio: ${ps[`${t}_avg`] || "-"}%  Variación: ${ps[`${t}_var`] || "-"}%  CV: ${ps[`${t}_cv`] || "-"}%\n`;
        });
        txt += `  Sorting: ${ps.sorting || "-"}\n`;
        if (ps.obs) txt += `  Obs: ${ps.obs}\n`;
        txt += "\n";
      }
    }

    // Cow scores
    if (sec.customComponent?.startsWith("cowscore_")) {
      const type = sec.customComponent.replace("cowscore_", "");
      const data = visit.data?.[`${sec.id}_cowscore`];
      if (data?.cows?.length) {
        const scores = data.cows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
        const n = scores.length;
        const avg = n > 0 ? round(scores.reduce((s, v) => s + v, 0) / n, 2) : "-";
        txt += `  N evaluadas: ${n}  Promedio: ${avg}  Min: ${n > 0 ? Math.min(...scores) : "-"}  Max: ${n > 0 ? Math.max(...scores) : "-"}\n`;
        txt += `  Detalle:\n`;
        data.cows.forEach(c => {
          txt += `    ${c.caravana || "s/id"}: ${c.score || "-"} ${c.nota ? `(${c.nota})` : ""}\n`;
        });
        if (data.obs) txt += `  Obs: ${data.obs}\n`;
        txt += "\n";
      }
    }

    // Ketosis
    if (sec.customComponent === "ketosis") {
      const d = visit.data?.[`${sec.id}_ketosis`];
      if (d?.cows?.length) {
        const pos = d.cows.filter(c => c.positivo).length;
        txt += `  Testeadas: ${d.cows.length}  Positivas: ${pos}  Prevalencia: ${d.cows.length > 0 ? round(pos / d.cows.length * 100, 1) : "—"}%\n`;
        d.cows.forEach(c => { txt += `    ${c.caravana || "s/id"} DIM:${c.dim || "-"} ${c.metodo}: ${c.resultado || "-"} ${c.positivo ? "⊕" : "⊖"} ${c.nota || ""}\n`; });
        if (d.obs) txt += `  Protocolo: ${d.obs}\n`;
        txt += "\n";
      }
    }

    // Diseases
    if (sec.customComponent === "diseases") {
      const d = visit.data?.[`${sec.id}_diseases`];
      if (d) {
        txt += `  Paridas ventana: ${d.paridas_ventana || "-"} | Período: ${d.periodo_dias || "-"}\n`;
        ["da", "hipocalcemia", "rp", "metritis", "cetosis_cl", "mastitis", "neumonia", "cojera"].forEach(dis => {
          if (d[`${dis}_casos`]) txt += `    ${dis}: ${d[`${dis}_casos`]} casos → ${d[`${dis}_incidencia`] || "?"}% | Reincid: ${d[`${dis}_reincid`] || 0} | ${d[`${dis}_protocolo`] || ""}\n`;
        });
        txt += `  Mortalidad: ${d.mortalidad || "-"} | Descartes: ${d.descartes || "-"} | 1ª IA: ${d.dias_1ia || "-"}\n`;
        if (d.obs_salud) txt += `  Obs: ${d.obs_salud}\n`;
        txt += "\n";
      }
    }

    // Bedding evaluation
    if (sec.customComponent === "bedding") {
      const d = visit.data?.[`${sec.id}_bedding`];
      if (d?.points?.length) {
        txt += `  Puntos medidos: ${d.points.length}\n`;
        d.points.forEach(p => { txt += `    #${p.num} ${p.ubicacion || "s/ubic"}: T°sup ${p.temp_sup || "-"}°C T°prof ${p.temp_prof || "-"}°C Hum.sup ${p.hum_sup || "-"} Hum.prof ${p.hum_prof || "-"} Prof ${p.profundidad || "-"}cm\n`; });
        if (d.obs) txt += `  Obs: ${d.obs}\n`;
        txt += "\n";
      }
    }

    // Cleanliness scoring
    if (sec.customComponent === "cleanliness") {
      const d = visit.data?.[`${sec.id}_cleanliness`];
      if (d?.cows?.length) {
        txt += `  N evaluadas: ${d.cows.length}\n`;
        d.cows.forEach(c => { txt += `    ${c.caravana || c.num}: Ubre:${c.ubre || "-"} Patas:${c.patas || "-"} Flanco:${c.flanco || "-"}\n`; });
        if (d.obs) txt += `  Obs: ${d.obs}\n`;
        txt += "\n";
      }
    }

    // Grain processing
    if (sec.customComponent === "grain") {
      const d = visit.data?.[`${sec.id}_grain`];
      if (d && d.total_g) {
        ["t1", "t2", "t3", "t4", "t5"].forEach(t => { if (d[t]) txt += `    ${t}: ${d[t]}g (${d[`${t}_pct`] || "?"}%)\n`; });
        txt += `  % Granos rotos: ${d.pct_rotos || "-"}%  MPS: ~${d.mps || "-"}μ\n`;
        if (d.obs) txt += `  Obs: ${d.obs}\n`;
        txt += "\n";
      }
    }

    // Regular fields
    sec.fields.forEach(f => {
      const val = visit.data?.[f.id];
      if (val) txt += `    ${f.label}: ${val}${f.unit ? ` ${f.unit}` : ""}\n`;
    });
    txt += "\n";
  });

  txt += "═══════════════════════════════════════════════════════\n";
  txt += `  Generado: ${new Date().toLocaleString("es-AR")}\n`;
  txt += "═══════════════════════════════════════════════════════\n";
  return txt;
};

const generateCSV = (visit, client, category) => {
  let csv = "Seccion,Campo,Valor\n";
  csv += `Info,Cliente,"${client.nombre}"\nInfo,Establecimiento,"${client.establecimiento}"\nInfo,Fecha,"${fmt(visit.fecha)}"\n\n`;
  category.sections.forEach(sec => {
    if (sec.customComponent === "ingredients") {
      const ings = visit.data?.[`${sec.id}_ingredients`] || [];
      ings.forEach(i => {
        csv += `"${sec.title}","${i.name}","TC:${i.kg_tal_cual||0} MS%:${i.ms_pct||0} kgMS:${i.kg_ms||0}"\n`;
      });
    }
    if (sec.customComponent?.startsWith("cowscore_")) {
      const data = visit.data?.[`${sec.id}_cowscore`];
      (data?.cows || []).forEach(c => {
        csv += `"${sec.title}","${c.caravana || c.num}","${c.score}","${c.nota || ""}"\n`;
      });
    }
    if (sec.customComponent === "ketosis") {
      const d = visit.data?.[`${sec.id}_ketosis`];
      (d?.cows || []).forEach(c => { csv += `"${sec.title}","${c.caravana || c.num}","DIM:${c.dim} ${c.metodo}:${c.resultado} ${c.positivo ? '+' : '-'}","${c.nota || ''}"\n`; });
    }
    if (sec.customComponent === "diseases") {
      const d = visit.data?.[`${sec.id}_diseases`] || {};
      csv += `"${sec.title}","Paridas ventana","${d.paridas_ventana || ''}"\n`;
      ["da","hipocalcemia","rp","metritis","cetosis_cl","mastitis","neumonia","cojera"].forEach(dis => {
        if (d[`${dis}_casos`]) csv += `"${sec.title}","${dis}","Casos:${d[`${dis}_casos`]} Incid:${d[`${dis}_incidencia`]||'?'}% Reincid:${d[`${dis}_reincid`]||0}"\n`;
      });
    }
    if (sec.customComponent === "bedding") {
      (visit.data?.[`${sec.id}_bedding`]?.points || []).forEach(p => { csv += `"${sec.title}","Punto ${p.num} ${p.ubicacion||''}","Tsup:${p.temp_sup||''} Tprof:${p.temp_prof||''} Prof:${p.profundidad||''}cm"\n`; });
    }
    if (sec.customComponent === "cleanliness") {
      (visit.data?.[`${sec.id}_cleanliness`]?.cows || []).forEach(c => { csv += `"${sec.title}","${c.caravana||c.num}","Ubre:${c.ubre||''} Patas:${c.patas||''} Flanco:${c.flanco||''}"\n`; });
    }
    if (sec.customComponent === "grain") {
      const d = visit.data?.[`${sec.id}_grain`] || {};
      if (d.total_g) csv += `"${sec.title}","Resultado","Rotos:${d.pct_rotos||''}% MPS:${d.mps||''}μ Total:${d.total_g||''}g"\n`;
    }
    sec.fields.forEach(f => {
      const val = visit.data?.[f.id] || "";
      csv += `"${sec.title}","${f.label}","${String(val).replace(/"/g, '""')}"\n`;
    });
  });
  return csv;
};

const downloadFile = (content, filename, mime) => {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
};

const generateHTMLReport = (visit, client, category) => {
  const d = visit.data || {};
  const accentColor = category.color || "#1565C0";

  const sectionHTML = category.sections.map(sec => {
    const fields = sec.fields.filter(f => d[f.id]);
    const hasCustom = sec.customComponent;

    let customContent = "";

    if (sec.customComponent === "ingredients") {
      const ings = d[`${sec.id}_ingredients`] || [];
      if (ings.length) {
        const totalTC = round(ings.reduce((s, i) => s + (parseFloat(i.kg_tal_cual) || 0), 0), 1);
        const totalMS = round(ings.reduce((s, i) => s + (parseFloat(i.kg_ms) || 0), 0), 1);
        const rows = ings.map(i => `<tr><td>${i.name}</td><td style="text-align:right">${i.kg_tal_cual || "—"}</td><td style="text-align:center">${i.ms_pct}%</td><td style="text-align:right">${i.kg_ms || "—"}</td></tr>`).join("");
        customContent = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">
          <thead><tr style="background:${accentColor}15"><th style="padding:6px 8px;text-align:left">Ingrediente</th><th style="padding:6px 8px;text-align:right">kg TC</th><th style="padding:6px 8px;text-align:center">%MS</th><th style="padding:6px 8px;text-align:right">kg MS</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="background:${accentColor}10;font-weight:700"><td style="padding:6px 8px">TOTAL</td><td style="padding:6px 8px;text-align:right">${totalTC} kg</td><td></td><td style="padding:6px 8px;text-align:right">${totalMS} kg MS</td></tr></tfoot>
        </table>`;
      }
    }

    if (sec.customComponent?.startsWith("cowscore_")) {
      const cs = d[`${sec.id}_cowscore`];
      if (cs?.cows?.length) {
        const scores = cs.cows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
        const n = scores.length;
        if (n > 0) {
          const avg = round(scores.reduce((s, v) => s + v, 0) / n, 2);
          const min = Math.min(...scores);
          const max = Math.max(...scores);
          const pctFuera = round(scores.filter(v => {
            const cfg = sec.customComponent === "cowscore_bcs" ? [3.0, 3.5] : sec.customComponent === "cowscore_heces" ? [3.0, 3.5] : [3.5, 4.5];
            return v < cfg[0] || v > cfg[1];
          }).length / n * 100, 1);
          customContent = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">
            <div style="padding:10px 16px;background:${accentColor}10;border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700;color:${accentColor}">${avg}</div><div style="font-size:11px;color:#666">Promedio</div></div>
            <div style="padding:10px 16px;background:#fff3e0;border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700;color:#e65100">${min}</div><div style="font-size:11px;color:#666">Mínimo</div></div>
            <div style="padding:10px 16px;background:#e8f5e9;border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700;color:#2e7d32">${max}</div><div style="font-size:11px;color:#666">Máximo</div></div>
            <div style="padding:10px 16px;background:${pctFuera > 20 ? "#ffebee" : "#e8f5e9"};border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700;color:${pctFuera > 20 ? "#c62828" : "#2e7d32"}">${pctFuera}%</div><div style="font-size:11px;color:#666">Fuera objetivo</div></div>
            <div style="padding:10px 16px;background:#f5f5f5;border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700;color:#333">${n}</div><div style="font-size:11px;color:#666">Evaluadas</div></div>
          </div>`;
        }
      }
    }

    if (sec.customComponent === "ketosis") {
      const kt = d[`${sec.id}_ketosis`];
      if (kt?.cows?.length) {
        const pos = kt.cows.filter(c => c.positivo).length;
        const prev = round(pos / kt.cows.length * 100, 1);
        const color = prev > 15 ? "#c62828" : prev > 10 ? "#e65100" : "#2e7d32";
        customContent = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">
          <div style="padding:10px 16px;background:#f5f5f5;border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700;color:#333">${kt.cows.length}</div><div style="font-size:11px;color:#666">Testeadas</div></div>
          <div style="padding:10px 16px;background:${pos > 0 ? "#ffebee" : "#e8f5e9"};border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700;color:${pos > 0 ? "#c62828" : "#2e7d32"}">${pos}</div><div style="font-size:11px;color:#666">Positivas</div></div>
          <div style="padding:10px 16px;background:${prev > 15 ? "#ffebee" : "#e8f5e9"};border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700;color:${color}">${prev}%</div><div style="font-size:11px;color:#666">Prevalencia</div></div>
        </div>
        <p style="margin-top:8px;padding:8px 12px;border-radius:6px;font-size:13px;background:${prev > 15 ? "#ffebee" : "#e8f5e9"};color:${color};font-weight:600">
          ${prev > 15 ? "⚠️ Prevalencia alta (>15%). Revisar dieta de transición y balance energético." : prev > 10 ? "⚡ Prevalencia moderada (10-15%). Monitorear de cerca." : "✅ Prevalencia dentro del objetivo (<10%). Buen resultado."}
        </p>`;
      }
    }

    if (sec.customComponent === "diseases") {
      const dis = d[`${sec.id}_diseases`];
      if (dis?.paridas_ventana) {
        const dNames = { da: "DA (Desplaz. Abomaso)", hipocalcemia: "Hipocalcemia clínica", rp: "Retención placentaria", metritis: "Metritis", cetosis_cl: "Cetosis clínica", mastitis: "Mastitis clínica", neumonia: "Neumonía", cojera: "Cojera" };
        const refs = { da: 5, hipocalcemia: 5, rp: 8, metritis: 10, cetosis_cl: 5, mastitis: 2, neumonia: 2, cojera: 5 };
        const rows = Object.entries(dNames).filter(([id]) => dis[`${id}_casos`]).map(([id, label]) => {
          const inc = parseFloat(dis[`${id}_incidencia`]) || 0;
          const ref = refs[id] || 10;
          const bg = inc > ref * 1.5 ? "#ffebee" : inc > ref ? "#fff8e1" : "#e8f5e9";
          const color = inc > ref * 1.5 ? "#c62828" : inc > ref ? "#e65100" : "#2e7d32";
          return `<tr style="background:${bg}"><td style="padding:6px 10px">${label}</td><td style="padding:6px 10px;text-align:center">${dis[`${id}_casos`]}</td><td style="padding:6px 10px;text-align:center;font-weight:700;color:${color}">${dis[`${id}_incidencia`] || "?"}%</td><td style="padding:6px 10px;text-align:center;color:#888">&lt;${ref}%</td></tr>`;
        }).join("");
        if (rows) {
          customContent = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">
            <thead><tr style="background:${accentColor}15"><th style="padding:6px 10px;text-align:left">Enfermedad</th><th style="padding:6px 10px;text-align:center">Casos</th><th style="padding:6px 10px;text-align:center">Incidencia</th><th style="padding:6px 10px;text-align:center">Referencia</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:6px;font-size:12px;color:#666">Paridas en ventana: ${dis.paridas_ventana} | Período: ${dis.periodo_dias || "—"}</p>`;
        }
      }
    }

    if (fields.length === 0 && !customContent) return "";

    const fieldRows = fields.map(f => {
      const val = d[f.id];
      if (!val) return "";
      if (f.type === "textarea") {
        return `<div style="margin-bottom:10px"><div style="font-size:12px;font-weight:600;color:#666;margin-bottom:3px">${f.label}</div><div style="padding:8px 12px;background:#f9f9f9;border-radius:6px;font-size:14px;white-space:pre-wrap;border-left:3px solid ${accentColor}40">${val}</div></div>`;
      }
      return `<div style="display:inline-block;margin:4px 12px 4px 0"><span style="font-size:12px;color:#666">${f.label}: </span><span style="font-size:14px;font-weight:600;color:#1e3a5f">${val}${f.unit ? ` ${f.unit}` : ""}</span></div>`;
    }).join("");

    return `<div style="margin-bottom:20px;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;border-left:4px solid ${accentColor}">
      <div style="background:${accentColor}08;padding:12px 16px;border-bottom:1px solid #f0f0f0">
        <div style="font-weight:700;font-size:15px;color:#1e3a5f">${sec.title}</div>
        <div style="font-size:12px;color:#888;margin-top:2px">${sec.subtitle}</div>
      </div>
      <div style="padding:14px 16px">
        ${customContent}
        ${fieldRows}
      </div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Informe NutriSur - ${client.nombre}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; color: #333; }
  .page { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #0d47a1, #1565c0); color: #fff; padding: 32px 40px; }
  .header h1 { margin: 0 0 4px; font-size: 26px; }
  .header .subtitle { font-size: 14px; opacity: 0.85; }
  .meta { display: flex; gap: 24px; margin-top: 20px; flex-wrap: wrap; }
  .meta-item { font-size: 13px; }
  .meta-item span { display: block; opacity: 0.7; font-size: 11px; margin-bottom: 2px; }
  .content { padding: 32px 40px; }
  .category-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; color: ${accentColor}; background: ${accentColor}15; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #f0f0f0; }
  .footer { padding: 20px 40px; background: #f8f8f8; border-top: 1px solid #eee; font-size: 12px; color: #888; display: flex; justify-content: space-between; }
  @media print { body { background: white; padding: 0; } .page { box-shadow: none; border-radius: 0; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:22px;font-weight:800;letter-spacing:1px;margin-bottom:4px">🐄 NutriSur</div>
        <h1>${category.name}</h1>
        <div class="subtitle">Informe de Visita Técnica</div>
      </div>
      <div style="text-align:right;font-size:13px;opacity:0.85">
        <div style="font-size:18px;font-weight:700">${fmt(visit.fecha) || "—"}</div>
      </div>
    </div>
    <div class="meta">
      <div class="meta-item"><span>Productor</span>${client.nombre}</div>
      <div class="meta-item"><span>Establecimiento</span>${client.establecimiento}</div>
      ${client.localidad ? `<div class="meta-item"><span>Localidad</span>${client.localidad}</div>` : ""}
      <div class="meta-item"><span>Técnico</span>${visit.tecnico || "—"}</div>
    </div>
  </div>
  <div class="content">
    <div class="category-badge">${category.name}</div>
    ${sectionHTML}
  </div>
  <div class="footer">
    <span>Generado por NutriSur · Sistema de Auditoría Lechera</span>
    <span>${new Date().toLocaleString("es-UY")}</span>
  </div>
</div>
</body>
</html>`;
};

const makeDownloadReport = (currentClient, flashFn) => (visit, type) => {
    const cat = CATEGORIES.find(c => c.id === visit.categoryId);
    if (!cat || !currentClient) return flashFn("Error: falta info de categoría o cliente", "error");
    const name = `NutriSur_${currentClient.nombre}_${cat.name}_${visit.fecha || "sin-fecha"}`.replace(/\s+/g, "_");
    if (type === "txt") {
      downloadFile(generateTextReport(visit, currentClient, cat), `${name}.txt`, "text/plain;charset=utf-8");
    } else if (type === "html") {
      downloadFile(generateHTMLReport(visit, currentClient, cat), `${name}.html`, "text/html;charset=utf-8");
    } else {
      downloadFile(generateCSV(visit, currentClient, cat), `${name}.csv`, "text/csv;charset=utf-8");
    }
  };
// ═══════════════════════════════════════════════════
// METRICS CONFIG (fuera de cualquier componente)
// ═══════════════════════════════════════════════════
const METRICS = [
  { id: "bcs",            label: "BCS promedio",              unit: "",    ref: [2.75, 3.25], cat: "preparto",        extract: (v) => { const cs = v.data?.pr_bcs_cowscore || v.data?.fr_bcs_cowscore; if (!cs?.cows?.length) return null; const s = cs.cows.map(c => parseFloat(c.score)).filter(x => !isNaN(x)); return s.length ? round(s.reduce((a,b)=>a+b,0)/s.length,2) : null; } },
  { id: "cetosis",        label: "Cetosis %",                 unit: "%",   ref: [0, 15],      cat: "frescas",         extract: (v) => { const kt = v.data?.fr_cetosis_ketosis; if (!kt?.cows?.length) return null; return round(kt.cows.filter(c=>c.positivo).length/kt.cows.length*100,1); } },
  { id: "leche14",        label: "Leche 14 DIM",              unit: "lt",  ref: [20, 35],     cat: "frescas",         extract: (v) => parseFloat(v.data?.fr_prod_14dim) || null },
  { id: "leche7",         label: "Leche 7 DIM",               unit: "lt",  ref: [15, 30],     cat: "frescas",         extract: (v) => parseFloat(v.data?.fr_prod_7dim) || null },
  { id: "grasa",          label: "% Grasa",                   unit: "%",   ref: [3.5, 4.5],   cat: "frescas",         extract: (v) => parseFloat(v.data?.fr_prod_grasa) || null },
  { id: "proteina",       label: "% Proteína",                unit: "%",   ref: [3.0, 3.8],   cat: "frescas",         extract: (v) => parseFloat(v.data?.fr_prod_prot) || null },
  { id: "cms_oferta",     label: "CMS oferta",                unit: "kg",  ref: [18, 26],     cat: "frescas",         extract: (v) => parseFloat(v.data?.fr_dmi_oferta) || null },
  { id: "ith",            label: "ITH calórico",              unit: "",    ref: [0, 72],      cat: "estres_calorico", extract: (v) => parseFloat(v.data?.ec_ith) || null },
  { id: "temp_cama_sup",  label: "Temp. cama (°C)",           unit: "°C",  ref: [0, 38],      cat: "calidad_cama",    extract: (v) => { const pts = v.data?.cama_medicion_bedding?.points; if (!pts?.length) return null; const t = pts.map(p=>parseFloat(p.temp_sup)).filter(x=>!isNaN(x)); return t.length ? round(t.reduce((a,b)=>a+b,0)/t.length,1) : null; } },
  { id: "pennstate_sup",  label: "Penn State sup (%)",        unit: "%",   ref: [2, 8],       cat: "frescas",         extract: (v) => { const ps = v.data?.fr_pennstate_pennstate; return ps?.sup_avg ? parseFloat(ps.sup_avg) : null; } },
  { id: "pennstate_fondo",label: "Penn State fondo (%)",      unit: "%",   ref: [8, 20],      cat: "frescas",         extract: (v) => { const ps = v.data?.fr_pennstate_pennstate; return ps?.fondo_avg ? parseFloat(ps.fondo_avg) : null; } },
  { id: "heces",          label: "Score heces",               unit: "",    ref: [2, 3],       cat: "frescas",         extract: (v) => { const cs = v.data?.fr_heces_cowscore; if (!cs?.cows?.length) return null; const s = cs.cows.map(c=>parseFloat(c.score)).filter(x=>!isNaN(x)); return s.length ? round(s.reduce((a,b)=>a+b,0)/s.length,2) : null; } },
  { id: "rumen",          label: "Llenado ruminal",           unit: "",    ref: [3, 5],       cat: "frescas",         extract: (v) => { const cs = v.data?.fr_rumen_cowscore; if (!cs?.cows?.length) return null; const s = cs.cows.map(c=>parseFloat(c.score)).filter(x=>!isNaN(x)); return s.length ? round(s.reduce((a,b)=>a+b,0)/s.length,2) : null; } },
];

const CLIENT_COLORS = ["#1565C0","#E76F51","#2D9CDB","#27AE60","#9B51E0","#F2994A","#EB5757","#0F766E"];

// ═══════════════════════════════════════════════════
// INFORMES PANEL (componente externo — sin hooks condicionales)
// ═══════════════════════════════════════════════════
function InformesPanel({ clients, allVisitsCache, infoClient, setInfoClient, infoMetric, setInfoMetric }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tab, setTab] = useState("evolucion"); // evolucion | resumen | comparacion

  const metric = METRICS.find(m => m.id === infoMetric) || METRICS[0];

  // Filtrar visitas
  const filtVisits = allVisitsCache.filter(v => {
    if (infoClient !== "all" && v.client_id !== infoClient) return false;
    if (metric.cat && v.categoryId !== metric.cat) return false;
    if (dateFrom && v.fecha < dateFrom) return false;
    if (dateTo && v.fecha > dateTo) return false;
    return true;
  });

  // Extraer puntos de datos
  const dataPoints = filtVisits.map(v => {
    const val = metric.extract(v);
    const client = clients.find(c => c.id === v.client_id);
    return val !== null ? { fecha: v.fecha, val, clientName: client?.nombre || "—", clientId: v.client_id, visitId: v.id } : null;
  }).filter(Boolean).sort((a, b) => a.fecha?.localeCompare(b.fecha));

  // Estadísticas globales
  const vals = dataPoints.map(d => d.val);
  const n = vals.length;
  const avg = n > 0 ? round(vals.reduce((a,b)=>a+b,0)/n, 2) : null;
  const minV = n > 0 ? Math.min(...vals) : null;
  const maxV = n > 0 ? Math.max(...vals) : null;
  const sd = n > 1 ? round(Math.sqrt(vals.reduce((s,v)=>s+(v-avg)**2,0)/(n-1)),2) : null;
  const trend = n >= 2 ? (dataPoints[n-1].val > dataPoints[0].val ? "↑" : dataPoints[n-1].val < dataPoints[0].val ? "↓" : "→") : null;
  const trendColor = trend === "↑" ? C.success : trend === "↓" ? C.danger : C.textLight;

  // Agrupado por cliente
  const byClient = {};
  dataPoints.forEach(d => {
    if (!byClient[d.clientName]) byClient[d.clientName] = [];
    byClient[d.clientName].push(d);
  });

  // Resumen por cliente (para tab Resumen)
  const clientSummary = Object.entries(byClient).map(([name, pts], i) => {
    const pVals = pts.map(p => p.val);
    const pAvg = round(pVals.reduce((a,b)=>a+b,0)/pVals.length, 2);
    const pLast = pts[pts.length-1]?.val;
    const pFirst = pts[0]?.val;
    const pTrend = pts.length >= 2 ? (pLast > pFirst ? "↑" : pLast < pFirst ? "↓" : "→") : "—";
    const pTrendColor = pTrend === "↑" ? C.success : pTrend === "↓" ? C.danger : C.textLight;
    const inRef = metric.ref ? (pAvg >= metric.ref[0] && pAvg <= metric.ref[1]) : null;
    return { name, pts, pAvg, pLast, pFirst, pTrend, pTrendColor, inRef, color: CLIENT_COLORS[i % CLIENT_COLORS.length], n: pts.length };
  });

  // Chart config
  const chartH = 220;
  const pad = { t: 24, b: 44, l: 52, r: 24 };
  const svgW = 600;
  const minY = minV !== null ? Math.floor(minV * 0.92) : 0;
  const maxY = maxV !== null ? Math.ceil(maxV * 1.08) : 10;
  const rangeY = maxY - minY || 1;
  const toY = (val) => chartH - pad.b - ((val - minY) / rangeY) * (chartH - pad.t - pad.b);
  const toX = (i, total) => pad.l + (total > 1 ? i * (svgW - pad.l - pad.r) / (total - 1) : (svgW - pad.l - pad.r) / 2);

  const selStyle = (active) => ({
    padding: "7px 18px", fontSize: 13, fontWeight: 600, fontFamily: ff, borderRadius: 8, cursor: "pointer",
    border: "none", background: active ? C.primary : "transparent", color: active ? "#fff" : C.textLight,
    transition: "all 0.18s",
  });

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      {/* Encabezado */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: ffSerif, fontSize: 28, margin: 0, color: C.text }}>Informes y Análisis</h2>
        <p style={{ color: C.textLight, marginTop: 4, fontSize: 14 }}>Seguimiento de indicadores técnicos por visita, cliente y período</p>
      </div>

      {/* Filtros */}
      <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`, padding: "18px 20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Indicador</label>
            <select value={infoMetric} onChange={e => setInfoMetric(e.target.value)} style={{ ...inputStyle, fontSize: 13, fontWeight: 500 }}>
              {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}{m.unit ? ` (${m.unit})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Cliente</label>
            <select value={infoClient} onChange={e => setInfoClient(e.target.value)} style={{ ...inputStyle, fontSize: 13, fontWeight: 500 }}>
              <option value="all">Todos los clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, fontSize: 13 }} />
          </div>
          {(dateFrom || dateTo) && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ ...inputStyle, width: "auto", padding: "10px 16px", background: C.borderLight, color: C.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✕ Limpiar</button>
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      {n > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Registros", val: n, unit: "", icon: "📋", color: C.primary },
            { label: "Promedio", val: avg, unit: metric.unit, icon: "📊", color: C.primary },
            { label: "Mínimo", val: minV, unit: metric.unit, icon: "⬇️", color: C.accent },
            { label: "Máximo", val: maxV, unit: metric.unit, icon: "⬆️", color: C.success },
            { label: "Desvío std.", val: sd, unit: "", icon: "〰️", color: "#7C3AED" },
            { label: "Tendencia", val: trend, unit: "", icon: "📈", color: trendColor },
          ].map((k, i) => (
            <div key={i} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.borderLight}`, padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.val ?? "—"}{k.val !== null && k.unit ? <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}> {k.unit}</span> : null}</div>
              <div style={{ fontSize: 11, color: C.textLight, marginTop: 4, fontWeight: 500 }}>{k.label}</div>
              {k.label === "Promedio" && metric.ref && avg !== null && (
                <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: (avg >= metric.ref[0] && avg <= metric.ref[1]) ? C.success : C.danger }}>
                  Ref: {metric.ref[0]}–{metric.ref[1]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {n === 0 ? (
        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`, textAlign: "center", padding: "56px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p style={{ color: C.text, fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Sin datos para «{metric.label}»</p>
          <p style={{ color: C.textLight, fontSize: 14, margin: 0 }}>Ajustá los filtros o cargá visitas con ese módulo.</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, background: C.borderLight, borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 20 }}>
            {[["evolucion","📈 Evolución"],["resumen","📋 Resumen por cliente"],["comparacion","📊 Comparación"]].map(([id, label]) => (
              <button key={id} style={selStyle(tab === id)} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {/* TAB: Evolución temporal */}
          {tab === "evolucion" && (
            <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Evolución temporal — {metric.label}</h3>
                {metric.ref && <span style={{ fontSize: 12, color: C.textLight, background: C.borderLight, borderRadius: 20, padding: "3px 12px" }}>Rango ideal: {metric.ref[0]}–{metric.ref[1]} {metric.unit}</span>}
              </div>
              <div style={{ overflowX: "auto" }}>
                <svg width="100%" height={chartH} style={{ display: "block", minWidth: 340 }} viewBox={`0 0 ${svgW} ${chartH}`} preserveAspectRatio="xMidYMid meet">
                  {/* Zona de referencia */}
                  {metric.ref && (() => {
                    const y1 = toY(Math.min(metric.ref[1], maxY));
                    const y2 = toY(Math.max(metric.ref[0], minY));
                    return <rect x={pad.l} y={y1} width={svgW - pad.l - pad.r} height={y2 - y1} fill={C.success + "18"} />;
                  })()}
                  {/* Grid lines */}
                  {[0,0.25,0.5,0.75,1].map(pct => {
                    const y = pad.t + pct * (chartH - pad.t - pad.b);
                    const val = round(maxY - pct * rangeY, 1);
                    return (
                      <g key={pct}>
                        <line x1={pad.l} y1={y} x2={svgW - pad.r} y2={y} stroke={C.borderLight} strokeWidth="1" strokeDasharray="4,3" />
                        <text x={pad.l - 7} y={y + 4} fontSize="10" fill={C.textLight} textAnchor="end" fontFamily={ff}>{val}</text>
                      </g>
                    );
                  })}
                  {/* Líneas por cliente */}
                  {Object.entries(byClient).map(([clientName, pts], ci) => {
                    const color = CLIENT_COLORS[ci % CLIENT_COLORS.length];
                    return (
                      <g key={clientName}>
                        {pts.length > 1 && (
                          <polyline
                            points={pts.map((d,i) => `${toX(i,pts.length)},${toY(d.val)}`).join(" ")}
                            fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
                          />
                        )}
                        {pts.map((d, i) => {
                          const x = toX(i, pts.length);
                          const y = toY(d.val);
                          return (
                            <g key={i}>
                              <circle cx={x} cy={y} r="5" fill={color} stroke="#fff" strokeWidth="2.5" />
                              <text x={x} y={y - 12} fontSize="10" fill={color} textAnchor="middle" fontWeight="700" fontFamily={ff}>{d.val}</text>
                              <text x={x} y={chartH - 6} fontSize="9" fill={C.textLight} textAnchor="middle" fontFamily={ff}>{fmt(d.fecha)}</text>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              </div>
              {/* Leyenda */}
              {Object.keys(byClient).length > 1 && (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.borderLight}` }}>
                  {Object.keys(byClient).map((name, i) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500 }}>
                      <div style={{ width: 16, height: 4, borderRadius: 2, background: CLIENT_COLORS[i % CLIENT_COLORS.length] }} />
                      <span style={{ color: C.text }}>{name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Resumen por cliente */}
          {tab === "resumen" && (
            <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.primary, color: "#fff" }}>
                    {["Cliente","Visitas","Primer valor","Último valor","Promedio","Tendencia","vs. Referencia"].map(h => (
                      <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, letterSpacing: 0.3 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientSummary.map((row, i) => (
                    <tr key={row.name} style={{ borderBottom: `1px solid ${C.borderLight}`, background: i % 2 === 0 ? "#fff" : C.bg }}>
                      <td style={{ padding: "11px 14px", fontWeight: 600, color: row.color }}>{row.name}</td>
                      <td style={{ padding: "11px 14px", color: C.textLight, textAlign: "center" }}>{row.n}</td>
                      <td style={{ padding: "11px 14px", textAlign: "center" }}>{row.pFirst} <span style={{ fontSize: 11, color: C.textLight }}>{metric.unit}</span></td>
                      <td style={{ padding: "11px 14px", textAlign: "center", fontWeight: 700, color: C.primary }}>{row.pLast} <span style={{ fontSize: 11, color: C.textLight }}>{metric.unit}</span></td>
                      <td style={{ padding: "11px 14px", textAlign: "center", fontWeight: 600 }}>{row.pAvg} <span style={{ fontSize: 11, color: C.textLight }}>{metric.unit}</span></td>
                      <td style={{ padding: "11px 14px", textAlign: "center", fontSize: 16, fontWeight: 700, color: row.pTrendColor }}>{row.pTrend}</td>
                      <td style={{ padding: "11px 14px", textAlign: "center" }}>
                        {metric.ref && row.inRef !== null ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: row.inRef ? C.success + "20" : C.danger + "15", color: row.inRef ? C.success : C.danger }}>
                            {row.inRef ? "✓ OK" : "⚠ Fuera"}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Detalle de visitas */}
              <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.borderLight}` }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Detalle por visita</h4>
                <div style={{ overflowY: "auto", maxHeight: 260 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.borderLight }}>
                        {["Cliente","Fecha","Valor","vs Promedio global"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: C.textLight }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...dataPoints].reverse().map((d, i) => {
                        const delta = avg !== null ? round(d.val - avg, 2) : null;
                        const clientIdx = Object.keys(byClient).indexOf(d.clientName);
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                            <td style={{ padding: "7px 12px", fontWeight: 600, color: CLIENT_COLORS[clientIdx % CLIENT_COLORS.length] }}>{d.clientName}</td>
                            <td style={{ padding: "7px 12px", color: C.textLight }}>{fmt(d.fecha)}</td>
                            <td style={{ padding: "7px 12px", fontWeight: 700, color: C.primary }}>{d.val} <span style={{ fontSize: 10, color: C.textLight }}>{metric.unit}</span></td>
                            <td style={{ padding: "7px 12px" }}>
                              {delta !== null && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? C.success : C.danger }}>
                                  {delta > 0 ? "+" : ""}{delta}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Comparación entre clientes (barras) */}
          {tab === "comparacion" && (
            <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>Comparación — último valor por cliente</h3>
              {clientSummary.length === 0 ? (
                <p style={{ color: C.textLight }}>Seleccioná "Todos los clientes" para comparar.</p>
              ) : (
                <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", minHeight: 180 }}>
                  {clientSummary.map((row) => {
                    const barPct = maxV > 0 ? Math.min((row.pLast / maxV) * 100, 100) : 0;
                    const refOk = metric.ref ? (row.pLast >= metric.ref[0] && row.pLast <= metric.ref[1]) : null;
                    return (
                      <div key={row.name} style={{ flex: 1, minWidth: 90, textAlign: "center" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: row.color, marginBottom: 6 }}>
                          {row.pLast} <span style={{ fontSize: 11, color: C.textLight }}>{metric.unit}</span>
                        </div>
                        {refOk !== null && (
                          <div style={{ fontSize: 10, fontWeight: 700, color: refOk ? C.success : C.danger, marginBottom: 4 }}>
                            {refOk ? "✓ OK" : "⚠ Fuera"}
                          </div>
                        )}
                        <div style={{ height: 140, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                          <div style={{ width: 44, height: `${barPct}%`, minHeight: 6, background: `linear-gradient(180deg, ${row.color}cc, ${row.color})`, borderRadius: "6px 6px 0 0", transition: "height 0.4s", position: "relative" }} />
                        </div>
                        <div style={{ width: "100%", height: 2, background: C.borderLight, marginBottom: 6 }} />
                        <div style={{ fontSize: 11, color: C.text, fontWeight: 600, wordBreak: "break-word", lineHeight: 1.3 }}>{row.name}</div>
                        <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>{row.n} visitas</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {metric.ref && (
                <div style={{ marginTop: 20, padding: "10px 16px", background: C.success + "12", borderRadius: 8, fontSize: 12, color: C.success, fontWeight: 600 }}>
                  Rango de referencia: {metric.ref[0]}–{metric.ref[1]} {metric.unit}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════
export default function DairyAuditApp() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [vw, setVw] = useState("login");
  const [clients, setClients] = useState([]);
  const [selClient, setSelClient] = useState(null);
  const [selCat, setSelCat] = useState(null);
  const [selVisit, setSelVisit] = useState(null);
  const [visits, setVisits] = useState([]);
  const [formData, setFormData] = useState({});
  const [clientForm, setClientForm] = useState({ nombre: "", establecimiento: "", localidad: "", provincia: "", contacto: "", email: "" });
  const [loginForm, setLoginForm] = useState({ username: "", password: "", nombre: "" });
  const [msg, setMsg] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [expandedSections, setExpandedSections] = useState({});
  const [infoClient, setInfoClient] = useState("all");
  const [infoMetric, setInfoMetric] = useState("bcs");
  const [allVisitsCache, setAllVisitsCache] = useState([]);

  const toggleSection = (secId) => {
    setExpandedSections(prev => ({ ...prev, [secId]: !prev[secId] }));
  };

useEffect(() => {
  let alive = true;

  supabase.auth.getSession().then(({ data, error }) => {
    if (!alive) return;
    if (error) console.error("getSession error:", error);

    const sessionUser = data?.session?.user ?? null;
    setUser(sessionUser);
    setLoading(false);

    if (sessionUser) setVw("dashboard");
    else setVw("login");
  });

  const { data: { subscription } } =
    supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setLoading(false);

      if (sessionUser) setVw("dashboard"); // <- esto quizá lo ajustamos
      else setVw("login");
    });

  return () => {
    alive = false;
    subscription.unsubscribe();
  };
}, []);

useEffect(() => {
  if (!user) return;
  (async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("owner_id", user.id)
      .order("nombre", { ascending: true });

    if (error) return flash(error.message, "error");
    setClients(data || []);
  })();
}, [user]);



useEffect(() => {
  if (!user || !selClient) return;

  (async () => {
    const { data, error } = await supabase
      .from("visits")
      .select("*")
      .eq("client_id", selClient.id)
      .order("fecha", { ascending: false });

    if (error) return flash(error.message, "error");
    setVisits(data || []);
  })();
}, [user, selClient, vw]);

useEffect(() => {
  if (vw !== "informes" || !user) return;
  (async () => {
    const { data, error } = await supabase
      .from("visits").select("*")
      .order("fecha", { ascending: true });
    if (!error && data) {
      setAllVisitsCache(data.map(v => ({
        ...v, clientId: v.client_id, categoryId: v.category_id,
      })));
    }
  })();
}, [vw, user]);

const filteredClients = (clients || []).filter(c => {
  const q = (searchQ || "").toLowerCase();
  return (
    !q ||
    (c.nombre || "").toLowerCase().includes(q) ||
    (c.establecimiento || "").toLowerCase().includes(q) ||
    (c.localidad || "").toLowerCase().includes(q)
  );
});
  const flash = (t, type = "success") => { setMsg({ text: t, type }); setTimeout(() => setMsg(null), 3000); };
  const downloadReport = makeDownloadReport(selClient, flash);
const handleFieldChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };
  // Auth (Supabase)
const handleLogin = async () => {
  if (!loginForm.username || !loginForm.password) return flash("Completá email y contraseña", "error");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginForm.username,      // reutilizo tu campo username como email
    password: loginForm.password,
  });

  if (error) return flash(error.message, "error");

  // user lo setea también el onAuthStateChange, pero esto ayuda a que responda rápido
  setUser(data.user);
  setVw("dashboard");
  setLoginForm({ username: "", password: "", nombre: "" });
};

const handleRegister = async () => {
  if (!loginForm.username || !loginForm.password || !loginForm.nombre) return flash("Completá todos los campos", "error");

  const { data, error } = await supabase.auth.signUp({
    email: loginForm.username,      // tu "username" ahora es email
    password: loginForm.password,
    options: {
      data: { nombre: loginForm.nombre }, // queda en user_metadata
    },
  });

  if (error) return flash(error.message, "error");

  // OJO: si tenés email confirmation habilitado, el user puede venir null hasta confirmar email
  flash("Cuenta creada. Revisá tu email si te pide confirmación.");
  setLoginForm({ username: "", password: "", nombre: "" });

  // Si NO requiere confirmación, esto te manda al dashboard:
  if (data?.user) setVw("dashboard");
};

const handleLogout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) return flash(error.message, "error");
  setUser(null);
  setVw("login");
};

  // Clients
 const saveClient = async () => {
  try {
    if (!user) return flash("No hay sesión activa", "error");
    if (!clientForm.nombre || !clientForm.establecimiento)
      return flash("Nombre y establecimiento obligatorios", "error");

    const payload = {
      owner_id: user.id, // CLAVE para que pase RLS
      nombre: clientForm.nombre,
      establecimiento: clientForm.establecimiento,
      localidad: clientForm.localidad || null,
      provincia: clientForm.provincia || null,
      contacto: clientForm.contacto || null,
      email: clientForm.email || null,
    };

    const { data, error } = await supabase
      .from("clients")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("saveClient error:", error);
      return flash(error.message, "error");
    }

    // actualizo el estado local para que se vea instantáneo
    setClients((prev) => {
      const next = [...prev, data];
      next.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      return next;
    });

    flash("Cliente guardado");
    setClientForm({ nombre: "", establecimiento: "", localidad: "", provincia: "", contacto: "", email: "" });
    setVw("clients");
  } catch (e) {
    console.error(e);
    flash("Error inesperado guardando cliente", "error");
  }
};
  const deleteClient = async (c) => {
  if (!user) return flash("No hay sesión activa", "error");
  if (!c?.id) return flash("Cliente inválido", "error");
  if (!confirm(`¿Eliminar "${c.nombre}"?`)) return;

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", c.id);

  if (error) {
    console.error("deleteClient error:", error);
    return flash(error.message, "error");
  }

  setClients((prev) => prev.filter((x) => x.id !== c.id));
  flash("Cliente eliminado");
  setVw("clients");
};

 
// Visits (Supabase)
const saveVisit = async () => {
  if (!user) return flash("No hay sesión activa", "error");
  if (!selClient) return flash("Seleccioná un cliente", "error");
  if (!selCat) return flash("Seleccioná una categoría", "error");

  const payload = {
    owner_id: user.id,
    client_id: selClient.id,
    category_id: selCat.id,
    fecha: formData._fecha || today(),
    tecnico: user?.user_metadata?.nombre || user?.email || "Técnico",
    data: (() => {
      const d = { ...formData };
      delete d._fecha;
      return d;
    })(),
    updated_at: new Date().toISOString(),
  };

  const q = selVisit?.id
    ? supabase.from("visits").update(payload).eq("id", selVisit.id)
    : supabase.from("visits").insert(payload);

  const { error } = await q;
  if (error) return flash(error.message, "error");

  flash("Visita guardada");
  setFormData({});
  setSelVisit(null);
  setVw("clientDetail");
};

const deleteVisit = async (v) => {
  if (!user) return;
  if (!v?.id) return flash("Visita inválida", "error");
  if (!confirm("¿Eliminar esta visita?")) return;

  const { error } = await supabase
    .from("visits")
    .delete()
    .eq("id", v.id);

  if (error) return flash(error.message, "error");

  flash("Visita eliminada");

  // refrescar listado local sin esperar useEffect
  setVisits((prev) => prev.filter((x) => x.id !== v.id));

  setVw("clientDetail");
};

const Toast = msg && (
  <div
    style={{
      position: "fixed",
      top: 20,
      right: 20,
      zIndex: 1000,
      padding: "12px 20px",
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 600,
      background: msg.type === "error" ? C.danger : C.success,
      color: "#fff",
      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
    }}
  >
    {msg.text}
  </div>
);


  // ── LOGIN/REGISTER ──
  if (vw === "login" || vw === "register") return (
    <div style={{ fontFamily: ff, minHeight: "100vh", background: `linear-gradient(135deg, ${C.primaryDark} 0%, ${C.primary} 50%, ${C.primaryLight} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {Toast}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap'); * { box-sizing: border-box; }`}</style>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32, color: "#fff" }}>
          <div style={{ fontSize: 48 }}>🐄</div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, margin: "8px 0 0", fontWeight: 700, letterSpacing: 1 }}>NutriSur</h1>
          <p style={{ fontSize: 14, opacity: 0.8 }}>Sistema de Auditoría Lechera</p>
        </div>
        <Card style={{ padding: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 20 }}>{vw === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
          {vw === "register" && <div style={{ marginBottom: 14 }}><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Nombre completo</label><input type="text" placeholder="Tu nombre" value={loginForm.nombre} onChange={e => setLoginForm({ ...loginForm, nombre: e.target.value })} style={inputStyle} /></div>}
          <div style={{ marginBottom: 14 }}><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Usuario</label><input type="text" placeholder="tu_usuario" value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} style={inputStyle} onKeyDown={e => e.key === "Enter" && (vw === "login" ? handleLogin() : handleRegister())} /></div>
          <div style={{ marginBottom: 20 }}><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Contraseña</label><input type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} style={inputStyle} onKeyDown={e => e.key === "Enter" && (vw === "login" ? handleLogin() : handleRegister())} /></div>
          <Btn onClick={vw === "login" ? handleLogin : handleRegister} style={{ width: "100%", justifyContent: "center", padding: "12px 0" }} size="lg">{vw === "login" ? "Ingresar" : "Crear cuenta"}</Btn>
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: C.textLight }}>{vw === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"} <span onClick={() => setVw(vw === "login" ? "register" : "login")} style={{ color: C.primary, cursor: "pointer", fontWeight: 600 }}>{vw === "login" ? "Registrate" : "Iniciar sesión"}</span></p>
        </Card>
      </div>
    </div>
  );

  // ── LAYOUT ──
  const Header = (
    <div style={{ background: `linear-gradient(90deg, ${C.primaryDark} 0%, ${C.primary} 100%)`, color: "#fff", padding: "0 28px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 0 rgba(255,255,255,0.08), 0 4px 20px rgba(13,71,161,0.35)" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap'); * { box-sizing: border-box; }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => { setVw("dashboard"); setSelClient(null); setSelVisit(null); }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🐄</div>
        <div>
          <span style={{ fontFamily: ffSerif, fontSize: 20, fontWeight: 700, letterSpacing: 0.3 }}>NutriSur</span>
          <span style={{ fontSize: 11, opacity: 0.55, marginLeft: 10, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 500 }}>Auditoría Lechera</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.12)", borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 500 }}>
          <span style={{ opacity: 0.7 }}>👤</span>
          <span>{user?.user_metadata?.nombre || user?.email?.split("@")[0] || "Técnico"}</span>
        </div>
        <Btn variant="ghost" size="sm" icon="logout" onClick={handleLogout} style={{ color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8 }}>Salir</Btn>
      </div>
    </div>
  );
  const Nav = (
    <div style={{ display: "flex", gap: 4, padding: "10px 28px", background: "#fff", borderBottom: `1px solid ${C.borderLight}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <Btn variant={vw === "dashboard" ? "primary" : "ghost"} size="sm" icon="home" onClick={() => { setVw("dashboard"); setSelClient(null); }}>Inicio</Btn>
      <Btn variant={["clients","clientDetail","newClient","newVisit","viewVisit"].includes(vw) ? "primary" : "ghost"} size="sm" icon="users" onClick={() => setVw("clients")}>Clientes</Btn>
      <Btn variant={vw === "informes" ? "primary" : "ghost"} size="sm" icon="chart" onClick={() => setVw("informes")}>Informes</Btn>
    </div>
  );

  // ── DASHBOARD ──
  const Dashboard = (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, marginBottom: 4 }}>Bienvenido, {user?.user_metadata?.nombre || user?.email?.split("@")[0] || "Técnico"}</h2>
      <p style={{ color: C.textLight, marginBottom: 24, fontSize: 15 }}>{new Date().toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        <Card style={{ textAlign: "center", background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`, color: "#fff", border: "none" }}><div style={{ fontSize: 32, fontWeight: 700 }}>{clients.length}</div><div style={{ fontSize: 13, opacity: 0.9 }}>Clientes</div></Card>
      </div>
      <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>Acciones rápidas</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <Card onClick={() => { setClientForm({ nombre: "", establecimiento: "", localidad: "", provincia: "", contacto: "", email: "" }); setVw("newClient"); }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 44, height: 44, borderRadius: 10, background: C.primary + "15", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="plus" color={C.primary} size={22} /></div><div><div style={{ fontWeight: 600, fontSize: 15 }}>Nuevo Cliente</div><div style={{ fontSize: 13, color: C.textLight }}>Agregar establecimiento</div></div></div></Card>
        <Card onClick={() => setVw("clients")}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 44, height: 44, borderRadius: 10, background: C.accent + "15", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="clipboard" color={C.accent} size={22} /></div><div><div style={{ fontWeight: 600, fontSize: 15 }}>Nueva Visita</div><div style={{ fontSize: 13, color: C.textLight }}>Seleccionar cliente</div></div></div></Card>
      </div>
      {clients.length > 0 && <><h3 style={{ marginTop: 32, marginBottom: 12 }}>Clientes recientes</h3>{clients.slice(0, 5).map(c => (<Card key={c.id} onClick={() => { setSelClient(c); setVw("clientDetail"); }} style={{ marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontWeight: 600 }}>{c.nombre}</div><div style={{ fontSize: 13, color: C.textLight }}>{c.establecimiento} — {c.localidad || "Sin loc."}</div></div><Icon name="eye" color={C.textLight} /></div></Card>))}</>}
    </div>
  );

  // ── CLIENTS ──
  const ClientList = (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, margin: 0 }}>Clientes</h2><Btn icon="plus" onClick={() => { setClientForm({ nombre: "", establecimiento: "", localidad: "", provincia: "", contacto: "", email: "" }); setVw("newClient"); }}>Nuevo Cliente</Btn></div>
      <input type="text" placeholder="Buscar..." value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ ...inputStyle, marginBottom: 20 }} />
      {filteredClients.length === 0 ? <Card style={{ textAlign: "center", padding: 40 }}><div style={{ fontSize: 40 }}>🐄</div><p style={{ color: C.textLight }}>No hay clientes aún.</p></Card>
        : filteredClients.map(c => (<Card key={c.id} style={{ marginBottom: 10 }} onClick={() => { setSelClient(c); setVw("clientDetail"); }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontWeight: 600, fontSize: 16 }}>{c.nombre}</div><div style={{ fontSize: 13, color: C.textLight }}>{c.establecimiento} {c.localidad ? `• ${c.localidad}` : ""}</div></div><Icon name="eye" color={C.primary} /></div></Card>))}
    </div>
  );

  // ── NEW CLIENT ──
  const NewClient = (
    <div style={{ padding: "24px 32px", maxWidth: 700, margin: "0 auto", width: "100%" }}>
      <Btn variant="ghost" icon="back" size="sm" onClick={() => setVw("clients")} style={{ marginBottom: 16 }}>Volver</Btn>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, marginBottom: 20 }}>{clientForm.id ? "Editar Cliente" : "Nuevo Cliente"}</h2>
      <Card>
        {[{ key: "nombre", label: "Nombre *", ph: "Ej: Juan Pérez" }, { key: "establecimiento", label: "Establecimiento *", ph: "Ej: Estancia La Aurora" }, { key: "localidad", label: "Localidad", ph: "Ej: Trenque Lauquen" }, { key: "provincia", label: "Provincia", ph: "Buenos Aires" }, { key: "contacto", label: "Teléfono", ph: "+54 9 11 1234-5678" }, { key: "email", label: "Email", ph: "juan@campo.com" }].map(({ key, label, ph }) => (
          <div key={key} style={{ marginBottom: 16 }}><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>{label}</label><input type="text" placeholder={ph} value={clientForm[key]} onChange={e => setClientForm({ ...clientForm, [key]: e.target.value })} style={inputStyle} /></div>
        ))}
        <div style={{ display: "flex", gap: 10 }}><Btn icon="save" onClick={saveClient}>Guardar</Btn><Btn variant="outline" onClick={() => setVw("clients")}>Cancelar</Btn></div>
      </Card>
    </div>
  );

//handlers que agregue

const fetchClients = async () => {
  if (!user) return;
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) return flash(error.message, "error");
  setClients(data || []);
};

const fetchVisits = async (clientId) => {
  if (!user || !clientId) return;
  const { data, error } = await supabase
    .from("visits")
    .select("*")
    .eq("client_id", clientId)
    .order("fecha", { ascending: false });

  if (error) return flash(error.message, "error");

  // Normalización para que tu UI siga usando categoryId/clientId como venías
  const normalized = (data || []).map(v => ({
    ...v,
    clientId: v.client_id,
    categoryId: v.category_id,
    updatedAt: v.updated_at,
  }));

  setVisits(normalized);
};

  // ── CLIENT DETAIL ── (ENHANCED with VisitHistoryPanel)
  const ClientDetail = selClient && (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      <Btn variant="ghost" icon="back" size="sm" onClick={() => { setVw("clients"); setSelClient(null); }} style={{ marginBottom: 16 }}>Volver</Btn>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div><h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, margin: 0 }}>{selClient.nombre}</h2><p style={{ color: C.textLight, marginTop: 4, marginBottom: 0 }}>{selClient.establecimiento} {selClient.localidad ? `• ${selClient.localidad}` : ""}</p>{selClient.contacto && <p style={{ fontSize: 13, color: C.textLight, margin: "4px 0 0" }}>📞 {selClient.contacto}</p>}</div>
          <div style={{ display: "flex", gap: 8 }}><Btn variant="outline" icon="edit" size="sm" onClick={() => { setClientForm(selClient); setVw("newClient"); }}>Editar</Btn><Btn variant="danger" icon="trash" size="sm" onClick={() => deleteClient(selClient)}>Eliminar</Btn></div>
        </div>
      </Card>

      <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>Nueva visita</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 32 }}>
        {CATEGORIES.map(cat => (
          <Card key={cat.id} onClick={() => { setSelCat(cat); setFormData({ _fecha: today() }); setSelVisit(null); const exp = {}; cat.sections.forEach(s => { exp[s.id] = true; }); setExpandedSections(exp); setVw("newVisit"); }} style={{ borderLeft: `4px solid ${cat.color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 40, height: 40, borderRadius: 8, background: cat.color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={cat.icon} color={cat.color} /></div><div><div style={{ fontWeight: 600 }}>{cat.name}</div><div style={{ fontSize: 12, color: C.textLight }}>{cat.sections.length} secciones</div></div></div>
          </Card>
        ))}
      </div>

      {/* ═══ ENHANCED VISIT HISTORY ═══ */}
      <VisitHistoryPanel
        visits={visits}
        onView={(v, cat) => {
          setSelVisit(v); setSelCat(cat);
          setFormData({ _fecha: v.fecha, ...v.data });
          const exp = {}; cat.sections.forEach(s => { exp[s.id] = true; }); setExpandedSections(exp);
          setVw("viewVisit");
        }}
        onEdit={(v, cat) => {
          setSelVisit(v); setSelCat(cat);
          setFormData({ _fecha: v.fecha, ...v.data });
          const exp = {}; cat.sections.forEach(s => { exp[s.id] = true; }); setExpandedSections(exp);
          setVw("newVisit");
        }}
        onDelete={(v) => deleteVisit(v)}
        onDownloadTxt={(v) => downloadReport(v, "txt")}
        onDownloadCsv={(v) => downloadReport(v, "csv")}
      />
    </div>
  );


  // ── VISIT FORM ──
  const VisitForm = selCat && (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <Btn variant="ghost" icon="back" size="sm" onClick={() => setVw("clientDetail")} style={{ marginBottom: 16 }}>Volver</Btn>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Badge color={selCat.color}>{selCat.name}</Badge>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, margin: "8px 0 0" }}>{vw === "viewVisit" ? "Detalle de Visita" : (selVisit ? "Editar Visita" : "Nueva Visita")}</h2>
          <p style={{ color: C.textLight, fontSize: 14, margin: "4px 0 0" }}>{selClient.nombre} — {selClient.establecimiento}</p>
        </div>
        {vw !== "viewVisit" && <Btn icon="save" onClick={saveVisit}>Guardar Visita</Btn>}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Fecha</label><input type="date" value={formData._fecha || today()} onChange={e => handleFieldChange("_fecha", e.target.value)} disabled={vw === "viewVisit"} style={{ padding: "8px 12px", fontSize: 14, border: `1.5px solid ${C.borderLight}`, borderRadius: 8, fontFamily: ff, outline: "none" }} /></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Técnico</label><span style={{ fontSize: 14, fontWeight: 500 }}>{user?.user_metadata?.nombre || user?.email || "Técnico"}</span></div>
        </div>
      </Card>

      {selCat.sections.map(sec => {
        const isExpanded = expandedSections[sec.id] !== false;
        const ro = vw === "viewVisit";
        return (
          <Card key={sec.id} style={{ marginBottom: 12, borderLeft: `4px solid ${selCat.color}` }}>
            <div onClick={() => toggleSection(sec.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: isExpanded ? 16 : 0 }}>
              <div><h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{sec.title}</h4><p style={{ margin: "2px 0 0", fontSize: 13, color: C.textLight }}>{sec.subtitle}</p></div>
              <span style={{ fontSize: 18, color: C.textLight, transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▾</span>
            </div>
            {isExpanded && (
              <div style={{ display: "grid", gap: 14 }}>
                {/* Custom components */}
                {sec.customComponent === "ingredients" && (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 6 }}>Composición de la dieta</label>
                    <IngredientSelector
                      value={formData[`${sec.id}_ingredients`] || []}
                      onChange={val => handleFieldChange(`${sec.id}_ingredients`, val)}
                      readOnly={ro}
                    />
                  </div>
                )}
                {sec.customComponent === "pennstate" && (
                  <PennStateWidget
                    value={formData[`${sec.id}_pennstate`] || {}}
                    onChange={val => handleFieldChange(`${sec.id}_pennstate`, val)}
                    readOnly={ro}
                  />
                )}
                {sec.customComponent?.startsWith("cowscore_") && (
                  <CowScoring
                    value={formData[`${sec.id}_cowscore`] || { cows: [], obs: "" }}
                    onChange={val => handleFieldChange(`${sec.id}_cowscore`, val)}
                    readOnly={ro}
                    scoreType={sec.customComponent.replace("cowscore_", "")}
                  />
                )}
                {sec.customComponent === "ketosis" && (
                  <KetosisTracker
                    value={formData[`${sec.id}_ketosis`] || { cows: [], obs: "" }}
                    onChange={val => handleFieldChange(`${sec.id}_ketosis`, val)}
                    readOnly={ro}
                  />
                )}
                {sec.customComponent === "diseases" && (
                  <DiseaseTracker
                    value={formData[`${sec.id}_diseases`] || {}}
                    onChange={val => handleFieldChange(`${sec.id}_diseases`, val)}
                    readOnly={ro}
                  />
                )}
                {sec.customComponent === "bedding" && (
                  <BeddingEval
                    value={formData[`${sec.id}_bedding`] || { points: [], obs: "" }}
                    onChange={val => handleFieldChange(`${sec.id}_bedding`, val)}
                    readOnly={ro}
                  />
                )}
                {sec.customComponent === "cleanliness" && (
                  <CleanlinessScoring
                    value={formData[`${sec.id}_cleanliness`] || { cows: [], obs: "" }}
                    onChange={val => handleFieldChange(`${sec.id}_cleanliness`, val)}
                    readOnly={ro}
                  />
                )}
                {sec.customComponent === "grain" && (
                  <GrainProcessing
                    value={formData[`${sec.id}_grain`] || {}}
                    onChange={val => handleFieldChange(`${sec.id}_grain`, val)}
                    readOnly={ro}
                  />
                )}
                {/* Regular fields */}
                {sec.fields.map(f => (
                  <div key={f.id}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>{f.label}</label>
                    <Field field={f} value={formData[f.id]} onChange={handleFieldChange} readOnly={ro} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {vw !== "viewVisit" && <div style={{ display: "flex", gap: 10, marginTop: 20, marginBottom: 40 }}><Btn icon="save" size="lg" onClick={saveVisit}>Guardar Visita</Btn><Btn variant="outline" size="lg" onClick={() => setVw("clientDetail")}>Cancelar</Btn></div>}
      {vw === "viewVisit" && (
        <div style={{ display: "flex", gap: 10, marginTop: 20, marginBottom: 40, flexWrap: "wrap" }}>
          <Btn icon="download" onClick={() => downloadReport(selVisit, "html")} style={{ background: C.primary }}>
            Informe para Productor (HTML)
          </Btn>
          <Btn variant="outline" icon="download" onClick={() => downloadReport(selVisit, "txt")}>TXT</Btn>
          <Btn variant="outline" icon="download" onClick={() => downloadReport(selVisit, "csv")}>CSV</Btn>
          <Btn variant="outline" icon="edit" onClick={() => setVw("newVisit")}>Editar</Btn>
        </div>
      )}

      {/* Botón flotante de guardado rápido */}
      {vw !== "viewVisit" && (
        <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 200 }}>
          <button
            onClick={saveVisit}
            style={{
              width: 60, height: 60, borderRadius: "50%", border: "none", cursor: "pointer",
              background: C.primary, color: "#fff", boxShadow: "0 4px 16px rgba(21,101,192,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, fontFamily: ff,
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            title="Guardar visita"
          >
            <Icon name="save" size={24} color="#fff" />
          </button>
        </div>
      )}
    </div>
  );

  // ── INFORMES ── (componente externo, ver debajo de DairyAuditApp)
  const InformesView = (
    <InformesPanel
      clients={clients}
      allVisitsCache={allVisitsCache}
      infoClient={infoClient}
      setInfoClient={setInfoClient}
      infoMetric={infoMetric}
      setInfoMetric={setInfoMetric}
    />
  );

  const views = { dashboard: Dashboard, clients: ClientList, newClient: NewClient, clientDetail: ClientDetail, newVisit: VisitForm, viewVisit: VisitForm, informes: InformesView };

return (
  <div style={{ fontFamily: ff, minHeight: "100vh", background: C.bg, color: C.text }}>
    {Toast}
    {Header}
    {Nav}
    {views[vw]}
  </div>
)} 
