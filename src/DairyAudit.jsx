import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

// Sugerencias de nombres de forrajes para datalist del panel de inventario
const FORAGE_SUGGESTIONS = FEED_INGREDIENTS.filter(i => i.category === "Forrajes").map(i => i.name);

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

// ─── Styles ─── Nutrisur UY Brand: Azul profesional + Blanco
const C = {
  bg: "#F0F5FB",
  card: "#FFFFFF",
  primary: "#1A4FBA",
  primaryLight: "#2D6FE0",
  primaryDark: "#0E2E72",
  accent: "#00A9E0",
  accentLight: "#5BC8F0",
  text: "#0D1F38",
  textLight: "#5B6D8A",
  border: "#C5D5E8",
  borderLight: "#DCE8F5",
  success: "#0D7D47",
  warning: "#CC8A00",
  danger: "#C42B2B",
  inputBg: "#F5F9FF",
};
const ff = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
const ffSerif = "'Lora', Georgia, serif";

// ── Detección de pantalla chica (celular) ──
const useIsMobile = () => {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const h = (e) => setM(e.matches);
    mq.addEventListener ? mq.addEventListener("change", h) : mq.addListener(h);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", h) : mq.removeListener(h); };
  }, []);
  return m;
};

// ─── Base Components ───
const Btn = ({ children, onClick, variant = "primary", size = "md", icon, disabled, style: sx, ...r }) => {
  const vars = {
    primary: { bg: C.primary, c: "#fff", h: C.primaryLight, sh: `0 2px 10px rgba(26,79,186,0.28)` },
    accent: { bg: C.accent, c: "#fff", h: "#0090C5", sh: `0 2px 10px rgba(0,169,224,0.3)` },
    outline: { bg: "transparent", c: C.primary, h: C.bg, bd: `1.5px solid ${C.primary}`, sh: "none" },
    ghost: { bg: "transparent", c: C.textLight, h: C.bg, sh: "none" },
    danger: { bg: C.danger, c: "#fff", h: "#a82020", sh: `0 2px 8px rgba(196,43,43,0.25)` },
    success: { bg: C.success, c: "#fff", h: "#0a6438", sh: `0 2px 8px rgba(13,125,71,0.25)` },
  };
  const v = vars[variant];
  const sizes = { sm: { px: 12, py: 6, fs: 13 }, md: { px: 18, py: 9, fs: 14 }, lg: { px: 26, py: 13, fs: 15 } };
  const s = sizes[size];
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: `${s.py}px ${s.px}px`, fontSize: s.fs, fontWeight: 600,
        fontFamily: ff, letterSpacing: "0.01em",
        background: hov && !disabled ? v.h : v.bg,
        color: v.c, border: v.bd || "none",
        borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: hov && !disabled ? v.sh : "none",
        transform: hov && !disabled ? "translateY(-1px)" : "none",
        transition: "all 0.18s ease", whiteSpace: "nowrap", ...sx
      }} {...r}>
      {icon && <Icon name={icon} size={s.fs + 2} />}
      {children}
    </button>
  );
};

const Card = ({ children, style: sx, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: C.card, borderRadius: 14, padding: 20,
        border: `1px solid ${hov && onClick ? C.primary + "40" : C.borderLight}`,
        boxShadow: onClick && hov
          ? "0 8px 24px rgba(26,79,186,0.12)"
          : "0 1px 4px rgba(13,31,56,0.06)",
        cursor: onClick ? "pointer" : "default",
        transform: onClick && hov ? "translateY(-2px)" : "none",
        transition: "all 0.2s ease", ...sx
      }}>
      {children}
    </div>
  );
};

const Badge = ({ children, color = C.primary }) => (
  <span style={{ display: "inline-block", padding: "3px 12px", fontSize: 12, fontWeight: 700, borderRadius: 20, background: color + "18", color, letterSpacing: "0.02em", border: `1px solid ${color}25` }}>
    {children}
  </span>
);

const inputStyle = { width: "100%", padding: "10px 14px", fontSize: 14, fontFamily: ff, border: `1.5px solid ${C.borderLight}`, borderRadius: 10, background: C.inputBg, color: C.text, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s, box-shadow 0.2s" };

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
  { id: "ali_ensilaje", title: "4. Calidad de ensilajes y reservas", subtitle: "Inventario de lotes, análisis composición, micotoxinas, distribución de partículas", customComponent: "forage_stock", fields: [
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
// FORAGE STOCK CHART — SVG de barras (sin hooks)
// ═══════════════════════════════════════════════════
const ForageStockChart = ({ calcs, maxDias, semaforoColor }) => {
  const BAR_W = 38;
  const BAR_GAP = 14;
  const CHART_H = 110;
  const LABEL_H = 44;
  const PAD_L = 38;
  const PAD_T = 12;
  const n = calcs.length;
  const svgW = PAD_L + n * (BAR_W + BAR_GAP) + 16;
  const svgH = CHART_H + LABEL_H + PAD_T;
  const effectiveMax = Math.max(maxDias, 1);

  const yFor = (d) => PAD_T + CHART_H - Math.round((Math.min(d, effectiveMax) / effectiveMax) * CHART_H);
  const y15 = effectiveMax >= 15 ? yFor(15) : null;
  const y30 = effectiveMax >= 30 ? yFor(30) : null;

  return (
    <div style={{ overflowX: "auto", marginTop: 14 }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH}
        style={{ display: "block", fontFamily: "'Inter', sans-serif" }}>
        {/* Líneas de referencia */}
        {y15 !== null && (
          <g>
            <line x1={PAD_L} y1={y15} x2={svgW - 6} y2={y15} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,3" />
            <text x={PAD_L - 3} y={y15 + 4} fontSize="9" fill="#f59e0b" textAnchor="end">15d</text>
          </g>
        )}
        {y30 !== null && (
          <g>
            <line x1={PAD_L} y1={y30} x2={svgW - 6} y2={y30} stroke="#22c55e" strokeWidth="1" strokeDasharray="4,3" />
            <text x={PAD_L - 3} y={y30 + 4} fontSize="9" fill="#22c55e" textAnchor="end">30d</text>
          </g>
        )}
        {/* Barras */}
        {calcs.map((l, i) => {
          const col = semaforoColor(l.dias);
          const x = PAD_L + i * (BAR_W + BAR_GAP);
          const barH = l.dias !== null ? Math.max(4, Math.round((Math.min(l.dias, effectiveMax) / effectiveMax) * CHART_H)) : 0;
          const y = PAD_T + CHART_H - barH;
          const rawLabel = `${l.name || "?"}${l.lot ? " " + l.lot : ""}`;
          const label = rawLabel.length > 14 ? rawLabel.slice(0, 13) + "…" : rawLabel;
          return (
            <g key={l.id || i}>
              <title>{`${rawLabel}: ${l.dias !== null ? l.dias + " días" : "sin datos"}`}</title>
              {barH > 0 && (
                <rect x={x} y={y} width={BAR_W} height={barH}
                  fill={col} fillOpacity={0.82} rx={4} />
              )}
              {l.dias !== null && (
                <text x={x + BAR_W / 2} y={y - 4} fontSize="10" fill={col}
                  textAnchor="middle" fontWeight="700">{l.dias}d</text>
              )}
              <text x={x + BAR_W / 2} y={PAD_T + CHART_H + 13} fontSize="9"
                fill="#888" textAnchor="end"
                transform={`rotate(-42, ${x + BAR_W / 2}, ${PAD_T + CHART_H + 13})`}>
                {label}
              </text>
            </g>
          );
        })}
        {/* Ejes */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + CHART_H} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={PAD_L} y1={PAD_T + CHART_H} x2={svgW - 6} y2={PAD_T + CHART_H} stroke="#e2e8f0" strokeWidth="1" />
      </svg>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// FORAGE STOCK PANEL — Inventario de Forrajes / Reservas
// ═══════════════════════════════════════════════════
const ForageStockPanel = ({ value = [], onChange, readOnly, dietItems = [] }) => {
  const [globalVacas, setGlobalVacas] = useState("");

  const calcLote = (lote) => {
    const vacas = parseFloat(lote.vacas) > 0 ? parseFloat(lote.vacas) : (parseFloat(globalVacas) || 1);
    const dietMatch = dietItems.find(d => d.name === lote.name);
    const consumoKgVaca = parseFloat(lote.consumo_kg_tc) > 0
      ? parseFloat(lote.consumo_kg_tc)
      : (dietMatch ? parseFloat(dietMatch.kg_tal_cual) || 0 : 0);
    const consumoTotal = consumoKgVaca * vacas;
    const stockTC = parseFloat(lote.stock_kg_tc) || 0;
    const dias = consumoTotal > 0 ? Math.floor(stockTC / consumoTotal) : null;
    const msPct = parseFloat(lote.ms_pct) || 0;
    const kgMS = msPct > 0 ? round(stockTC * msPct / 100, 0) : null;
    return { dias, kgMS, consumoTotal, consumoKgVaca, vacas };
  };

  const semaforoColor = (dias) => {
    if (dias === null || dias === undefined) return "#94a3b8";
    if (dias > 30) return "#22c55e";
    if (dias >= 15) return "#f59e0b";
    return "#ef4444";
  };

  const addLote = () => {
    const newLote = { id: uid(), name: "", lot: "", ms_pct: "", stock_kg_tc: "", vacas: "", consumo_kg_tc: "" };
    onChange([...value, newLote]);
  };

  const updateLote = (id, field, val) => {
    onChange(value.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: val };
      // Auto-fill ms_pct al seleccionar nombre de lista
      if (field === "name" && !l.ms_pct) {
        const found = FEED_INGREDIENTS.find(f => f.name === val);
        if (found) updated.ms_pct = String(found.ms_typical);
      }
      return updated;
    }));
  };

  const removeLote = (id) => onChange(value.filter(l => l.id !== id));

  const calcs = value.map(l => ({ ...l, ...calcLote(l) }));
  const maxDias = Math.max(1, ...calcs.map(l => l.dias || 0));
  const totalStockTon = round(value.reduce((s, l) => s + (parseFloat(l.stock_kg_tc) || 0), 0) / 1000, 1);
  const minDias = calcs.reduce((min, l) => {
    if (l.dias === null) return min;
    return min === null ? l : (l.dias < min.dias ? l : min);
  }, null);

  // ── Modo lectura ────────────────────────────────
  if (readOnly) {
    if (!value.length) return null;
    return (
      <div style={{ marginTop: 20, padding: 16, background: "#f0f7ff", border: "1.5px solid #1565C020", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📦 Inventario de Forrajes / Reservas</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#1565C010" }}>
                {["Forraje", "Lote", "Stock kg TC", "kg MS", "Días restantes"].map(h => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: h === "Forraje" || h === "Lote" ? "left" : "right", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calcs.map(l => {
                const col = semaforoColor(l.dias);
                return (
                  <tr key={l.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "6px 10px" }}>{l.name || "—"}</td>
                    <td style={{ padding: "6px 10px", color: "#64748b" }}>{l.lot || "—"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{l.stock_kg_tc ? Number(l.stock_kg_tc).toLocaleString("es-UY") : "—"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{l.kgMS !== null ? l.kgMS.toLocaleString("es-UY") : "—"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: col }}>
                      {l.dias !== null ? `${l.dias} d` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {calcs.some(l => l.dias !== null) && (
          <ForageStockChart calcs={calcs} maxDias={maxDias} semaforoColor={semaforoColor} />
        )}
        <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
          {value.length} lote{value.length !== 1 ? "s" : ""} · Total stock: {totalStockTon} ton TC
          {minDias && ` · Menor reserva: ${minDias.dias}d (${minDias.name}${minDias.lot ? " " + minDias.lot : ""})`}
        </div>
      </div>
    );
  }

  // ── Modo edición ────────────────────────────────
  return (
    <div style={{ marginTop: 20, padding: 16, background: "#f0f7ff", border: "1.5px solid #1565C025", borderRadius: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>📦 Inventario de Forrajes / Reservas</span>
        <Btn variant="outline" size="sm" icon="plus" onClick={addLote}>Agregar lote</Btn>
      </div>

      {/* Vacas global */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>Vacas del grupo:</label>
        <input
          type="number" min="1" step="1" value={globalVacas}
          onChange={e => setGlobalVacas(e.target.value)}
          placeholder="Ej: 120"
          style={{ padding: "6px 10px", fontSize: 13, border: "1.5px solid #e2e8f0", borderRadius: 8, width: 110, fontFamily: "'Inter', sans-serif", outline: "none" }}
        />
        <span style={{ fontSize: 12, color: "#94a3b8" }}>aplica a lotes sin vacas propias</span>
      </div>

      {/* Datalist para autocompletar */}
      <datalist id="forage-name-list">
        {FORAGE_SUGGESTIONS.map(n => <option key={n} value={n} />)}
      </datalist>

      {/* Tabla de lotes */}
      {value.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#1565C010" }}>
                <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, minWidth: 140 }}>Forraje</th>
                <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, minWidth: 70 }}>Lote / ID</th>
                <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, minWidth: 95 }}>Stock (kg TC)</th>
                <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, width: 62 }}>%MS</th>
                <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, width: 78 }}>kg MS</th>
                <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, width: 68 }}>Vacas</th>
                <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, minWidth: 100 }}>kg/v/día</th>
                <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, width: 74 }}>Días</th>
                <th style={{ width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {value.map(lote => {
                const { dias, kgMS, consumoKgVaca } = calcLote(lote);
                const col = semaforoColor(dias);
                const dietMatch = dietItems.find(d => d.name === lote.name);
                const inS = { padding: "4px 6px", fontSize: 12, border: "1.5px solid #e2e8f0", borderRadius: 6, fontFamily: "'Inter', sans-serif", outline: "none", width: "100%", background: "#fff", boxSizing: "border-box" };
                return (
                  <tr key={lote.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "3px 4px" }}>
                      <input type="text" list="forage-name-list" value={lote.name}
                        onChange={e => updateLote(lote.id, "name", e.target.value)}
                        placeholder="Forraje..." style={inS} />
                    </td>
                    <td style={{ padding: "3px 4px" }}>
                      <input type="text" value={lote.lot}
                        onChange={e => updateLote(lote.id, "lot", e.target.value)}
                        placeholder="Lote 5" style={inS} />
                    </td>
                    <td style={{ padding: "3px 4px" }}>
                      <input type="number" min="0" step="100" value={lote.stock_kg_tc}
                        onChange={e => updateLote(lote.id, "stock_kg_tc", e.target.value)}
                        placeholder="10000" style={{ ...inS, textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "3px 4px" }}>
                      <input type="number" min="0" max="100" step="1" value={lote.ms_pct}
                        onChange={e => updateLote(lote.id, "ms_pct", e.target.value)}
                        placeholder={dietMatch ? String(dietMatch.ms_pct || "33") : "33"}
                        style={{ ...inS, textAlign: "right" }} />
                    </td>
                    {/* kg MS calculado */}
                    <td style={{ padding: "3px 8px", textAlign: "right", fontSize: 12, color: "#64748b", background: "#f0fdf4", borderRadius: 4 }}>
                      {kgMS !== null ? kgMS.toLocaleString("es-UY") : "—"}
                    </td>
                    <td style={{ padding: "3px 4px" }}>
                      <input type="number" min="1" step="1" value={lote.vacas}
                        onChange={e => updateLote(lote.id, "vacas", e.target.value)}
                        placeholder={globalVacas || "—"}
                        style={{ ...inS, textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "3px 4px" }}>
                      <input type="number" min="0" step="0.5" value={lote.consumo_kg_tc}
                        onChange={e => updateLote(lote.id, "consumo_kg_tc", e.target.value)}
                        placeholder={dietMatch ? String(parseFloat(dietMatch.kg_tal_cual) || "—") : "—"}
                        style={{ ...inS, textAlign: "right" }} />
                    </td>
                    {/* Badge de días */}
                    <td style={{ padding: "3px 6px", textAlign: "center" }}>
                      {dias !== null ? (
                        <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 10, background: col + "20", color: col, fontWeight: 700, fontSize: 12 }}>
                          {dias}d
                        </span>
                      ) : <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "3px 4px" }}>
                      <button onClick={() => removeLote(lote.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex" }}>
                        <Icon name="x" size={14} color="#ef4444" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Gráfico SVG */}
      {calcs.length > 0 && calcs.some(l => l.dias !== null) && (
        <ForageStockChart calcs={calcs} maxDias={maxDias} semaforoColor={semaforoColor} />
      )}

      {/* Resumen */}
      {value.length > 0 ? (
        <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
          {value.length} lote{value.length !== 1 ? "s" : ""} registrado{value.length !== 1 ? "s" : ""} · Total stock: {totalStockTon} ton TC
          {minDias && ` · ⚠ Menor reserva: ${minDias.dias}d (${minDias.name}${minDias.lot ? " " + minDias.lot : ""})`}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: 13 }}>
          Sin lotes cargados — presioná "+ Agregar lote" para comenzar
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════
// INGREDIENT SELECTOR COMPONENT
// ═══════════════════════════════════════════════════
const IngredientSelector = ({ value = [], onChange, readOnly, extraData = {}, onExtraChange }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [filterCat, setFilterCat] = useState("Todos");
  const [filterText, setFilterText] = useState("");

  // value is the array of ingredients; extraData holds loadOrder, mixTime, bladesCond
  const items = Array.isArray(value) ? value : [];

  const addIngredient = (ing) => {
    if (items.find(v => v.id === ing.id)) return;
    onChange([...items, { id: ing.id, name: ing.name, kg_tal_cual: "", kg_ms: "", ms_pct: ing.ms_typical, category: ing.category }]);
  };

  const removeIngredient = (id) => onChange(items.filter(v => v.id !== id));

  const updateIngredient = (id, field, val) => {
    onChange(items.map(v => {
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

  const totalTalCual = items.reduce((s, v) => s + (parseFloat(v.kg_tal_cual) || 0), 0);
  const totalMS = items.reduce((s, v) => s + (parseFloat(v.kg_ms) || 0), 0);
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
    if (!items.length) return <div style={{ color: C.textLight, fontStyle: "italic", padding: 8 }}>— Sin ingredientes cargados —</div>;
    return (
      <div style={{ display: "grid", gap: 12 }}>
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
              {items.map(v => (
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
        {/* Mixing info readonly */}
        {(extraData.loadOrder || extraData.mixTime || extraData.bladesCond) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, background: C.bg, borderRadius: 8, padding: 12 }}>
            {extraData.loadOrder && <div><span style={{ fontSize: 12, color: C.textLight, fontWeight: 600 }}>Orden de carga</span><p style={{ margin: "2px 0 0", fontSize: 13 }}>{extraData.loadOrder}</p></div>}
            {extraData.mixTime && <div><span style={{ fontSize: 12, color: C.textLight, fontWeight: 600 }}>Tiempo de mezclado</span><p style={{ margin: "2px 0 0", fontSize: 13 }}>{extraData.mixTime} min</p></div>}
            {extraData.bladesCond && <div><span style={{ fontSize: 12, color: C.textLight, fontWeight: 600 }}>Estado de cuchillas</span><p style={{ margin: "2px 0 0", fontSize: 13 }}>{extraData.bladesCond}</p></div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Current ingredients table */}
      {items.length > 0 && (
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
              {items.map(v => (
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
                  const added = items.find(v => v.id === i.id);
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

      {/* Mixing / Load order fields */}
      {onExtraChange && (
        <div style={{ marginTop: 16, padding: 14, background: C.bg, borderRadius: 10, border: `1px solid ${C.borderLight}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Proceso de mezclado</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Orden de carga de ingredientes</label>
              <textarea
                value={extraData.loadOrder || ""}
                onChange={e => onExtraChange({ ...extraData, loadOrder: e.target.value })}
                placeholder="Ej: 1° heno, 2° silo maíz, 3° concentrado, 4° mineral..."
                rows={2}
                style={{ ...inputStyle, resize: "vertical", width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Tiempo de mezclado (min)</label>
              <input
                type="number" min="0" step="1"
                value={extraData.mixTime || ""}
                onChange={e => onExtraChange({ ...extraData, mixTime: e.target.value })}
                placeholder="Ej: 8"
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Estado de cuchillas</label>
              <select
                value={extraData.bladesCond || ""}
                onChange={e => onExtraChange({ ...extraData, bladesCond: e.target.value })}
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              >
                <option value="">— Seleccionar —</option>
                <option>Bueno (afiladas, sin desgaste)</option>
                <option>Regular (leve desgaste)</option>
                <option>Malo (desgaste marcado, requiere cambio)</option>
                <option>No aplica / sin mixer</option>
              </select>
            </div>
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

  const addCow = (count = 1) => {
    const nuevos = Array.from({ length: count }, (_, i) => ({ id: uid() + "_" + i, num: cows.length + i + 1, caravana: "", score: "", nota: "" }));
    onChange({ ...value, cows: [...cows, ...nuevos] });
  };

  // Carga rápida: un toque agrega una vaca con ese score (caravana opcional después)
  const quickAdd = (score) => {
    onChange({ ...value, cows: [...cows, { id: uid(), num: cows.length + 1, caravana: "", score: String(score), nota: "" }] });
  };

  const undoLast = () => {
    if (!cows.length) return;
    onChange({ ...value, cows: cows.slice(0, -1) });
  };

  // Valores del rango práctico para los botones de carga rápida
  const quickValues = (() => {
    const lo = scoreType === "bcs" ? 2.0 : cfg.min;
    const hi = scoreType === "bcs" ? 4.5 : cfg.max;
    const vals = [];
    for (let v = lo; v <= hi + 1e-9; v += cfg.step) vals.push(round(v, 2));
    return vals;
  })();

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
        <>
          {/* ── Carga rápida: un toque = una vaca con ese score ── */}
          <div style={{ background: C.bg, border: `1.5px dashed ${C.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.5 }}>⚡ Carga rápida — tocá el score y se agrega la vaca</span>
              {cows.length > 0 && (
                <button onClick={undoLast} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: ff, padding: 0 }}>
                  ↩ Deshacer última
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {quickValues.map(v => {
                const inTarget = v >= cfg.target[0] && v <= cfg.target[1];
                const count = scores.filter(s => s === v).length;
                return (
                  <button key={v} onClick={() => quickAdd(v)}
                    style={{
                      position: "relative", minWidth: 52, padding: "10px 6px", borderRadius: 10,
                      border: `2px solid ${inTarget ? C.success : C.border}`,
                      background: inTarget ? C.success + "10" : C.card,
                      color: inTarget ? C.success : C.text,
                      fontSize: 15, fontWeight: 800, fontFamily: ff, cursor: "pointer",
                    }}>
                    {v}
                    {count > 0 && (
                      <span style={{ position: "absolute", top: -7, right: -7, background: C.primary, color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: C.textLight, margin: "8px 0 0", fontStyle: "italic" }}>
              La caravana es opcional: completala en la tabla solo para las vacas que quieras identificar (ej. las problema).
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="outline" size="sm" icon="plus" onClick={() => addCow(1)}>Agregar vaca vacía</Btn>
            <Btn variant="ghost" size="sm" onClick={() => addCow(5)}>+5 vacas</Btn>
          </div>
        </>
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
// pH SCORING COMPONENT — medición por vaca con semáforo
// ═══════════════════════════════════════════════════
const PHScoring = ({ value = { samples: [], obs: "" }, onChange, readOnly }) => {
  const TARGET = [6.0, 6.8]; // pH de orina objetivo dieta aniónica
  const samples = value.samples || [];

  const addSample = () => {
    onChange({ ...value, samples: [...samples, { id: uid(), num: samples.length + 1, caravana: "", ph: "", nota: "" }] });
  };
  const updateSample = (id, field, val) => {
    onChange({ ...value, samples: samples.map(s => s.id === id ? { ...s, [field]: val } : s) });
  };
  const removeSample = (id) => {
    const updated = samples.filter(s => s.id !== id).map((s, i) => ({ ...s, num: i + 1 }));
    onChange({ ...value, samples: updated });
  };

  const phVals = samples.map(s => parseFloat(s.ph)).filter(v => !isNaN(v));
  const n = phVals.length;
  const avg = n > 0 ? round(phVals.reduce((a, b) => a + b, 0) / n, 2) : null;
  const minPH = n > 0 ? Math.min(...phVals) : null;
  const maxPH = n > 0 ? Math.max(...phVals) : null;
  const sd = n > 1 ? round(Math.sqrt(phVals.reduce((s, v) => s + (v - avg) ** 2, 0) / (n - 1)), 2) : null;
  const pctEnObjetivo = n > 0 ? round(phVals.filter(v => v >= 6.0 && v <= 6.8).length / n * 100, 1) : null;
  const pctSobreAcid = n > 0 ? round(phVals.filter(v => v < 5.5).length / n * 100, 1) : null;
  const pctOk = n > 0 ? round(phVals.filter(v => v >= TARGET[0] && v <= TARGET[1]).length / n * 100, 1) : null;

  // pH de orina: 6.0–6.8 ideal, 5.5–5.99 o 6.8–7.5 borderline, <5.5 o >7.5 problema
  const phColor = (ph) => {
    const v = parseFloat(ph);
    if (isNaN(v)) return C.textLight;
    if (v >= 6.0 && v <= 6.8) return C.success;
    if ((v >= 5.5 && v < 6.0) || (v > 6.8 && v <= 7.5)) return C.warning;
    return C.danger;
  };
  const phEmoji = (ph) => {
    const v = parseFloat(ph);
    if (isNaN(v)) return "";
    if (v >= 6.0 && v <= 6.8) return "🟢";
    if ((v >= 5.5 && v < 6.0) || (v > 6.8 && v <= 7.5)) return "🟡";
    return "🔴";
  };

  const globalSemaforo = avg === null ? null : (avg >= 6.0 && avg <= 6.8) ? "🟢" : ((avg >= 5.5 && avg < 6.0) || (avg > 6.8 && avg <= 7.5)) ? "🟡" : "🔴";
  const globalColor = avg === null ? C.textLight : (avg >= 6.0 && avg <= 6.8) ? C.success : ((avg >= 5.5 && avg < 6.0) || (avg > 6.8 && avg <= 7.5)) ? C.warning : C.danger;

  const StatBox = ({ label, val, color, unit = "" }) => (
    <div style={{ textAlign: "center", padding: "8px 12px", background: (color || C.primary) + "10", borderRadius: 8, minWidth: 70 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || C.primary }}>{val !== null && val !== undefined ? val : "—"}{unit}</div>
      <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: 12, color: C.textLight, margin: "0 0 10px", fontStyle: "italic" }}>pH de orina por vaca — evalúa efectividad de la dieta aniónica. 🟢 6.0–6.8 (ideal) | 🟡 5.5–5.99 (sobre-acidificación) o 6.8–7.5 (dieta insuficiente) | 🔴 &lt;5.5 o &gt;7.5 (problema)</p>

      {n > 0 && (
        <>
          {/* Semáforo global */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "10px 16px", background: globalColor + "12", borderRadius: 10, border: `1.5px solid ${globalColor}40` }}>
            <span style={{ fontSize: 28 }}>{globalSemaforo}</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: globalColor }}>pH orina promedio: {avg}</div>
              <div style={{ fontSize: 12, color: C.textLight }}>Objetivo: {TARGET[0]}–{TARGET[1]} | {n} vacas evaluadas</div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <StatBox label="Mínimo" val={minPH} color={phColor(minPH)} />
            <StatBox label="Máximo" val={maxPH} color={phColor(maxPH)} />
            <StatBox label="Desvío" val={sd} color="#7C3AED" />
            <StatBox label="🔴 Sobre-acid (<5.5 o >7.5)" val={pctSobreAcid} color={pctSobreAcid > 10 ? C.danger : C.success} unit="%" />
            <StatBox label="🟢 En objetivo" val={pctEnObjetivo} color={pctEnObjetivo >= 70 ? C.success : pctEnObjetivo >= 50 ? C.warning : C.danger} unit="%" />
          </div>

          {/* Distribución visual */}
          {n >= 3 && (() => {
            const buckets = [
              { label: "<5.5", min: 0, max: 5.5, color: C.danger },
              { label: "5.5–6.0", min: 5.5, max: 6.0, color: C.warning },
              { label: "6.0–6.4", min: 6.0, max: 6.4, color: C.success },
              { label: "6.4–6.8", min: 6.4, max: 6.8, color: "#22C55E" },
              { label: "6.8–7.5", min: 6.8, max: 7.5, color: C.warning },
              { label: ">7.5", min: 7.5, max: 99, color: C.danger },
            ];
            const counts = buckets.map(b => ({ ...b, count: phVals.filter(v => v >= b.min && v < b.max).length }));
            const maxCount = Math.max(...counts.map(b => b.count), 1);
            return (
              <div style={{ marginBottom: 14, padding: 10, background: C.bg, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: C.textLight }}>Distribución por rango de pH</div>
                <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 50 }}>
                  {counts.map(b => (
                    <div key={b.label} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ height: Math.max((b.count / maxCount) * 44, b.count > 0 ? 4 : 0), background: b.color, borderRadius: "4px 4px 0 0", transition: "height 0.3s", margin: "0 1px" }} />
                      <div style={{ fontSize: 9, color: C.textLight, marginTop: 2 }}>{b.label}</div>
                      <div style={{ fontSize: 9, color: C.textLight }}>{b.count > 0 ? `${b.count}x` : ""}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Tabla de muestras */}
      {samples.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.primary + "10" }}>
                <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, width: 36 }}>#</th>
                <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>Caravana / ID</th>
                <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, width: 100 }}>pH</th>
                <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, width: 40 }}></th>
                <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>Nota</th>
                {!readOnly && <th style={{ width: 32 }}></th>}
              </tr>
            </thead>
            <tbody>
              {samples.map(s => {
                const v = parseFloat(s.ph);
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.borderLight}`, background: !isNaN(v) && v < 5.8 ? C.danger + "08" : !isNaN(v) && v < 6.0 ? C.warning + "08" : "transparent" }}>
                    <td style={{ padding: "4px 8px", textAlign: "center", color: C.textLight, fontSize: 12 }}>{s.num}</td>
                    <td style={{ padding: "4px 4px" }}>
                      {readOnly ? <span>{s.caravana || "—"}</span>
                        : <input type="text" value={s.caravana} onChange={e => updateSample(s.id, "caravana", e.target.value)} placeholder="N° caravana" style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />}
                    </td>
                    <td style={{ padding: "4px 4px", textAlign: "center" }}>
                      {readOnly ? <span style={{ fontWeight: 700, color: phColor(s.ph) }}>{s.ph || "—"}</span>
                        : <input type="number" min="5.0" max="8.5" step="0.1" value={s.ph} onChange={e => updateSample(s.id, "ph", e.target.value)} placeholder="pH" style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, textAlign: "center", width: 80, fontWeight: 700, color: phColor(s.ph) }} />}
                    </td>
                    <td style={{ padding: "4px 4px", textAlign: "center", fontSize: 16 }}>{phEmoji(s.ph)}</td>
                    <td style={{ padding: "4px 4px" }}>
                      {readOnly ? <span style={{ fontSize: 12 }}>{s.nota || "—"}</span>
                        : <input type="text" value={s.nota || ""} onChange={e => updateSample(s.id, "nota", e.target.value)} placeholder="Obs..." style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} />}
                    </td>
                    {!readOnly && (
                      <td style={{ padding: "4px 4px" }}>
                        <button onClick={() => removeSample(s.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Icon name="x" size={14} color={C.danger} /></button>
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
          <Btn variant="outline" size="sm" icon="plus" onClick={addSample}>Agregar muestra</Btn>
          <Btn variant="ghost" size="sm" onClick={() => { for (let i = 0; i < 5; i++) addSample(); }}>+5 muestras</Btn>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 4 }}>Observaciones pH</label>
        {readOnly
          ? <div style={{ padding: "8px 12px", background: C.inputBg, borderRadius: 8, fontSize: 14, border: `1px solid ${C.borderLight}`, whiteSpace: "pre-wrap" }}>{value.obs || "—"}</div>
          : <textarea value={value.obs || ""} onChange={e => onChange({ ...value, obs: e.target.value })} placeholder="Distribución, posibles causas de acidez, relación con dieta..." style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} />
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
  if (readOnly || field.computed) {
    return (
      <div style={{ padding: "8px 12px", background: field.computed ? `${C.primary}08` : C.inputBg, borderRadius: 8, fontSize: 14, minHeight: 38, border: `1px solid ${field.computed ? C.primary + "30" : C.borderLight}`, whiteSpace: "pre-wrap", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>
          {value != null && value !== "" ? <strong style={{ color: field.computed ? C.primary : C.text }}>{value}</strong> : <span style={{ color: C.textLight, fontStyle: "italic" }}>— Sin dato —</span>}
          {value != null && value !== "" && field.unit ? ` ${field.unit}` : ""}
        </span>
        {field.computed && <span style={{ fontSize: 11, color: C.primary, fontWeight: 600, marginLeft: 8, flexShrink: 0 }}>⚡ calculado</span>}
      </div>
    );
  }
  // Táctil: inputs altos y fuente 16px (evita el auto-zoom de iOS/Android al enfocar)
  const common = { ...inputStyle, padding: "13px 14px", fontSize: 16, minHeight: 48 };

  if (field.type === "textarea") return <textarea style={{ ...common, minHeight: (field.rows || 3) * 30, resize: "vertical" }} placeholder={field.placeholder} value={value || ""} onChange={e => onChange(field.id, e.target.value)} />;

  if (field.type === "select") {
    const opts = field.options || [];
    // Pocas opciones → chips de un toque (tablet); listas largas → select clásico
    if (opts.length <= 5) {
      return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {opts.map(o => {
            const active = value === o;
            return (
              <button key={o} type="button" onClick={() => onChange(field.id, active ? "" : o)}
                style={{
                  padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: ff, minHeight: 48,
                  border: `2px solid ${active ? C.primary : C.border}`,
                  background: active ? C.primary : C.card, color: active ? "#fff" : C.text,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    return (<select style={{ ...common, cursor: "pointer" }} value={value || ""} onChange={e => onChange(field.id, e.target.value)}><option value="">— Seleccionar —</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select>);
  }

  if (field.type === "number") {
    // Stepper − / + : carga sin abrir el teclado en pantalla
    const step = parseFloat(field.step) || 1;
    const bump = (dir) => {
      const curr = parseFloat(value);
      const next = round((isNaN(curr) ? 0 : curr) + dir * step, 3);
      onChange(field.id, next < 0 ? "0" : String(next));
    };
    const btnS = { width: 48, minHeight: 48, borderRadius: 10, border: `2px solid ${C.border}`, background: C.card, fontSize: 22, fontWeight: 800, color: C.primary, cursor: "pointer", flexShrink: 0, fontFamily: ff };
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <button type="button" style={btnS} onClick={() => bump(-1)}>−</button>
        <div style={{ position: "relative", flex: 1 }}>
          <input type="number" step={field.step} inputMode="decimal" style={{ ...common, paddingRight: field.unit ? 46 : 14, textAlign: "center", fontWeight: 700 }} placeholder={field.placeholder} value={value || ""} onChange={e => onChange(field.id, e.target.value)} />
          {field.unit && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.textLight, fontWeight: 500 }}>{field.unit}</span>}
        </div>
        <button type="button" style={btnS} onClick={() => bump(1)}>+</button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input type={field.type || "text"} style={{ ...common, paddingRight: field.unit ? 46 : 14 }} placeholder={field.placeholder} value={value || ""} onChange={e => onChange(field.id, e.target.value)} />
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
      { id: "cms_refusas_pct", label: "% Refusas (objetivo: 5–10%)", type: "number", placeholder: "Ej: 8", unit: "%" },
      { id: "cms_rechazo_kg", label: "Rechazo estimado (kg MS/vaca/día)", computed: true, unit: "kg" },
      { id: "cms_observaciones", label: "Observaciones CMS", type: "textarea", placeholder: "Estado del alimento, frescura, etc." },
    ],
  },
  {
    id: "ph", title: "c) pH de orina — evaluación de dieta aniónica", subtitle: "Medición vaca por vaca con semáforo automático (objetivo: 6.0–6.8)",
    customComponent: "ph_scoring",
    fields: [],
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
      { id: "inst_pushup_freq", label: "🍽️ Frecuencia de push-up (empuje comida)", type: "select", options: ["Cada 1h", "Cada 1-2h", "Cada 2-4h", ">4h", "No se empuja"] },
      { id: "inst_pushup_quien", label: "¿Quién realiza el push-up?", type: "select", options: ["Operario dedicado", "Al momento del ordeñe", "Automático / robot", "No aplica"] },
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
    { id: "fr_dmi_refusas", label: "% Refusas (objetivo: 5–10%)", type: "number", placeholder: "Ej: 5", unit: "%" },
    { id: "fr_dmi_rechazo", label: "Rechazo estimado (kg MS/vaca/día)", computed: true, unit: "kg" },
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
    { id: "fr_dieta_empuje", label: "🍽️ Push-up / Empuje de comida (frecuencia)", type: "select", options: ["Cada 1h", "Cada 1-2h", "Cada 2-4h", ">4h", "No se empuja", "No aplica"] },
    { id: "fr_dieta_pushup_quien", label: "¿Quién realiza el push-up?", type: "select", options: ["Operario dedicado", "Al momento del ordeñe", "Automático / robot", "No aplica"] },
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
  { id: "fr_limpieza", title: "7d. Limpieza de ubre, patas y flanco", subtitle: "Score 1–5 por vaca (~15–20 vacas). Objetivo: <15% con score ≥3. (Schreiner & Ruegg, 2003)", customComponent: "cleanliness", fields: [] },
  { id: "fr_locomocion", title: "7e. Puntuación de Locomoción", subtitle: "Observación del lote en movimiento — escala 1 (normal) a 5 (cojera severa)", fields: [
    { id: "fr_loc_n_obs", label: "N° de vacas observadas", type: "number", placeholder: "Ej: 50" },
    { id: "fr_loc_pct_3mas", label: "% vacas con score 3 o más (cojera leve-severa)", type: "number", placeholder: "Ej: 12", unit: "%", note: "Objetivo: <10%. Score 3: carga irregular. Score 4-5: cojera evidente." },
    { id: "fr_loc_pct_4mas", label: "% vacas con score 4-5 (cojera severa)", type: "number", placeholder: "Ej: 2", unit: "%" },
    { id: "fr_loc_podologia", label: "¿Hay plan de podología activo?", type: "select", options: ["Sí, programa regular", "Sí, solo urgencias", "No"] },
    { id: "fr_loc_obs", label: "Causas probables / observaciones", type: "textarea", placeholder: "Tipo de piso, estado de camas, lesiones frecuentes, tiempo en barro..." },
  ]},
  { id: "fr_plan", title: "8. Observaciones y Plan de Acción", subtitle: "Hallazgos, prioridades, responsables", fields: [
    { id: "fr_hallazgos", label: "Principales hallazgos", type: "textarea", placeholder: "Resumen de puntos críticos...", rows: 4 },
    { id: "fr_acciones", label: "Acciones priorizadas", type: "textarea", placeholder: "1. ...\n2. ...\n3. ...", rows: 4 },
    { id: "fr_responsables", label: "Responsables y plazos", type: "textarea", placeholder: "Acción → Responsable → Plazo", rows: 3 },
    { id: "fr_proxima", label: "Próxima visita", type: "date" },
    { id: "fr_notas", label: "Notas adicionales", type: "textarea" },
  ]},
];

// ═══════════════════════════════════════════════════
// VACAS EN PRODUCCIÓN — MÓDULO LIVIANO
// BCS, heces, rumiación, producción general
// ═══════════════════════════════════════════════════
const PRODUCCION_SECTIONS = [
  {
    id: "vp_bcs", title: "1. Condición Corporal (BCS)", subtitle: "Evaluación vaca por vaca — objetivo según etapa de lactancia",
    customComponent: "cowscore_bcs", fields: [],
  },
  {
    id: "vp_heces", title: "2. Score de Heces", subtitle: "Indicador clave de digestión y SARA subclínica — evaluar variabilidad, no solo promedio",
    customComponent: "cowscore_heces", fields: [],
  },
  {
    id: "vp_limpieza", title: "3. Limpieza de ubre, patas y flanco", subtitle: "Score 1–5 por vaca — indicador de condiciones de piso, barro y bienestar",
    customComponent: "cleanliness", fields: [],
  },
  {
    id: "vp_general", title: "4. Indicadores del lote", subtitle: "Rumiación, producción y observación de comedero",
    fields: [
      { id: "vp_n_animales", label: "N° de animales evaluados", type: "number", placeholder: "Ej: 80" },
      { id: "vp_dim_promedio", label: "DIM promedio del lote", type: "number", placeholder: "Ej: 120", unit: "días" },
      { id: "vp_pct_rumiando", label: "% vacas rumiando (observación visual en reposo)", type: "number", placeholder: "Ej: 55", unit: "%", note: "Objetivo: ≥50% del lote rumiando cuando están en reposo" },
      { id: "vp_leche_prom", label: "Producción promedio del lote (lt/vaca/día)", type: "number", placeholder: "Ej: 28", unit: "lt" },
      { id: "vp_obs_comedero", label: "Observación de comedero", type: "textarea", placeholder: "Limpieza, acceso, horas sin alimento, sorting evidente..." },
    ],
  },
  {
    id: "vp_plan", title: "5. Observaciones y Plan de Acción", subtitle: "Hallazgos principales y acciones priorizadas",
    fields: [
      { id: "vp_hallazgos", label: "Principales hallazgos", type: "textarea", placeholder: "Resumen de puntos críticos observados...", rows: 4 },
      { id: "vp_acciones", label: "Acciones priorizadas", type: "textarea", placeholder: "1. ...\n2. ...\n3. ...", rows: 4 },
      { id: "vp_proxima", label: "Próxima visita", type: "date" },
    ],
  },
];

const CATEGORIES = [
  { id: "preparto", name: "Preparto", icon: "cow", color: "#2D6A4F", sections: PREPARTO_SECTIONS },
  { id: "frescas", name: "Frescas (0-60 DIM)", icon: "chart", color: "#E76F51", sections: FRESCAS_SECTIONS },
  { id: "produccion", name: "Vacas en Producción", icon: "layers", color: "#0077B6", sections: PRODUCCION_SECTIONS },
  { id: "calidad_cama", name: "Calidad de Cama", icon: "thermo", color: "#7C3AED", sections: CALIDAD_CAMA_SECTIONS },
  { id: "calidad_alimento", name: "Calidad Alimento / Grano", icon: "layers", color: "#0891B2", sections: CALIDAD_ALIMENTO_SECTIONS },
  { id: "estres_calorico", name: "Verano / Estrés Calórico", icon: "sun", color: "#DC2626", sections: ESTRES_CALORICO_SECTIONS },
];

// Secciones esenciales por módulo — preset "Visita rápida"
// (lo que se mide SIEMPRE para mantener tendencias comparables entre visitas)
const CORE_SECTIONS = {
  preparto: ["cms", "ph", "bcs", "heces", "llenado_ruminal", "observaciones_finales"],
  frescas: ["fr_cetosis", "fr_dmi", "fr_produccion", "fr_bcs", "fr_heces", "fr_rumen", "fr_plan"],
  produccion: ["vp_bcs", "vp_heces", "vp_general", "vp_plan"],
  calidad_cama: ["cama_medicion", "cama_indicador", "cama_plan"],
  calidad_alimento: ["ali_ensilaje", "ali_grano", "ali_plan"],
  estres_calorico: ["ec_ith", "ec_rutina", "ec_animales", "ec_plan"],
};

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
  onDownloadTxt, onDownloadCsv, onDownloadPdf, onSharePdf,
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
    const ids = new Set(visits.map(v => v.categoryId || v.category_id));
    return CATEGORIES.filter(c => ids.has(c.id));
  }, [visits]);

  // Filtrado
  const filtered = useMemo(() => {
    return visits.filter(v => {
      const catId = v.categoryId || v.category_id;
      if (filterCat !== "all" && catId !== filterCat) return false;
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
            const cat = CATEGORIES.find(c => c.id === v.categoryId) || CATEGORIES.find(c => c.id === v.category_id);
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
                      {onDownloadPdf && <Btn variant="ghost" size="sm" onClick={() => onDownloadPdf(v)} title="Descargar informe PDF" style={{ fontWeight: 700 }}>PDF</Btn>}
                      {onSharePdf && <Btn variant="ghost" size="sm" onClick={() => onSharePdf(v)} title="Compartir informe por WhatsApp" style={{ color: "#25D366", fontWeight: 700 }}>WA</Btn>}
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
      const mix = visit.data?.[`${sec.id}_mix`];
      if (mix?.loadOrder) txt += `  Orden de carga: ${mix.loadOrder}\n`;
      if (mix?.mixTime) txt += `  Tiempo de mezclado: ${mix.mixTime} min\n`;
      if (mix?.bladesCond) txt += `  Estado de cuchillas: ${mix.bladesCond}\n`;
      if (mix?.loadOrder || mix?.mixTime || mix?.bladesCond) txt += "\n";
      // Inventario de forrajes
      const stock = visit.data?.[`${sec.id}_stock`];
      if (stock?.length) {
        txt += "  Inventario de Forrajes / Reservas:\n";
        txt += "  Forraje                   Lote          Stock kg TC   kg MS   Días\n";
        txt += "  ────────────────────────────────────────────────────────────────\n";
        stock.forEach(l => {
          const sTC = parseFloat(l.stock_kg_tc) || 0;
          const kgMS = parseFloat(l.ms_pct) > 0 ? round(sTC * parseFloat(l.ms_pct) / 100, 0) : null;
          const consumo = parseFloat(l.consumo_kg_tc) || 0;
          const vacas = parseFloat(l.vacas) || 1;
          const dias = consumo > 0 && vacas > 0 ? Math.floor(sTC / (consumo * vacas)) : null;
          txt += `  ${(l.name || "").padEnd(26)} ${(l.lot || "").padEnd(13)} ${sTC > 0 ? sTC.toLocaleString("es-UY").padStart(10) : "         —"}   ${kgMS !== null ? String(kgMS.toLocaleString("es-UY")).padStart(6) : "     —"}  ${dias !== null ? dias + "d" : "—"}\n`;
        });
        txt += "\n";
      }
    }

    // Forage stock (sección dedicada tipo ali_ensilaje)
    if (sec.customComponent === "forage_stock") {
      const stock = visit.data?.[`${sec.id}_stock`];
      if (stock?.length) {
        txt += "  Inventario de Forrajes / Reservas:\n";
        txt += "  Forraje                   Lote          Stock kg TC   kg MS   Días\n";
        txt += "  ────────────────────────────────────────────────────────────────\n";
        stock.forEach(l => {
          const sTC = parseFloat(l.stock_kg_tc) || 0;
          const kgMS = parseFloat(l.ms_pct) > 0 ? round(sTC * parseFloat(l.ms_pct) / 100, 0) : null;
          const consumo = parseFloat(l.consumo_kg_tc) || 0;
          const vacas = parseFloat(l.vacas) || 1;
          const dias = consumo > 0 ? Math.floor(sTC / (consumo * vacas)) : null;
          txt += `  ${(l.name || "").padEnd(26)} ${(l.lot || "").padEnd(13)} ${sTC > 0 ? sTC.toLocaleString("es-UY").padStart(10) : "         —"}   ${kgMS !== null ? String(kgMS.toLocaleString("es-UY")).padStart(6) : "     —"}  ${dias !== null ? dias + "d" : "—"}\n`;
        });
        txt += "\n";
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
      // Inventario de forrajes / stock
      const stock = visit.data?.[`${sec.id}_stock`] || [];
      stock.forEach(l => {
        const sTC = parseFloat(l.stock_kg_tc) || 0;
        const kgMS = parseFloat(l.ms_pct) > 0 ? round(sTC * parseFloat(l.ms_pct) / 100, 0) : "";
        const consumo = parseFloat(l.consumo_kg_tc) || 0;
        const vacas = parseFloat(l.vacas) || 1;
        const dias = consumo > 0 ? Math.floor(sTC / (consumo * vacas)) : "";
        csv += `"${sec.title} - Stock","${l.name || ""}${l.lot ? " (" + l.lot + ")" : ""}","StockTC:${sTC} kgMS:${kgMS} Días:${dias}"\n`;
      });
    }
    if (sec.customComponent === "forage_stock") {
      (visit.data?.[`${sec.id}_stock`] || []).forEach(l => {
        const sTC = parseFloat(l.stock_kg_tc) || 0;
        const kgMS = parseFloat(l.ms_pct) > 0 ? round(sTC * parseFloat(l.ms_pct) / 100, 0) : "";
        const consumo = parseFloat(l.consumo_kg_tc) || 0;
        const vacas = parseFloat(l.vacas) || 1;
        const dias = consumo > 0 ? Math.floor(sTC / (consumo * vacas)) : "";
        csv += `"${sec.title}","${l.name || ""}${l.lot ? " (" + l.lot + ")" : ""}","StockTC:${sTC} kgMS:${kgMS} Días:${dias}"\n`;
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
      // Inventario de forrajes
      const stock = d[`${sec.id}_stock`] || [];
      if (stock.length) {
        const stockRows = stock.map(l => {
          const sTC = parseFloat(l.stock_kg_tc) || 0;
          const kgMS = parseFloat(l.ms_pct) > 0 ? round(sTC * parseFloat(l.ms_pct) / 100, 0) : null;
          const consumo = parseFloat(l.consumo_kg_tc) || 0;
          const vacas = parseFloat(l.vacas) || 1;
          const dias = consumo > 0 ? Math.floor(sTC / (consumo * vacas)) : null;
          const col = dias === null ? "#888" : dias > 30 ? "#22c55e" : dias >= 15 ? "#f59e0b" : "#ef4444";
          const bg = dias === null ? "transparent" : dias > 30 ? "#f0fdf4" : dias >= 15 ? "#fffbeb" : "#fef2f2";
          return `<tr style="background:${bg}">
            <td style="padding:5px 8px">${l.name || "—"}</td>
            <td style="padding:5px 8px;color:#888">${l.lot || "—"}</td>
            <td style="padding:5px 8px;text-align:right">${sTC ? sTC.toLocaleString("es-UY") : "—"}</td>
            <td style="padding:5px 8px;text-align:right">${kgMS !== null ? kgMS.toLocaleString("es-UY") : "—"}</td>
            <td style="padding:5px 8px;text-align:center;font-weight:700;color:${col}">${dias !== null ? dias + " d" : "—"}</td>
          </tr>`;
        }).join("");
        customContent += `<div style="margin-top:14px">
          <div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-bottom:6px">📦 Inventario de Forrajes / Reservas</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:${accentColor}10">
              <th style="padding:5px 8px;text-align:left">Forraje</th>
              <th style="padding:5px 8px;text-align:left">Lote</th>
              <th style="padding:5px 8px;text-align:right">Stock kg TC</th>
              <th style="padding:5px 8px;text-align:right">kg MS</th>
              <th style="padding:5px 8px;text-align:center">Días restantes</th>
            </tr></thead>
            <tbody>${stockRows}</tbody>
          </table>
        </div>`;
      }
    }

    if (sec.customComponent === "forage_stock") {
      const stock = d[`${sec.id}_stock`] || [];
      if (stock.length) {
        const stockRows = stock.map(l => {
          const sTC = parseFloat(l.stock_kg_tc) || 0;
          const kgMS = parseFloat(l.ms_pct) > 0 ? round(sTC * parseFloat(l.ms_pct) / 100, 0) : null;
          const consumo = parseFloat(l.consumo_kg_tc) || 0;
          const vacas = parseFloat(l.vacas) || 1;
          const dias = consumo > 0 ? Math.floor(sTC / (consumo * vacas)) : null;
          const col = dias === null ? "#888" : dias > 30 ? "#22c55e" : dias >= 15 ? "#f59e0b" : "#ef4444";
          const bg = dias === null ? "transparent" : dias > 30 ? "#f0fdf4" : dias >= 15 ? "#fffbeb" : "#fef2f2";
          return `<tr style="background:${bg}"><td style="padding:5px 8px">${l.name || "—"}</td><td style="padding:5px 8px;color:#888">${l.lot || "—"}</td><td style="padding:5px 8px;text-align:right">${sTC ? sTC.toLocaleString("es-UY") : "—"}</td><td style="padding:5px 8px;text-align:right">${kgMS !== null ? kgMS.toLocaleString("es-UY") : "—"}</td><td style="padding:5px 8px;text-align:center;font-weight:700;color:${col}">${dias !== null ? dias + " d" : "—"}</td></tr>`;
        }).join("");
        customContent = `<div style="margin-top:8px"><div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-bottom:6px">📦 Inventario de Lotes</div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:${accentColor}10"><th style="padding:5px 8px;text-align:left">Forraje</th><th style="padding:5px 8px;text-align:left">Lote</th><th style="padding:5px 8px;text-align:right">Stock kg TC</th><th style="padding:5px 8px;text-align:right">kg MS</th><th style="padding:5px 8px;text-align:center">Días restantes</th></tr></thead><tbody>${stockRows}</tbody></table></div>`;
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

const makeDownloadReport = (currentClient, flashFn, allVisits = []) => async (visit, type) => {
    const cat = CATEGORIES.find(c => c.id === (visit.categoryId || visit.category_id));
    if (!cat || !currentClient) return flashFn("Error: falta info de categoría o cliente", "error");
    const name = `NutriSur_${currentClient.nombre}_${cat.name}_${visit.fecha || "sin-fecha"}`.replace(/\s+/g, "_");

    if (type === "pdf" || type === "wa") {
      // Visita anterior del mismo módulo (para mostrar comparación en el PDF)
      const prevVisit = allVisits
        .filter(v => v.id !== visit.id
          && (v.categoryId || v.category_id) === cat.id
          && (v.fecha || "") < (visit.fecha || ""))
        .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0] || null;
      const globalScore = cat.id === "preparto" ? (calcPrepartoScore(visit.data)?.totalScore ?? null) : null;
      try {
        const mod = await import("./lib/pdfReport.js");
        const args = { visit, client: currentClient, category: cat, prevVisit, globalScore };
        if (type === "pdf") {
          mod.downloadVisitPdf(args);
          flashFn("PDF generado");
        } else {
          const res = await mod.shareVisitPdfWhatsApp(args);
          if (res === "downloaded") flashFn("PDF descargado — adjuntalo en WhatsApp Web");
        }
      } catch (e) {
        console.error("PDF error:", e);
        // Import dinámico fallido = hay una versión nueva deployada y esta pestaña quedó vieja
        const msg = /import|fetch|module|chunk/i.test(e?.message || "")
          ? "Hay una versión nueva de la app: recargá la página (Ctrl+Shift+R) y volvé a intentar"
          : "Error generando el PDF: " + (e?.message || "desconocido");
        flashFn(msg, "error");
      }
      return;
    }

    if (type === "txt") {
      downloadFile(generateTextReport(visit, currentClient, cat), `${name}.txt`, "text/plain;charset=utf-8");
    } else if (type === "html") {
      downloadFile(generateHTMLReport(visit, currentClient, cat), `${name}.html`, "text/html;charset=utf-8");
    } else {
      downloadFile(generateCSV(visit, currentClient, cat), `${name}.csv`, "text/csv;charset=utf-8");
    }
  };
// ═══════════════════════════════════════════════════
// SCORE GLOBAL PREPARTO — cálculo 0-100
// ═══════════════════════════════════════════════════
const calcPrepartoScore = (data) => {
  if (!data) return null;
  const pillars = [];

  // ── PILAR 1: Consumo / Acceso (25 pts) ──
  const p1 = [];
  const comedero = parseFloat(data.inst_espacio_comedero_cm);
  if (!isNaN(comedero)) p1.push({ label: "Espacio comedero", pts: comedero >= 76 ? 8 : comedero >= 60 ? 5 : 2, max: 8, val: `${comedero} cm` });
  const densidad = parseFloat(data.inst_densidad_pct);
  if (!isNaN(densidad)) p1.push({ label: "Densidad lote", pts: densidad <= 85 ? 7 : densidad <= 100 ? 4 : 1, max: 7, val: `${densidad}%` });
  const pushup = data.inst_pushup_freq || "";
  const pushupPts = pushup.includes("1h") ? 10 : pushup.includes("1-2h") ? 8 : pushup.includes("2-4h") ? 5 : pushup.includes(">4h") ? 2 : pushup === "No se empuja" ? 0 : null;
  if (pushupPts !== null) p1.push({ label: "Push-up", pts: pushupPts, max: 10, val: pushup });
  const p1score = p1.length > 0 ? Math.round(p1.reduce((a, b) => a + b.pts, 0) / p1.reduce((a, b) => a + b.max, 0) * 25) : null;
  pillars.push({ label: "Consumo / Acceso", score: p1score, max: 25, detail: p1, icon: "🍽️" });

  // ── PILAR 2: Confort / Agua (25 pts) ──
  const p2 = [];
  const agua = parseFloat(data.agua_cm_lineales);
  if (!isNaN(agua)) p2.push({ label: "cm agua/vaca", pts: agua >= 10 ? 8 : agua >= 7 ? 5 : 2, max: 8, val: `${agua} cm` });
  const limpiezaAgua = data.agua_limpieza || "";
  const limpPts = limpiezaAgua === "Limpia" ? 7 : limpiezaAgua === "Aceptable" ? 5 : limpiezaAgua === "Sucia" ? 2 : null;
  if (limpPts !== null) p2.push({ label: "Limpieza agua", pts: limpPts, max: 7, val: limpiezaAgua });
  const ventil = data.inst_ventilacion || "";
  const ventPts = ventil === "Adecuada" ? 10 : ventil === "Parcialmente adecuada" ? 5 : ventil === "Inadecuada" ? 1 : null;
  if (ventPts !== null) p2.push({ label: "Ventilación", pts: ventPts, max: 10, val: ventil });
  const p2score = p2.length > 0 ? Math.round(p2.reduce((a, b) => a + b.pts, 0) / p2.reduce((a, b) => a + b.max, 0) * 25) : null;
  pillars.push({ label: "Confort / Agua", score: p2score, max: 25, detail: p2, icon: "💧" });

  // ── PILAR 3: Indicadores animales (25 pts) ──
  const p3 = [];
  const bcsCows = data.bcs_cowscore?.cows || [];
  if (bcsCows.length > 0) {
    const bcsVals = bcsCows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
    const bcsAvg = bcsVals.reduce((a, b) => a + b, 0) / bcsVals.length;
    const bcsPts = bcsAvg >= 3.0 && bcsAvg <= 3.5 ? 10 : bcsAvg >= 2.75 && bcsAvg <= 3.75 ? 7 : 3;
    p3.push({ label: "BCS promedio", pts: bcsPts, max: 10, val: round(bcsAvg, 2) });
  }
  const hecesCows = data.heces_cowscore?.cows || [];
  if (hecesCows.length > 0) {
    const hVals = hecesCows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
    const hAvg = hVals.reduce((a, b) => a + b, 0) / hVals.length;
    const hPts = hAvg >= 3.0 && hAvg <= 3.5 ? 8 : hAvg >= 2.5 && hAvg <= 4.0 ? 5 : 2;
    p3.push({ label: "Score heces", pts: hPts, max: 8, val: round(hAvg, 2) });
  }
  const rumenCows = data.llenado_ruminal_cowscore?.cows || [];
  if (rumenCows.length > 0) {
    const rVals = rumenCows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
    const rAvg = rVals.reduce((a, b) => a + b, 0) / rVals.length;
    const rPts = rAvg >= 3.5 && rAvg <= 4.5 ? 7 : rAvg >= 3.0 ? 4 : 1;
    p3.push({ label: "Llenado ruminal", pts: rPts, max: 7, val: round(rAvg, 2) });
  }
  const p3score = p3.length > 0 ? Math.round(p3.reduce((a, b) => a + b.pts, 0) / p3.reduce((a, b) => a + b.max, 0) * 25) : null;
  pillars.push({ label: "Indicadores animales", score: p3score, max: 25, detail: p3, icon: "🐄" });

  // ── PILAR 4: TMR / Partículas (25 pts) ──
  const p4 = [];
  const phSamples = data.ph_ph?.samples || [];
  if (phSamples.length > 0) {
    const phVals = phSamples.map(s => parseFloat(s.ph)).filter(v => !isNaN(v));
    const phAvg = phVals.reduce((a, b) => a + b, 0) / phVals.length;
    const phPts = phAvg >= 6.0 ? 10 : phAvg >= 5.8 ? 6 : 2;
    p4.push({ label: "pH de orina", pts: phPts, max: 10, val: round(phAvg, 2) });
  }
  const psData = data.penn_state_pennstate;
  if (psData?.sup_avg) {
    const supPct = parseFloat(psData.sup_avg);
    const fndPct = parseFloat(psData.fondo_avg);
    const supPts = supPct >= 2 && supPct <= 8 ? 8 : supPct >= 1 && supPct <= 12 ? 5 : 2;
    p4.push({ label: "Penn State sup", pts: supPts, max: 8, val: `${supPct}%` });
    if (!isNaN(fndPct)) {
      const fndPts = fndPct >= 8 && fndPct <= 20 ? 7 : fndPct >= 5 && fndPct <= 25 ? 4 : 1;
      p4.push({ label: "Penn State fondo", pts: fndPts, max: 7, val: `${fndPct}%` });
    }
  }
  const p4score = p4.length > 0 ? Math.round(p4.reduce((a, b) => a + b.pts, 0) / p4.reduce((a, b) => a + b.max, 0) * 25) : null;
  pillars.push({ label: "TMR / Partículas", score: p4score, max: 25, detail: p4, icon: "🌾" });

  const totalPillarsWithData = pillars.filter(p => p.score !== null);
  const totalScore = totalPillarsWithData.length > 0
    ? Math.round(totalPillarsWithData.reduce((a, p) => a + p.score, 0) / totalPillarsWithData.length / 25 * 100)
    : null;

  return { pillars, totalScore };
};

function PrepartoScoreCard({ data }) {
  const [expanded, setExpanded] = useState(null);
  const result = calcPrepartoScore(data);
  if (!result) return null;
  const { pillars, totalScore } = result;
  if (totalScore === null) return null;

  const scoreEmoji = totalScore >= 80 ? "🟢" : totalScore >= 60 ? "🟡" : "🔴";
  const scoreColor = totalScore >= 80 ? C.success : totalScore >= 60 ? C.warning : C.danger;
  const scoreLabel = totalScore >= 80 ? "Buen estado" : totalScore >= 60 ? "Atención requerida" : "Crítico";

  return (
    <div style={{ background: C.card, borderRadius: 14, border: `2px solid ${scoreColor}40`, overflow: "hidden", marginTop: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      {/* Header con score global */}
      <div style={{ padding: "16px 20px", background: scoreColor + "10", borderBottom: `1px solid ${scoreColor}25`, display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 36 }}>{scoreEmoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: scoreColor, textTransform: "uppercase", letterSpacing: 0.5 }}>Score Global Preparto</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{totalScore}</span>
            <span style={{ fontSize: 16, color: C.textLight }}>/100</span>
          </div>
          <div style={{ fontSize: 13, color: scoreColor, fontWeight: 600 }}>{scoreLabel}</div>
        </div>
        {/* Mini barra total */}
        <div style={{ width: 100 }}>
          <div style={{ height: 8, background: C.borderLight, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${totalScore}%`, background: scoreColor, borderRadius: 4, transition: "width 0.5s" }} />
          </div>
        </div>
      </div>

      {/* Pilares */}
      <div style={{ padding: "12px 20px" }}>
        {pillars.map((p, i) => {
          if (p.score === null) return null;
          const pEmoji = p.score >= 20 ? "🟢" : p.score >= 14 ? "🟡" : "🔴";
          const pColor = p.score >= 20 ? C.success : p.score >= 14 ? C.warning : C.danger;
          const isExp = expanded === i;
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div onClick={() => setExpanded(isExp ? null : i)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 0" }}>
                <span style={{ fontSize: 18 }}>{p.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: pColor }}>{pEmoji} {p.score}/25</span>
                  </div>
                  <div style={{ height: 6, background: C.borderLight, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(p.score / 25) * 100}%`, background: pColor, borderRadius: 3, transition: "width 0.4s" }} />
                  </div>
                </div>
                <span style={{ fontSize: 12, color: C.textLight }}>{isExp ? "▲" : "▼"}</span>
              </div>
              {isExp && p.detail.length > 0 && (
                <div style={{ marginLeft: 28, marginBottom: 8, padding: "8px 12px", background: C.bg, borderRadius: 8 }}>
                  {p.detail.map((d, j) => (
                    <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: j < p.detail.length - 1 ? `1px solid ${C.borderLight}` : "none" }}>
                      <span style={{ color: C.textLight }}>{d.label}</span>
                      <span>
                        <span style={{ color: C.text, fontWeight: 600 }}>{d.val}</span>
                        <span style={{ marginLeft: 8, color: d.pts >= d.max * 0.7 ? C.success : d.pts >= d.max * 0.4 ? C.warning : C.danger, fontWeight: 700 }}>{d.pts}/{d.max} pts</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: C.textLight, textAlign: "center", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.borderLight}` }}>
          Score basado en los datos completados. Más secciones = mayor precisión.
        </div>
      </div>
    </div>
  );
}

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
  { id: "locomocion",     label: "Cojera % (score ≥3)",       unit: "%",   ref: [0, 10],      cat: "frescas",         extract: (v) => parseFloat(v.data?.fr_locomocion_fr_loc_pct_3mas) || null },
  { id: "limpieza_ubre",  label: "Limpieza ubre % ≥3",        unit: "%",   ref: [0, 15],      cat: "frescas",         extract: (v) => { const d = v.data?.fr_limpieza_cleanliness; if (!d?.cows?.length) return null; const s = d.cows.map(c=>parseFloat(c.ubre)).filter(x=>!isNaN(x)); return s.length ? round(s.filter(x=>x>=3).length/s.length*100,1) : null; } },
  { id: "rumiacion",      label: "Rumiando % (producción)",   unit: "%",   ref: [50, 70],     cat: "produccion",      extract: (v) => parseFloat(v.data?.vp_general_vp_pct_rumiando) || null },
  { id: "bcs_prod",       label: "BCS prod. promedio",        unit: "",    ref: [2.75, 3.5],  cat: "produccion",      extract: (v) => { const cs = v.data?.vp_bcs_cowscore; if (!cs?.cows?.length) return null; const s = cs.cows.map(c=>parseFloat(c.score)).filter(x=>!isNaN(x)); return s.length ? round(s.reduce((a,b)=>a+b,0)/s.length,2) : null; } },

  // ── Indicadores calculados: no requieren carga extra, se derivan de datos ya relevados ──
  { id: "ratio_gp",       label: "Relación Grasa/Proteína",   unit: "",    ref: [1.0, 1.4],   cat: "frescas",         extract: (v) => { const g = parseFloat(v.data?.fr_prod_grasa), p = parseFloat(v.data?.fr_prod_prot); if (!isNaN(g) && !isNaN(p) && p > 0) return round(g / p, 2); const fp = parseFloat(v.data?.fr_prod_fp); return isNaN(fp) ? null : fp; } },
  { id: "efic_alim",      label: "Eficiencia alimenticia",    unit: "lt/kg", ref: [1.4, 1.8], cat: "frescas",         extract: (v) => { const l = parseFloat(v.data?.fr_prod_14dim), c = parseFloat(v.data?.fr_dmi_oferta); return !isNaN(l) && !isNaN(c) && c > 0 ? round(l / c, 2) : null; } },
  { id: "refusas_fr",     label: "Refusas % (frescas)",       unit: "%",   ref: [5, 10],      cat: "frescas",         extract: (v) => { const x = parseFloat(v.data?.fr_dmi_refusas); return isNaN(x) ? null : x; } },
  { id: "refusas_pre",    label: "Refusas % (preparto)",      unit: "%",   ref: [5, 10],      cat: "preparto",        extract: (v) => { const x = parseFloat(v.data?.cms_refusas_pct); return isNaN(x) ? null : x; } },
  { id: "sorting",        label: "Sorting (0=sin · 3=severo)", unit: "",   ref: [0, 1],       cat: "frescas",         extract: (v) => { const s = v.data?.fr_pennstate_pennstate?.sorting; const map = { "Sin sorting": 0, "Sorting leve": 1, "Sorting moderado": 2, "Sorting severo": 3 }; return Object.prototype.hasOwnProperty.call(map, s) ? map[s] : null; } },
  { id: "reserva_min",    label: "Reserva forrajera mín.",    unit: "días", ref: [30, 365],   cat: null,              extract: (v) => { const d = v.data || {}; let min = null; Object.keys(d).forEach(k => { if (!k.endsWith("_stock") || !Array.isArray(d[k])) return; d[k].forEach(l => { const sTC = parseFloat(l.stock_kg_tc) || 0; const cons = parseFloat(l.consumo_kg_tc) || 0; const vacas = parseFloat(l.vacas) || 1; if (cons > 0 && sTC > 0) { const dias = Math.floor(sTC / (cons * vacas)); if (min === null || dias < min) min = dias; } }); }); return min; } },
  { id: "metritis",       label: "Metritis %",                unit: "%",   ref: [0, 10],      cat: "frescas",         extract: (v) => { const x = parseFloat(v.data?.fr_enfermedades_diseases?.metritis_incidencia); return isNaN(x) ? null : x; } },
  { id: "rp",             label: "Retención de placenta %",   unit: "%",   ref: [0, 8],       cat: "frescas",         extract: (v) => { const x = parseFloat(v.data?.fr_enfermedades_diseases?.rp_incidencia); return isNaN(x) ? null : x; } },
  { id: "hipocalcemia",   label: "Hipocalcemia %",            unit: "%",   ref: [0, 5],       cat: "frescas",         extract: (v) => { const x = parseFloat(v.data?.fr_enfermedades_diseases?.hipocalcemia_incidencia); return isNaN(x) ? null : x; } },
];

const CLIENT_COLORS = ["#1565C0","#E76F51","#2D9CDB","#27AE60","#9B51E0","#F2994A","#EB5757","#0F766E"];

// ═══════════════════════════════════════════════════
// SPARKLINE — mini gráfico de tendencia
// ═══════════════════════════════════════════════════
const Sparkline = ({ pts, color = C.primary, refRange }) => {
  if (!pts || pts.length < 2) return <div style={{ height: 40, display: "flex", alignItems: "center", fontSize: 11, color: C.textLight }}>{pts?.length === 1 ? "1 solo dato" : "sin datos"}</div>;
  const w = 150, h = 40, p = 4;
  const vals = pts.map(x => x.val);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (refRange) { lo = Math.min(lo, refRange[0]); hi = Math.max(hi, refRange[1]); }
  const rng = hi - lo || 1;
  const X = (i) => p + i * (w - 2 * p) / (pts.length - 1);
  const Y = (v) => h - p - ((v - lo) / rng) * (h - 2 * p);
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {refRange && <rect x={p} y={Y(refRange[1])} width={w - 2 * p} height={Math.max(1, Y(refRange[0]) - Y(refRange[1]))} fill={C.success} opacity={0.13} rx={2} />}
      <polyline points={pts.map((x, i) => `${X(i)},${Y(x.val)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(pts.length - 1)} cy={Y(vals[vals.length - 1])} r="3.5" fill={color} />
    </svg>
  );
};

// ═══════════════════════════════════════════════════
// INFORMES PANEL (componente externo — sin hooks condicionales)
// ═══════════════════════════════════════════════════
function InformesPanel({ clients, allVisitsCache, infoClient, setInfoClient, infoMetric, setInfoMetric, infoTab, setInfoTab }) {
  const isMobile = useIsMobile();
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

  // Toggle de modo: por indicador vs ficha del tambo
  const ModeToggle = (
    <div style={{ display: "flex", gap: 4, background: C.borderLight, borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 20 }}>
      <button style={selStyle(infoTab !== "ficha")} onClick={() => setInfoTab("indicador")}>📈 Por indicador</button>
      <button style={selStyle(infoTab === "ficha")} onClick={() => setInfoTab("ficha")}>🐄 Ficha del tambo</button>
    </div>
  );

  // ═══ MODO FICHA DEL TAMBO ═══
  if (infoTab === "ficha") {
    const fichaId = infoClient !== "all" ? infoClient : (clients[0]?.id || null);
    const fichaClientObj = clients.find(c => c.id === fichaId);
    const cards = METRICS.map(m => {
      const series = allVisitsCache
        .filter(v => v.client_id === fichaId && (!m.cat || (v.categoryId || v.category_id) === m.cat))
        .map(v => ({ fecha: v.fecha, val: m.extract(v) }))
        .filter(p => p.val !== null && !isNaN(p.val))
        .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
      return { m, series };
    }).filter(c => c.series.length > 0);

    // Última visita registrada del cliente
    const lastFecha = allVisitsCache.filter(v => v.client_id === fichaId).map(v => v.fecha).sort().pop();

    return (
      <div style={{ padding: isMobile ? "16px 12px" : "28px 32px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: ffSerif, fontSize: isMobile ? 22 : 28, margin: 0, color: C.text }}>Informes y Análisis</h2>
          <p style={{ color: C.textLight, marginTop: 4, fontSize: 14 }}>Todos los indicadores del tambo en una sola pantalla</p>
        </div>
        {ModeToggle}

        <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ minWidth: 240 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Tambo</label>
            <select value={fichaId || ""} onChange={e => setInfoClient(e.target.value)} style={{ ...inputStyle, fontSize: 13, fontWeight: 500 }}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.establecimiento}</option>)}
            </select>
          </div>
          {lastFecha && <span style={{ fontSize: 13, color: C.textLight, paddingBottom: 10 }}>Última visita: <b>{fmt(lastFecha)}</b></span>}
        </div>

        {!fichaClientObj ? (
          <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`, textAlign: "center", padding: "56px 24px" }}>
            <p style={{ color: C.textLight }}>Todavía no hay clientes cargados.</p>
          </div>
        ) : cards.length === 0 ? (
          <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`, textAlign: "center", padding: "56px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🐄</div>
            <p style={{ color: C.text, fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Sin indicadores todavía</p>
            <p style={{ color: C.textLight, fontSize: 14, margin: 0 }}>Cargá visitas para este tambo y acá vas a ver su evolución completa.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {cards.map(({ m, series }) => {
              const last = series[series.length - 1];
              const prev = series.length > 1 ? series[series.length - 2] : null;
              const inRef = m.ref ? (last.val >= m.ref[0] && last.val <= m.ref[1]) : null;
              const statusColor = inRef === null ? C.primary : inRef ? C.success : C.danger;
              const delta = prev ? round(last.val - prev.val, 2) : null;
              return (
                <div key={m.id} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`, borderLeft: `4px solid ${statusColor}`, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.4 }}>{m.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: statusColor, marginTop: 4, lineHeight: 1 }}>
                        {last.val}<span style={{ fontSize: 13, fontWeight: 600, opacity: 0.7 }}> {m.unit}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.textLight, marginTop: 5 }}>
                        {fmt(last.fecha)}
                        {delta !== null && delta !== 0 && (
                          <span style={{ fontWeight: 700, marginLeft: 6, color: C.textLight }}>
                            {delta > 0 ? "↑" : "↓"} {delta > 0 ? "+" : ""}{delta} vs. ant.
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <Sparkline pts={series} color={statusColor} refRange={m.ref} />
                      {m.ref && <div style={{ fontSize: 10, color: C.textLight, marginTop: 3 }}>objetivo {m.ref[0]}–{m.ref[1]} {m.unit}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? "16px 12px" : "28px 32px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      {/* Encabezado */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: ffSerif, fontSize: isMobile ? 22 : 28, margin: 0, color: C.text }}>Informes y Análisis</h2>
        <p style={{ color: C.textLight, marginTop: 4, fontSize: 14 }}>Seguimiento de indicadores técnicos por visita, cliente y período</p>
      </div>
      {ModeToggle}

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
// PLAN DE ACCIÓN — recomendaciones con seguimiento
// ═══════════════════════════════════════════════════
const PRIORIDADES = {
  alta:  { label: "Alta",  color: "#C42B2B" },
  media: { label: "Media", color: "#CC8A00" },
  baja:  { label: "Baja",  color: "#0D7D47" },
};

function PlanAccionPanel({ value = [], onChange, readOnly, color }) {
  const [texto, setTexto] = useState("");
  const [prioridad, setPrioridad] = useState("media");
  const [plazo, setPlazo] = useState("");

  const add = () => {
    const t = texto.trim();
    if (!t) return;
    onChange([...(value || []), { id: Date.now().toString(36), texto: t, prioridad, plazo: plazo.trim() }]);
    setTexto(""); setPlazo(""); setPrioridad("media");
  };
  const remove = (id) => onChange((value || []).filter(it => it.id !== id));

  if (readOnly && !(value || []).length) return null;

  return (
    <Card style={{ marginBottom: 16, borderLeft: `4px solid ${color || C.primary}` }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>📋 Plan de acción</h4>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: C.textLight }}>
        Recomendaciones para el establecimiento. Van al informe y en la próxima visita se marca si se cumplieron.
      </p>

      {(value || []).length > 0 && (
        <div style={{ display: "grid", gap: 8, marginBottom: readOnly ? 0 : 14 }}>
          {value.map((it, i) => {
            const pr = PRIORIDADES[it.prioridad] || PRIORIDADES.media;
            return (
              <div key={it.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: C.inputBg, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.borderLight}` }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: pr.color, borderRadius: 6, padding: "2px 8px", flexShrink: 0, marginTop: 1 }}>{pr.label}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{it.texto}</div>
                  {it.plazo && <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>⏱ Plazo: {it.plazo}</div>}
                </div>
                {!readOnly && (
                  <button onClick={() => remove(it.id)} title="Eliminar"
                    style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 }}>×</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && (
        <div style={{ display: "grid", gap: 8 }}>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Ej: Aumentar espacio de comedero a 76 cm/vaca corriendo el alambrado del callejón"
            style={{ ...inputStyle, minHeight: 52, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={prioridad} onChange={e => setPrioridad(e.target.value)} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
              <option value="alta">🔴 Prioridad alta</option>
              <option value="media">🟡 Prioridad media</option>
              <option value="baja">🟢 Prioridad baja</option>
            </select>
            <input type="text" value={plazo} onChange={e => setPlazo(e.target.value)} placeholder="Plazo (ej: antes de la próxima visita)" style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
            <Btn icon="plus" size="sm" onClick={add} disabled={!texto.trim()}>Agregar</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

function PlanRevisionPanel({ value = [], onChange, readOnly, prevFecha }) {
  const ESTADOS = [
    { id: "cumplida",  label: "✔ Cumplida",  color: C.success },
    { id: "parcial",   label: "◐ Parcial",   color: C.warning },
    { id: "pendiente", label: "✗ Pendiente", color: C.danger },
  ];
  if (!(value || []).length) return null;
  const counts = { cumplida: 0, parcial: 0, pendiente: 0 };
  value.forEach(it => { counts[it.estado] = (counts[it.estado] || 0) + 1; });

  const setEstado = (idx, estado) => {
    if (readOnly) return;
    onChange(value.map((it, i) => (i === idx ? { ...it, estado } : it)));
  };

  return (
    <Card style={{ marginBottom: 16, borderLeft: `4px solid ${C.accent}` }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>🔄 Seguimiento del plan anterior{prevFecha ? ` (${fmt(prevFecha)})` : ""}</h4>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: C.textLight }}>
        ¿Qué se implementó de lo recomendado en la visita pasada? {counts.cumplida} cumplidas · {counts.parcial} parciales · {counts.pendiente} pendientes.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {value.map((it, i) => {
          const pr = PRIORIDADES[it.prioridad] || PRIORIDADES.media;
          return (
            <div key={i} style={{ background: C.inputBg, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.borderLight}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: pr.color, flexShrink: 0, marginTop: 2 }}>●</span>
                <div style={{ flex: 1, fontSize: 14 }}>{it.texto}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ESTADOS.map(es => {
                  const active = it.estado === es.id;
                  return (
                    <button key={es.id} onClick={() => setEstado(i, es.id)} disabled={readOnly}
                      style={{
                        fontSize: 12, fontWeight: 700, fontFamily: ff, padding: "4px 12px", borderRadius: 99,
                        cursor: readOnly ? "default" : "pointer",
                        border: `1.5px solid ${active ? es.color : C.borderLight}`,
                        background: active ? es.color : "transparent",
                        color: active ? "#fff" : C.textLight,
                      }}>
                      {es.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
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
  const [clientsLoaded, setClientsLoaded] = useState(false); // ya se hizo el primer fetch de clientes
  const [selClient, setSelClient] = useState(null);
  const [selCat, setSelCat] = useState(null);
  const [selVisit, setSelVisit] = useState(null);
  const [visits, setVisits] = useState([]);
  const [formData, setFormData] = useState({});
  const [clientForm, setClientForm] = useState({ nombre: "", establecimiento: "", localidad: "", provincia: "", contacto: "", email: "", sistema_productivo: "" });
  const [loginForm, setLoginForm] = useState({ username: "", password: "", nombre: "" });
  const [msg, setMsg] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [expandedSections, setExpandedSections] = useState({});
  const [infoClient, setInfoClient] = useState("all");
  const [infoMetric, setInfoMetric] = useState("bcs");
  const [infoTab, setInfoTab] = useState("indicador"); // "indicador" | "ficha"
  const [allVisitsCache, setAllVisitsCache] = useState([]);
  const [activeSections, setActiveSections] = useState(null); // null = todas activas
  const [clientTemplate, setClientTemplate] = useState(null); // plantilla guardada del cliente
  const [prevVisit, setPrevVisit] = useState(null); // visita anterior para comparación
  const [draftBanner, setDraftBanner] = useState(false); // banner de borrador recuperable
  const [draftSavedAt, setDraftSavedAt] = useState(null); // hora del último auto-guardado (indicador visible)
  const [wizardStep, setWizardStep] = useState(0);       // paso actual del wizard de visita
  const navRestoredRef = useRef(false);                  // evita restaurar más de una vez por sesión
  const isMobile = useIsMobile();                        // layout compacto en celular

  // Clave única de borrador por usuario/cliente/módulo
  const draftKey = user && selClient && selCat
    ? `dairy_draft_${user.id}_${selClient.id}_${selCat.id}`
    : null;

  // ── Sistema de roles ──
  const [loginMode, setLoginMode] = useState("tecnico"); // "tecnico" | "cliente"
  const [codeInput, setCodeInput] = useState("");
  const [portalClient, setPortalClient] = useState(null);   // cliente en modo portal
  const [portalVisits, setPortalVisits] = useState([]);     // visitas del cliente portal
  const [portalSelVisit, setPortalSelVisit] = useState(null); // visita seleccionada en portal
  const [portalSelCat, setPortalSelCat] = useState(null);

  const toggleSection = (secId) => {
    setExpandedSections(prev => ({ ...prev, [secId]: !prev[secId] }));
  };

useEffect(() => {
  let alive = true;
  let lastUserId; // undefined = todavía no procesamos ningún evento

  // Solo cambia la vista cuando el usuario REALMENTE cambia (login/logout).
  // Eventos como TOKEN_REFRESHED o SIGNED_IN al volver a la pestaña NO deben
  // sacar al usuario de donde estaba (bug: perdía el formulario al salir y entrar).
  const applySession = (sessionUser) => {
    if (!alive) return;
    const newId = sessionUser?.id ?? null;
    const changed = lastUserId !== newId;
    lastUserId = newId;
    setUser(sessionUser);
    setLoading(false);
    if (!changed) return;
    if (sessionUser) {
      setVw(v => (v === "login" ? "dashboard" : v));
    } else {
      navRestoredRef.current = false;
      setVw("login");
    }
  };

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) console.error("getSession error:", error);
    applySession(data?.session?.user ?? null);
  });

  const { data: { subscription } } =
    supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user ?? null);
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
    setClientsLoaded(true);
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
  if ((vw !== "informes" && vw !== "dashboard") || !user) return;
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

// ── Auto-save borrador mientras se llena la visita ──
useEffect(() => {
  // Solo guardamos borradores en visitas NUEVAS (no edición)
  if (vw !== "newVisit" || selVisit || !draftKey) return;
  // No guardar si solo tiene la fecha y la revisión de plan sin tocar (todo pendiente)
  const draftKeys = Object.keys(formData).filter(k => k !== "_fecha");
  const onlySeed = draftKeys.length === 1 && draftKeys[0] === "plan_revision"
    && (formData.plan_revision || []).every(it => it.estado === "pendiente");
  if (!draftKeys.length || onlySeed) return;
  const timer = setTimeout(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        formData,
        activeSections,
        savedAt: new Date().toISOString(),
      }));
      setDraftSavedAt(new Date().toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }));
    } catch (_) {}
  }, 800);
  return () => clearTimeout(timer);
}, [formData, activeSections, vw, draftKey, selVisit]); // eslint-disable-line

// ── Al entrar a newVisit (nueva), verificar si hay borrador ──
useEffect(() => {
  if (vw !== "newVisit" || selVisit || !draftKey) return;
  try {
    const raw = localStorage.getItem(draftKey);
    if (raw) setDraftBanner(true);
  } catch (_) {}
}, [vw, draftKey]); // eslint-disable-line

const recoverDraft = () => {
  if (!draftKey) return;
  try {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    const { formData: fd, activeSections: as } = JSON.parse(raw);
    if (fd) setFormData(fd);
    if (as) setActiveSections(as);
    setDraftBanner(false);
  } catch (_) {}
};

const discardDraft = () => {
  if (draftKey) { try { localStorage.removeItem(draftKey); } catch (_) {} }
  setDraftBanner(false);
};

// ── Auto-save del formulario de cliente (nuevo o edición) ──
useEffect(() => {
  if (vw !== "newClient" || !user) return;
  const hasContent = Object.entries(clientForm).some(([k, v]) => k !== "id" && v);
  if (!hasContent) return;
  const timer = setTimeout(() => {
    try {
      localStorage.setItem(`dairy_clientform_${user.id}`, JSON.stringify(clientForm));
    } catch (_) {}
  }, 500);
  return () => clearTimeout(timer);
}, [clientForm, vw, user]); // eslint-disable-line

// ── Guardar estado de navegación en localStorage ──
// (localStorage y no sessionStorage: en el celular el navegador suele "matar"
// la pestaña al cambiar de app, y sessionStorage se pierde con ella)
useEffect(() => {
  if (!user || !vw || vw === "login") return;
  try {
    // viewVisit/startVisit y edición de visita existente vuelven a clientDetail;
    // una visita NUEVA en curso se puede restaurar completa desde el borrador.
    const navVw =
      (vw === "viewVisit" || vw === "startVisit" || vw === "briefing" || (vw === "newVisit" && selVisit))
        ? "clientDetail"
        : vw;
    localStorage.setItem(`dairy_nav_${user.id}`, JSON.stringify({
      vw: navVw,
      clientId: selClient?.id || null,
      catId: selCat?.id || null,
      wizardStep,
    }));
  } catch (_) {}
}, [vw, selClient, selCat, selVisit, wizardStep, user]); // eslint-disable-line

// ── Restaurar navegación al cargar clientes (primera vez) ──
useEffect(() => {
  if (!user || !clientsLoaded || navRestoredRef.current) return;
  navRestoredRef.current = true;
  try {
    const raw = localStorage.getItem(`dairy_nav_${user.id}`);
    if (!raw) return;
    const { vw: savedVw, clientId, catId, wizardStep: savedStep } = JSON.parse(raw);
    if (!savedVw || savedVw === "dashboard") return;

    // Si estaba creando/editando un cliente, restaurar el formulario
    if (savedVw === "newClient") {
      try {
        const rawCf = localStorage.getItem(`dairy_clientform_${user.id}`);
        if (rawCf) {
          const cf = JSON.parse(rawCf);
          if (cf && typeof cf === "object") setClientForm(cf);
        }
      } catch (_) {}
      setVw("newClient");
      flash("Se restauraron los datos del cliente que estabas cargando");
      return;
    }
    const client = clientId ? clients.find(c => c.id === clientId) : null;
    const cat = catId ? CATEGORIES.find(c => c.id === catId) : null;
    if (client) setSelClient(client);
    if (cat) setSelCat(cat);
    if (typeof savedStep === "number") setWizardStep(savedStep);

    // Si estaba cargando una visita nueva, restaurar el borrador directamente
    if (savedVw === "newVisit") {
      if (!client || !cat) return; // sin cliente/módulo no hay nada que restaurar
      let draft = null;
      try {
        const rawDraft = localStorage.getItem(`dairy_draft_${user.id}_${client.id}_${cat.id}`);
        if (rawDraft) draft = JSON.parse(rawDraft);
      } catch (_) {}
      if (draft?.formData) {
        setSelVisit(null);
        setFormData(draft.formData);
        const acts = draft.activeSections || cat.sections.map(s => s.id);
        setActiveSections(acts);
        const exp = {};
        acts.forEach(id => { exp[id] = true; });
        setExpandedSections(exp);
        setDraftBanner(false);
        setVw("newVisit");
        flash("Se restauró la visita que estabas cargando");
      } else {
        setVw("clientDetail");
      }
      return;
    }

    setVw(savedVw);
  } catch (_) {}
}, [clients, clientsLoaded, user]); // eslint-disable-line

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
  const downloadReport = makeDownloadReport(selClient, flash, visits);
const handleFieldChange = (key, value) => {
  setFormData((prev) => {
    const next = { ...prev, [key]: value };
    // Auto-calcular rechazo (kg) = oferta × refusas% / 100
    const pairs = [
      { oferta: "cms_oferta_kg", pct: "cms_refusas_pct", rechazo: "cms_rechazo_kg" },
      { oferta: "fr_dmi_oferta", pct: "fr_dmi_refusas",  rechazo: "fr_dmi_rechazo" },
    ];
    for (const p of pairs) {
      if (key === p.oferta || key === p.pct) {
        const o = parseFloat(next[p.oferta]);
        const r = parseFloat(next[p.pct]);
        if (!isNaN(o) && !isNaN(r)) next[p.rechazo] = String(round(o * r / 100, 1));
        else if (key === p.pct && isNaN(r)) next[p.rechazo] = "";
      }
    }
    return next;
  });
};
  // Auth (Supabase)
// Traduce errores de Supabase a mensajes útiles en español
const friendlyAuthError = (error) => {
  const m = error?.message || "";
  if (/failed to fetch|network|fetch/i.test(m))
    return "No se pudo conectar al servidor. Revisá tu conexión a internet. Si tenés internet y sigue fallando, es probable que el proyecto de Supabase esté pausado (los proyectos gratuitos se pausan tras ~1 semana sin uso): entrá a supabase.com y tocá \"Restore project\".";
  if (/invalid login credentials/i.test(m)) return "Email o contraseña incorrectos";
  if (/email not confirmed/i.test(m)) return "Tenés que confirmar tu email antes de entrar. Revisá tu casilla (y spam).";
  if (/rate limit/i.test(m)) return "Demasiados intentos. Esperá un minuto y probá de nuevo.";
  return m || "Error desconocido";
};

const handleLogin = async () => {
  if (!loginForm.username || !loginForm.password) return flash("Completá email y contraseña", "error");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginForm.username.trim(),      // reutilizo tu campo username como email
    password: loginForm.password,
  });

  if (error) return flash(friendlyAuthError(error), "error");

  // user lo setea también el onAuthStateChange, pero esto ayuda a que responda rápido
  setUser(data.user);
  setVw("dashboard");
  setLoginForm({ username: "", password: "", nombre: "" });
};

const handleRegister = async () => {
  if (!loginForm.username || !loginForm.password || !loginForm.nombre) return flash("Completá todos los campos", "error");

  const { data, error } = await supabase.auth.signUp({
    email: loginForm.username.trim(),      // tu "username" ahora es email
    password: loginForm.password,
    options: {
      data: { nombre: loginForm.nombre }, // queda en user_metadata
    },
  });

  if (error) return flash(friendlyAuthError(error), "error");

  // OJO: si tenés email confirmation habilitado, el user puede venir null hasta confirmar email
  flash("Cuenta creada. Revisá tu email si te pide confirmación.");
  setLoginForm({ username: "", password: "", nombre: "" });

  // Si NO requiere confirmación, esto te manda al dashboard:
  if (data?.user) setVw("dashboard");
};

const handleLogout = async () => {
  // Limpiar navegación guardada (los borradores de visitas se conservan)
  if (user) { try { localStorage.removeItem(`dairy_nav_${user.id}`); } catch (_) {} }
  const { error } = await supabase.auth.signOut();
  if (error) return flash(friendlyAuthError(error), "error");
  setUser(null);
  setVw("login");
};

// ── Portal de cliente ──────────────────────────────────────

// Genera un código único de 6 caracteres alfanumérico (ej: NUT4K2)
const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres confusos
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

// Guarda o regenera el access_code de un cliente
const saveClientCode = async (client, newCode) => {
  const code = newCode || generateCode();
  const { error } = await supabase
    .from("clients")
    .update({ access_code: code })
    .eq("id", client.id);
  if (error) return flash("Error guardando código: " + error.message, "error");
  // Actualizar estado local
  setClients(prev => prev.map(c => c.id === client.id ? { ...c, access_code: code } : c));
  if (selClient?.id === client.id) setSelClient(prev => ({ ...prev, access_code: code }));
  flash("Código generado: " + code);
  return code;
};

// Login del cliente por código
const handleClientLogin = async () => {
  const code = codeInput.trim().toUpperCase();
  if (code.length < 4) return flash("Ingresá el código de acceso", "error");

  try {
    // Buscar cliente por código via RPC (bypasa RLS)
    const { data: clientData, error: ce } = await supabase
      .rpc("get_client_by_code", { p_code: code });

    if (ce) return flash(friendlyAuthError(ce), "error");
    if (!clientData || clientData.length === 0)
      return flash("Código inválido o no encontrado", "error");

    const foundClient = clientData[0];

    // Cargar sus visitas
    const { data: visitData, error: ve } = await supabase
      .rpc("get_visits_by_client_code", { p_code: code });

    if (ve) return flash("Error cargando visitas: " + ve.message, "error");

    setPortalClient(foundClient);
    setPortalVisits((visitData || []).map(v => ({
      ...v,
      clientId: v.client_id,
      categoryId: v.category_id,
      updatedAt: v.updated_at,
    })));
    setCodeInput("");
    setVw("clientPortal");
  } catch (e) {
    flash("Error inesperado: " + e.message, "error");
  }
};

// Salir del portal del cliente
const handlePortalLogout = () => {
  setPortalClient(null);
  setPortalVisits([]);
  setPortalSelVisit(null);
  setPortalSelCat(null);
  setVw("login");
  setLoginMode("cliente");
};

  // Clients
 const saveClient = async () => {
  try {
    if (!user) return flash("No hay sesión activa", "error");
    if (!clientForm.nombre || !clientForm.establecimiento)
      return flash("Nombre y establecimiento obligatorios", "error");

    const isEdit = !!clientForm.id;
    const payload = {
      owner_id: user.id, // CLAVE para que pase RLS
      nombre: clientForm.nombre,
      establecimiento: clientForm.establecimiento,
      localidad: clientForm.localidad || null,
      provincia: clientForm.provincia || null,
      contacto: clientForm.contacto || null,
      email: clientForm.email || null,
      sistema_productivo: clientForm.sistema_productivo || null,
      frecuencia_dias: clientForm.frecuencia_dias ? parseInt(clientForm.frecuencia_dias) : null,
    };

    const run = (p) =>
      isEdit
        ? supabase.from("clients").update(p).eq("id", clientForm.id).select().single()
        : supabase.from("clients").insert([p]).select().single();

    let { data, error } = await run(payload);

    // Si alguna columna nueva no existe aún en la base, reintentar sin ella
    // (correr supabase_migration_clients.sql y supabase_migration_frecuencia.sql para habilitarlas)
    for (const col of ["sistema_productivo", "frecuencia_dias"]) {
      if (error && new RegExp(col, "i").test(error.message || "")) {
        delete payload[col];
        ({ data, error } = await run(payload));
      }
    }

    if (error) {
      console.error("saveClient error:", error);
      return flash(error.message, "error");
    }

    // actualizo el estado local para que se vea instantáneo
    setClients((prev) => {
      const next = isEdit
        ? prev.map((c) => (c.id === data.id ? data : c))
        : [...prev, data];
      next.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      return next;
    });
    if (selClient?.id === data.id) setSelClient(data);

    flash(isEdit ? "Cliente actualizado" : "Cliente guardado");
    try { localStorage.removeItem(`dairy_clientform_${user.id}`); } catch (_) {}
    setClientForm({ nombre: "", establecimiento: "", localidad: "", provincia: "", contacto: "", email: "", sistema_productivo: "" });
    setVw(isEdit ? "clientDetail" : "clients");
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
  // Limpiar borrador de localStorage
  if (draftKey) { try { localStorage.removeItem(draftKey); } catch (_) {} }
  setDraftBanner(false);
  setDraftSavedAt(null);
  setFormData({});
  setSelVisit(null);
  setVw("clientDetail");
};

// Iniciar una visita nueva de un módulo (desde detalle de cliente o briefing)
const startNewVisit = (cat) => {
  setSelCat(cat);
  setSelVisit(null);
  setActiveSections(cat.sections.map(s => s.id)); // todas activas por defecto
  // Cargar visita anterior del mismo módulo para este cliente
  const clientVisits = visits.filter(v => selClient && v.client_id === selClient.id && (v.categoryId || v.category_id) === cat.id);
  const sorted = [...clientVisits].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const prev = sorted[0] || null;
  setPrevVisit(prev);
  // Sembrar la revisión del plan de acción de la visita anterior
  const prevPlan = prev?.data?.plan_accion || [];
  setDraftSavedAt(null);
  setFormData({
    _fecha: today(),
    ...(prevPlan.length ? {
      plan_revision: prevPlan.map(it => ({ texto: it.texto, prioridad: it.prioridad || "media", estado: "pendiente" })),
    } : {}),
  });
  setVw("startVisit");
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
  <div style={{
    position: "fixed", top: 24, right: 24, zIndex: 9999,
    padding: "13px 20px 13px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600,
    fontFamily: ff, display: "flex", alignItems: "center", gap: 10,
    background: msg.type === "error" ? C.danger : C.success,
    color: "#fff",
    boxShadow: msg.type === "error"
      ? "0 6px 24px rgba(196,43,43,0.35)"
      : "0 6px 24px rgba(13,125,71,0.35)",
    animation: "fadeIn 0.2s ease",
    maxWidth: 360,
  }}>
    <span style={{ fontSize: 18 }}>{msg.type === "error" ? "⚠️" : "✅"}</span>
    {msg.text}
  </div>
);


  // ── LOGIN/REGISTER ──
  if (vw === "login" || vw === "register") return (
    <div style={{ fontFamily: ff, minHeight: "100vh", display: "flex", alignItems: "stretch" }}>
      {Toast}
      {/* Panel izquierdo — Branding */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(155deg, ${C.primaryDark} 0%, ${C.primary} 55%, ${C.primaryLight} 100%)`,
        padding: "60px 40px", color: "#fff", minHeight: "100vh",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", top: "40%", left: "5%", width: 120, height: 120, borderRadius: "50%", background: "rgba(0,169,224,0.15)" }} />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 380 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto 24px", border: "1.5px solid rgba(255,255,255,0.25)", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>🐄</div>
          <h1 style={{ fontFamily: ffSerif, fontSize: 42, margin: "0 0 6px", fontWeight: 700, letterSpacing: 1 }}>Nutrisur</h1>
          <p style={{ fontSize: 14, opacity: 0.75, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, margin: "0 0 32px" }}>Excelencia en Nutrición Animal</p>
          <div style={{ width: 40, height: 2, background: "rgba(255,255,255,0.4)", margin: "0 auto 32px" }} />
          <p style={{ fontSize: 15, opacity: 0.85, lineHeight: 1.7, margin: 0 }}>
            Sistema de visitas y auditoría técnica para el seguimiento integral de establecimientos lecheros.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 32, justifyContent: "center" }}>
            {["Registro de visitas", "Análisis técnico", "Historial de clientes", "Informes"].map(f => (
              <span key={f} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600 }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho — Formulario */}
      <div style={{ width: 480, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 48px", minHeight: "100vh", boxShadow: "-4px 0 40px rgba(13,31,56,0.12)" }}>
        <div style={{ width: "100%" }}>

          {/* Selector de rol: Técnico / Cliente */}
          <div style={{ display: "flex", background: C.bg, borderRadius: 12, padding: 4, marginBottom: 32, border: `1px solid ${C.borderLight}` }}>
            {[
              { id: "tecnico", label: "🔧 Soy técnico", desc: "Acceso completo" },
              { id: "cliente", label: "🏡 Soy cliente", desc: "Con mi código" },
            ].map(m => (
              <button key={m.id} onClick={() => setLoginMode(m.id)}
                style={{
                  flex: 1, padding: "10px 8px", border: "none", cursor: "pointer",
                  borderRadius: 10, fontFamily: ff, transition: "all 0.18s",
                  background: loginMode === m.id ? "#fff" : "transparent",
                  boxShadow: loginMode === m.id ? "0 2px 8px rgba(26,79,186,0.12)" : "none",
                  color: loginMode === m.id ? C.primary : C.textLight,
                }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{m.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{m.desc}</div>
              </button>
            ))}
          </div>

          {/* ── MODO TÉCNICO ── */}
          {loginMode === "tecnico" && (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontFamily: ffSerif, fontSize: 24, margin: "0 0 4px", color: C.text, fontWeight: 700 }}>
                  {vw === "login" ? "Bienvenido de nuevo" : "Crear cuenta"}
                </h2>
                <p style={{ fontSize: 14, color: C.textLight, margin: 0 }}>
                  {vw === "login" ? "Ingresá tus credenciales" : "Completá los datos para registrarte"}
                </p>
              </div>
              {vw === "register" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Nombre completo</label>
                  <input type="text" placeholder="Ej: Carlos García" value={loginForm.nombre} onChange={e => setLoginForm({ ...loginForm, nombre: e.target.value })} style={inputStyle} />
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Email</label>
                <input type="text" placeholder="tu@email.com" value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} style={inputStyle} onKeyDown={e => e.key === "Enter" && (vw === "login" ? handleLogin() : handleRegister())} autoComplete="username" />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Contraseña</label>
                <input type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} style={inputStyle} onKeyDown={e => e.key === "Enter" && (vw === "login" ? handleLogin() : handleRegister())} autoComplete="current-password" />
              </div>
              <button onClick={vw === "login" ? handleLogin : handleRegister}
                style={{ width: "100%", padding: "14px 0", fontSize: 15, fontWeight: 700, fontFamily: ff, background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", boxShadow: `0 4px 18px rgba(26,79,186,0.35)`, transition: "all 0.2s ease" }}>
                {vw === "login" ? "Ingresar →" : "Crear cuenta →"}
              </button>
              <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.textLight }}>
                {vw === "login" ? "¿No tenés cuenta? " : "¿Ya tenés cuenta? "}
                <span onClick={() => setVw(vw === "login" ? "register" : "login")} style={{ color: C.primary, cursor: "pointer", fontWeight: 700 }}>
                  {vw === "login" ? "Registrate" : "Iniciar sesión"}
                </span>
              </p>
            </>
          )}

          {/* ── MODO CLIENTE ── */}
          {loginMode === "cliente" && (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontFamily: ffSerif, fontSize: 24, margin: "0 0 4px", color: C.text, fontWeight: 700 }}>
                  Acceso para clientes
                </h2>
                <p style={{ fontSize: 14, color: C.textLight, margin: 0 }}>
                  Ingresá el código que te proporcionó tu técnico Nutrisur
                </p>
              </div>

              {/* Input código estilo grande */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 8 }}>
                  Código de acceso
                </label>
                <input
                  type="text"
                  placeholder="Ej: NUT4K2"
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  onKeyDown={e => e.key === "Enter" && handleClientLogin()}
                  maxLength={6}
                  autoComplete="off"
                  style={{
                    ...inputStyle,
                    fontSize: 28, fontWeight: 800, letterSpacing: 8,
                    textAlign: "center", padding: "16px 14px",
                    borderColor: codeInput.length === 6 ? C.primary : C.borderLight,
                    borderWidth: 2,
                  }}
                />
                {/* Indicador de caracteres */}
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < codeInput.length ? C.primary : C.borderLight, transition: "background 0.15s" }} />
                  ))}
                </div>
              </div>

              <button onClick={handleClientLogin}
                disabled={codeInput.length < 4}
                style={{
                  width: "100%", padding: "14px 0", fontSize: 15, fontWeight: 700, fontFamily: ff,
                  background: codeInput.length >= 4 ? `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})` : C.borderLight,
                  color: codeInput.length >= 4 ? "#fff" : C.textLight,
                  border: "none", borderRadius: 12, cursor: codeInput.length >= 4 ? "pointer" : "not-allowed",
                  boxShadow: codeInput.length >= 4 ? `0 4px 18px rgba(26,79,186,0.35)` : "none",
                  transition: "all 0.2s ease",
                }}>
                Ver mi historial →
              </button>

              {/* Info */}
              <div style={{ marginTop: 24, padding: "14px 16px", background: C.bg, borderRadius: 10, border: `1px solid ${C.borderLight}` }}>
                <div style={{ fontSize: 13, color: C.textLight, lineHeight: 1.6 }}>
                  <strong style={{ color: C.text }}>¿No tenés código?</strong><br />
                  Contactá a tu técnico de Nutrisur para que te asigne tu código de acceso personal.
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${C.borderLight}`, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: C.textLight, margin: 0 }}>Nutrisur UY · Ruta 5 Km 28.5, Progreso, Canelones</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ── LAYOUT ──
  const navItems = [
    { id: "dashboard", label: "Inicio", icon: "home", views: ["dashboard"] },
    { id: "clients", label: "Clientes", icon: "users", views: ["clients","clientDetail","newClient","newVisit","viewVisit","startVisit","briefing"] },
    { id: "informes", label: "Informes", icon: "chart", views: ["informes"] },
  ];
  const Header = (
    <div style={{
      background: `linear-gradient(90deg, ${C.primaryDark} 0%, ${C.primary} 60%, ${C.primaryLight} 100%)`,
      color: "#fff", padding: isMobile ? "0 10px" : "0 32px", height: isMobile ? 56 : 62,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      position: "sticky", top: 0, zIndex: 100,
      boxShadow: "0 2px 20px rgba(14,46,114,0.4)",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, cursor: "pointer", flexShrink: 0 }}
        onClick={() => { setVw("dashboard"); setSelClient(null); setSelVisit(null); }}>
        <div style={{
          width: isMobile ? 34 : 38, height: isMobile ? 34 : 38, borderRadius: 10,
          background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, border: "1px solid rgba(255,255,255,0.25)",
        }}>🐄</div>
        {!isMobile && (
          <div>
            <div style={{ fontFamily: ffSerif, fontSize: 20, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.2 }}>Nutrisur</div>
            <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, lineHeight: 1 }}>Auditoría Lechera</div>
          </div>
        )}
      </div>
      {/* Nav tabs centrados */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {navItems.map(item => {
          const active = item.views.includes(vw);
          return (
            <button key={item.id} onClick={() => {
              if (item.id === "dashboard") { setVw("dashboard"); setSelClient(null); setSelCat(null); setSelVisit(null); }
              else setVw(item.id);
            }} style={{
              display: "flex", alignItems: "center", flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 2 : 7, padding: isMobile ? "6px 10px" : "8px 18px",
              background: active ? "rgba(255,255,255,0.18)" : "transparent",
              color: active ? "#fff" : "rgba(255,255,255,0.65)",
              border: "none", borderRadius: 10, cursor: "pointer",
              fontSize: isMobile ? 10 : 14, fontWeight: active ? 700 : 500, fontFamily: ff,
              transition: "all 0.18s",
              borderBottom: active ? "2px solid rgba(255,255,255,0.9)" : "2px solid transparent",
            }}>
              <Icon name={item.icon} size={isMobile ? 18 : 16} />
              {item.label}
            </button>
          );
        })}
      </div>
      {/* User + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.13)", borderRadius: 22,
          padding: isMobile ? 3 : "6px 16px 6px 10px", fontSize: 13, fontWeight: 600,
          border: "1px solid rgba(255,255,255,0.2)",
        }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
            {(user?.user_metadata?.nombre || user?.email || "T")[0].toUpperCase()}
          </div>
          {!isMobile && <span>{user?.user_metadata?.nombre || user?.email?.split("@")[0] || "Técnico"}</span>}
        </div>
        <button onClick={handleLogout} title="Cerrar sesión" style={{
          display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "6px 8px" : "6px 14px",
          background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)",
          border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8,
          cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff,
          transition: "all 0.18s",
        }}>
          <Icon name="logout" size={15} />
          {!isMobile && "Salir"}
        </button>
      </div>
    </div>
  );
  // Nav integrado en el Header — no se usa como variable separada

  // ── DASHBOARD ──
  const Dashboard = (
    <div style={{ padding: isMobile ? "18px 14px" : "32px 36px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      {/* Header bienvenida */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: ffSerif, fontSize: isMobile ? 22 : 28, marginBottom: 4, color: C.text, fontWeight: 700 }}>
          Bienvenido, {user?.user_metadata?.nombre || user?.email?.split("@")[0] || "Técnico"} 👋
        </h2>
        <p style={{ color: C.textLight, margin: 0, fontSize: 15, textTransform: "capitalize" }}>
          {new Date().toLocaleDateString("es-UY", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Resumen compacto */}
      <div style={{ fontSize: 14, color: C.textLight, marginBottom: 24, fontWeight: 500 }}>
        🏡 {clients.length} cliente{clients.length !== 1 ? "s" : ""} · 📋 {allVisitsCache.length || 0} visita{allVisitsCache.length !== 1 ? "s" : ""} registradas
      </div>

      {/* ── HOY: agenda + alertas unificadas, una tarjeta por cliente ── */}
      {(() => {
        if (!allVisitsCache.length || !clients.length) return null;
        const hoy = new Date();
        const chip = (col) => ({ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 99, background: col + "12", color: col, border: `1px solid ${col}30` });

        const tarjetas = clients.map(c => {
          const cVisits = allVisitsCache.filter(v => v.client_id === c.id);
          if (!cVisits.length) return null;
          const freq = parseInt(c.frecuencia_dias) || 45;
          const lastFecha = cVisits.map(v => v.fecha).filter(Boolean).sort().pop() || null;
          const diasDesde = lastFecha ? Math.floor((hoy - new Date(lastFecha)) / 86400000) : null;
          const diasRestantes = diasDesde !== null ? freq - diasDesde : null;

          const ultimaPorCat = {};
          cVisits.forEach(v => {
            const k = v.categoryId || v.category_id;
            if (!ultimaPorCat[k] || (v.fecha || "") > (ultimaPorCat[k].fecha || "")) ultimaPorCat[k] = v;
          });

          const rojos = [];
          METRICS.forEach(m => {
            const v = ultimaPorCat[m.cat];
            if (!v || !m.ref) return;
            const val = m.extract(v);
            if (val === null || isNaN(val)) return;
            if (val < m.ref[0] || val > m.ref[1]) rojos.push(`${m.label}: ${val}${m.unit} (obj. ${m.ref[0]}–${m.ref[1]})`);
          });

          let abiertas = 0, pendientes = 0;
          Object.values(ultimaPorCat).forEach(v => {
            abiertas += (v.data?.plan_accion || []).length;
            pendientes += (v.data?.plan_revision || []).filter(it => it.estado === "pendiente").length;
          });

          const tieneAlgo = (diasRestantes !== null && diasRestantes <= 7) || rojos.length || pendientes || abiertas;
          if (!tieneAlgo) return null;
          const urgencia = (diasRestantes !== null && diasRestantes < 0 ? 1000 - diasRestantes : 0) + rojos.length * 10 + pendientes * 5 + abiertas;
          return { c, lastFecha, diasRestantes, rojos, abiertas, pendientes, urgencia };
        }).filter(Boolean).sort((a, b) => b.urgencia - a.urgencia).slice(0, 8);

        if (!tarjetas.length) return (
          <div style={{ background: C.success + "10", border: `1px solid ${C.success}30`, borderRadius: 12, padding: "12px 18px", marginBottom: 36, fontSize: 14, color: C.success, fontWeight: 600 }}>
            ✓ Todo en orden: sin visitas por vencer, indicadores fuera de rango ni pendientes.
          </div>
        );

        return (
          <div style={{ marginBottom: 36 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: C.text }}>📌 Hoy</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {tarjetas.map(({ c, lastFecha, diasRestantes, rojos, abiertas, pendientes }) => {
                const vencida = diasRestantes !== null && diasRestantes < 0;
                const borde = vencida || rojos.length ? C.danger : (pendientes || (diasRestantes !== null && diasRestantes <= 7)) ? C.warning : C.primary;
                return (
                  <Card key={c.id} onClick={() => { setSelClient(c); setVw("clientDetail"); }} style={{ cursor: "pointer", borderLeft: `4px solid ${borde}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 170, flex: "0 0 auto" }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{c.nombre}</div>
                        <div style={{ fontSize: 12, color: C.textLight }}>{c.establecimiento}{lastFecha ? ` · última: ${fmt(lastFecha)}` : ""}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 200 }}>
                        {diasRestantes !== null && diasRestantes <= 7 && (
                          <span style={chip(vencida ? C.danger : C.warning)}>
                            {vencida ? `visita vencida hace ${-diasRestantes} d` : diasRestantes === 0 ? "visita hoy" : `visita en ${diasRestantes} d`}
                          </span>
                        )}
                        {rojos.length > 0 && <span style={chip(C.danger)} title={rojos.join("  ·  ")}>{rojos.length} indicador{rojos.length > 1 ? "es" : ""} en rojo</span>}
                        {pendientes > 0 && <span style={chip(C.warning)}>{pendientes} pendiente{pendientes > 1 ? "s" : ""} de visitas anteriores</span>}
                        {abiertas > 0 && <span style={chip(C.primary)}>{abiertas} recomendación{abiertas > 1 ? "es" : ""} en curso</span>}
                      </div>
                      <Btn size="sm" onClick={(e) => { e?.stopPropagation?.(); setSelClient(c); setVw("briefing"); }} style={{ background: C.success, flexShrink: 0 }}>🧭 Preparar</Btn>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Acciones rápidas */}
      <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: C.text }}>Acciones rápidas</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 36 }}>
        <Card onClick={() => { setClientForm({ nombre: "", establecimiento: "", localidad: "", provincia: "", contacto: "", email: "", sistema_productivo: "" }); setVw("newClient"); }}
          style={{ border: `1.5px solid ${C.primary}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 50, height: 50, borderRadius: 12, background: `linear-gradient(135deg, ${C.primary}18, ${C.primaryLight}15)`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.primary}20` }}>
              <Icon name="plus" color={C.primary} size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Nuevo Cliente</div>
              <div style={{ fontSize: 13, color: C.textLight, marginTop: 2 }}>Agregar establecimiento</div>
            </div>
            <div style={{ marginLeft: "auto" }}><Icon name="compare" color={C.primary} size={18} /></div>
          </div>
        </Card>
        <Card onClick={() => setVw("clients")} style={{ border: `1.5px solid ${C.accent}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 50, height: 50, borderRadius: 12, background: `${C.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.accent}30` }}>
              <Icon name="clipboard" color={C.accent} size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Nueva Visita</div>
              <div style={{ fontSize: 13, color: C.textLight, marginTop: 2 }}>Seleccionar cliente</div>
            </div>
            <div style={{ marginLeft: "auto" }}><Icon name="compare" color={C.accent} size={18} /></div>
          </div>
        </Card>
        <Card onClick={() => setVw("informes")} style={{ border: `1.5px solid ${C.success}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 50, height: 50, borderRadius: 12, background: `${C.success}15`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.success}30` }}>
              <Icon name="chart" color={C.success} size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Ver Informes</div>
              <div style={{ fontSize: 13, color: C.textLight, marginTop: 2 }}>Estadísticas y análisis</div>
            </div>
            <div style={{ marginLeft: "auto" }}><Icon name="compare" color={C.success} size={18} /></div>
          </div>
        </Card>
      </div>

      {/* Clientes recientes */}
      {clients.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>Clientes recientes</h3>
            <button onClick={() => setVw("clients")} style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0 }}>Ver todos →</button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {clients.slice(0, 5).map(c => (
              <Card key={c.id} onClick={() => { setSelClient(c); setVw("clientDetail"); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${C.primary}12`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: C.primary }}>
                      {c.nombre[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{c.nombre}</div>
                      <div style={{ fontSize: 12, color: C.textLight }}>{c.establecimiento}{c.localidad ? ` · ${c.localidad}` : ""}</div>
                    </div>
                  </div>
                  <Icon name="compare" color={C.textLight} size={16} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ── CLIENTS ──
  const ClientList = (
    <div style={{ padding: isMobile ? "18px 14px" : "32px 36px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: ffSerif, fontSize: isMobile ? 21 : 26, margin: "0 0 4px", color: C.text, fontWeight: 700 }}>Clientes</h2>
          <p style={{ margin: 0, fontSize: 14, color: C.textLight }}>{clients.length} establecimiento{clients.length !== 1 ? "s" : ""} registrado{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <Btn icon="plus" onClick={() => { setClientForm({ nombre: "", establecimiento: "", localidad: "", provincia: "", contacto: "", email: "", sistema_productivo: "" }); setVw("newClient"); }}>
          Nuevo Cliente
        </Btn>
      </div>
      {/* Buscador */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
          <Icon name="search" size={17} color={C.textLight} />
        </div>
        <input type="text" placeholder="Buscar por nombre, establecimiento o localidad..."
          value={searchQ} onChange={e => setSearchQ(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 42 }} />
      </div>
      {filteredClients.length === 0
        ? (
          <Card style={{ textAlign: "center", padding: "60px 40px" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🐄</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>No hay clientes todavía</div>
            <p style={{ color: C.textLight, margin: "0 0 20px" }}>Agregá tu primer establecimiento para comenzar</p>
            <Btn icon="plus" onClick={() => { setClientForm({ nombre: "", establecimiento: "", localidad: "", provincia: "", contacto: "", email: "", sistema_productivo: "" }); setVw("newClient"); }}>
              Nuevo Cliente
            </Btn>
          </Card>
        )
        : (
          <div style={{ display: "grid", gap: 10 }}>
            {filteredClients.map(c => (
              <Card key={c.id} onClick={() => { setSelClient(c); setVw("clientDetail"); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.primary}15, ${C.primaryLight}10)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: C.primary, border: `1px solid ${C.primary}20`, flexShrink: 0 }}>
                      {c.nombre[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{c.nombre}</div>
                      <div style={{ fontSize: 13, color: C.textLight, marginTop: 2 }}>
                        {c.establecimiento}{c.localidad ? ` · ${c.localidad}` : ""}{c.provincia ? `, ${c.provincia}` : ""}
                      </div>
                      {c.contacto && <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>📞 {c.contacto}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.primary }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Ver detalle</span>
                    <Icon name="compare" color={C.primary} size={16} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  );

  // ── NEW CLIENT ──
  const NewClient = (
    <div style={{ padding: isMobile ? "18px 14px" : "32px 36px", maxWidth: 680, margin: "0 auto", width: "100%" }}>
      <button onClick={() => setVw("clients")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.textLight, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: ff, padding: "6px 0", marginBottom: 24 }}>
        <Icon name="back" size={16} color={C.textLight} /> Volver a clientes
      </button>
      <h2 style={{ fontFamily: ffSerif, fontSize: isMobile ? 21 : 26, marginBottom: 4, color: C.text, fontWeight: 700 }}>
        {clientForm.id ? "Editar Cliente" : "Nuevo Cliente"}
      </h2>
      <p style={{ color: C.textLight, margin: "0 0 28px", fontSize: 14 }}>Completá los datos del establecimiento</p>
      <Card style={{ padding: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {[
            { key: "nombre", label: "Nombre del responsable *", ph: "Ej: Juan García", span: 2 },
            { key: "establecimiento", label: "Nombre del establecimiento *", ph: "Ej: Tambo La Aurora", span: 2 },
            { key: "localidad", label: "Localidad", ph: "Ej: Progreso" },
            { key: "provincia", label: "Departamento / Provincia", ph: "Canelones" },
            { key: "contacto", label: "Teléfono", ph: "+598 99 123 456" },
            { key: "email", label: "Email", ph: "cliente@tambo.com" },
          ].map(({ key, label, ph, span }) => (
            <div key={key} style={{ gridColumn: span === 2 ? "1 / -1" : undefined }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>{label}</label>
              <input type="text" placeholder={ph} value={clientForm[key] || ""} onChange={e => setClientForm({ ...clientForm, [key]: e.target.value })} style={inputStyle} />
            </div>
          ))}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Sistema productivo</label>
            <select value={clientForm.sistema_productivo || ""} onChange={e => setClientForm({ ...clientForm, sistema_productivo: e.target.value })} style={inputStyle}>
              <option value="">— Seleccionar —</option>
              <option value="Pastoril">Pastoril (base pradera / pastoreo)</option>
              <option value="Pastoril + suplementación">Pastoril + suplementación (mixto)</option>
              <option value="Confinamiento / TMR">Confinamiento / TMR</option>
              <option value="Otro">Otro</option>
            </select>
            <p style={{ fontSize: 12, color: C.textLight, margin: "4px 0 0" }}>Permite contextualizar los parámetros evaluados en cada visita.</p>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Frecuencia de visitas acordada</label>
            <select value={clientForm.frecuencia_dias || ""} onChange={e => setClientForm({ ...clientForm, frecuencia_dias: e.target.value ? parseInt(e.target.value) : null })} style={inputStyle}>
              <option value="">— Sin definir (se asume 45 días) —</option>
              <option value="15">Cada 15 días</option>
              <option value="30">Mensual (cada 30 días)</option>
              <option value="45">Cada 45 días</option>
              <option value="60">Cada 60 días</option>
              <option value="90">Trimestral (cada 90 días)</option>
            </select>
            <p style={{ fontSize: 12, color: C.textLight, margin: "4px 0 0" }}>Se usa para la agenda de próximas visitas en el inicio.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.borderLight}` }}>
          <Btn icon="save" onClick={saveClient}>Guardar cliente</Btn>
          <Btn variant="outline" onClick={() => setVw("clients")}>Cancelar</Btn>
        </div>
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
    <div style={{ padding: isMobile ? "16px 12px" : "24px 32px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      <Btn variant="ghost" icon="back" size="sm" onClick={() => { setVw("clients"); setSelClient(null); }} style={{ marginBottom: 16 }}>Volver</Btn>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: ffSerif, fontSize: 24, margin: 0 }}>{selClient.nombre}</h2>
            <p style={{ color: C.textLight, marginTop: 4, marginBottom: 0 }}>{selClient.establecimiento}{selClient.localidad ? ` • ${selClient.localidad}` : ""}{selClient.provincia ? `, ${selClient.provincia}` : ""}</p>
            {selClient.sistema_productivo && <p style={{ fontSize: 13, color: C.primary, margin: "4px 0 0", fontWeight: 600 }}>🌾 {selClient.sistema_productivo}</p>}
            {selClient.contacto && <p style={{ fontSize: 13, color: C.textLight, margin: "4px 0 0" }}>📞 {selClient.contacto}</p>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Btn size="sm" onClick={() => setVw("briefing")} style={{ background: C.success }}>🧭 Preparar visita</Btn><Btn size="sm" onClick={() => { setInfoClient(selClient.id); setInfoTab("ficha"); setVw("informes"); }} style={{ background: C.primary }}>📊 Ficha del tambo</Btn><Btn variant="outline" icon="edit" size="sm" onClick={() => { setClientForm(selClient); setVw("newClient"); }}>Editar</Btn><Btn variant="danger" icon="trash" size="sm" onClick={() => deleteClient(selClient)}>Eliminar</Btn></div>
        </div>
      </Card>

      {/* ── Código de acceso del cliente ── */}
      <Card style={{ marginBottom: 24, border: `1.5px solid ${C.primary}25`, background: `${C.primary}04` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: `${C.primary}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, border: `1px solid ${C.primary}20` }}>🔑</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Código de acceso del cliente</div>
              <div style={{ fontSize: 13, color: C.textLight }}>El cliente usa este código para ver su historial de visitas</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {selClient?.access_code ? (
              <>
                <div style={{ background: "#fff", border: `2px solid ${C.primary}40`, borderRadius: 10, padding: "8px 20px", fontFamily: "'Courier New', monospace", fontSize: 22, fontWeight: 800, letterSpacing: 6, color: C.primary }}>
                  {selClient.access_code}
                </div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(selClient.access_code); flash("Código copiado al portapapeles"); }}
                  title="Copiar código"
                  style={{ padding: "8px 14px", background: `${C.primary}12`, border: `1px solid ${C.primary}30`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.primary, fontFamily: ff }}>
                  📋 Copiar
                </button>
                <button
                  onClick={() => { if (confirm("¿Regenerar el código? El anterior dejará de funcionar.")) saveClientCode(selClient); }}
                  title="Regenerar código"
                  style={{ padding: "8px 14px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, color: C.textLight, fontFamily: ff }}>
                  🔄 Regenerar
                </button>
              </>
            ) : (
              <Btn icon="plus" onClick={() => saveClientCode(selClient)}>
                Generar código
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {/* ── Progresión reciente ── */}
      {visits.length >= 2 && (() => {
        // Últimas 3 visitas ordenadas por fecha desc
        const recent = [...visits].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).slice(0, 3);
        // Métricas a mostrar (las más útiles)
        const keyMetrics = METRICS.filter(m => ["bcs", "cetosis", "heces", "locomocion", "bcs_prod"].includes(m.id));
        return (
          <Card style={{ marginBottom: 24, padding: "18px 22px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>📈 Progresión reciente</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 10px 6px 0", color: C.textLight, fontWeight: 600, borderBottom: `1px solid ${C.borderLight}`, whiteSpace: "nowrap" }}>Visita</th>
                    <th style={{ textAlign: "left", padding: "6px 10px 6px 0", color: C.textLight, fontWeight: 600, borderBottom: `1px solid ${C.borderLight}` }}>Módulo</th>
                    {keyMetrics.map(m => (
                      <th key={m.id} style={{ textAlign: "center", padding: "6px 8px", color: C.textLight, fontWeight: 600, borderBottom: `1px solid ${C.borderLight}`, whiteSpace: "nowrap" }}>{m.label}{m.unit ? ` (${m.unit})` : ""}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((v, vi) => {
                    const cat = CATEGORIES.find(c => c.id === (v.categoryId || v.category_id));
                    const prevV = recent[vi + 1];
                    return (
                      <tr key={v.id} style={{ background: vi === 0 ? `${C.primary}06` : "transparent" }}>
                        <td style={{ padding: "8px 10px 8px 0", fontWeight: vi === 0 ? 700 : 400, color: vi === 0 ? C.primary : C.text, whiteSpace: "nowrap" }}>{v.fecha || "—"}</td>
                        <td style={{ padding: "8px 10px 8px 0", color: cat?.color || C.textLight, fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{cat?.name || "—"}</td>
                        {keyMetrics.map(m => {
                          const val = m.extract(v);
                          const prevVal = prevV ? m.extract(prevV) : null;
                          const inRef = val !== null && m.ref ? (val >= m.ref[0] && val <= m.ref[1]) : null;
                          const color = inRef === true ? C.success : inRef === false ? C.danger : C.textLight;
                          const arrow = (val !== null && prevVal !== null) ? (val > prevVal ? " ↑" : val < prevVal ? " ↓" : " →") : "";
                          const arrowColor = arrow === " ↑" ? C.success : arrow === " ↓" ? C.danger : C.textLight;
                          return (
                            <td key={m.id} style={{ textAlign: "center", padding: "8px", fontWeight: val !== null ? 700 : 400 }}>
                              {val !== null ? (
                                <span style={{ color }}>{val}<span style={{ color: arrowColor, fontWeight: 800, fontSize: 11 }}>{arrow}</span></span>
                              ) : <span style={{ color: C.borderLight }}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: C.textLight, margin: "10px 0 0", fontStyle: "italic" }}>↑ mejora · ↓ baja · valores en verde dentro del rango objetivo · Para análisis completo ver Informes.</p>
          </Card>
        );
      })()}

      <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>Nueva visita</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 32 }}>
        {CATEGORIES.map(cat => (
          <Card key={cat.id} onClick={() => startNewVisit(cat)} style={{ borderLeft: `4px solid ${cat.color}`, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: cat.color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={cat.icon} color={cat.color} /></div>
              <div>
                <div style={{ fontWeight: 600 }}>{cat.name}</div>
                <div style={{ fontSize: 12, color: C.textLight }}>{cat.sections.length} secciones</div>
              </div>
              <div style={{ marginLeft: "auto", color: cat.color, fontSize: 18 }}>›</div>
            </div>
          </Card>
        ))}
      </div>

      {/* ═══ ENHANCED VISIT HISTORY ═══ */}
      <VisitHistoryPanel
        visits={visits}
        onView={(v, catArg) => {
          const cat = catArg || CATEGORIES.find(c => c.id === (v.categoryId || v.category_id));
          if (!cat) return flash("No se puede identificar el módulo de esta visita", "error");
          setSelVisit(v); setSelCat(cat);
          setFormData({ _fecha: v.fecha, ...v.data });
          const exp = {}; (cat.sections || []).forEach(s => { exp[s.id] = true; }); setExpandedSections(exp);
          setWizardStep(0);
          setVw("viewVisit");
        }}
        onEdit={(v, catArg) => {
          const cat = catArg || CATEGORIES.find(c => c.id === (v.categoryId || v.category_id));
          if (!cat) return flash("No se puede identificar el módulo de esta visita", "error");
          setSelVisit(v); setSelCat(cat);
          setFormData({ _fecha: v.fecha, ...v.data });
          const exp = {}; (cat.sections || []).forEach(s => { exp[s.id] = true; }); setExpandedSections(exp);
          setWizardStep(0);
          setVw("newVisit");
        }}
        onDelete={(v) => deleteVisit(v)}
        onDownloadPdf={(v) => downloadReport(v, "pdf")}
        onSharePdf={(v) => downloadReport(v, "wa")}
        onDownloadTxt={(v) => downloadReport(v, "txt")}
        onDownloadCsv={(v) => downloadReport(v, "csv")}
      />
    </div>
  );


  // ── START VISIT (checklist de secciones) ──
  const StartVisit = selCat && (
    <div style={{ padding: isMobile ? "16px 12px" : "24px 32px", maxWidth: 700, margin: "0 auto", width: "100%" }}>
      <Btn variant="ghost" icon="back" size="sm" onClick={() => setVw("clientDetail")} style={{ marginBottom: 16 }}>Volver</Btn>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: selCat.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={selCat.icon} color={selCat.color} size={26} />
        </div>
        <div>
          <h2 style={{ fontFamily: ffSerif, fontSize: 22, margin: 0 }}>Nueva visita — {selCat.name}</h2>
          <p style={{ color: C.textLight, margin: "4px 0 0", fontSize: 14 }}>{selClient?.nombre} · {selClient?.establecimiento}</p>
        </div>
      </div>

      {/* Fecha */}
      <Card style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 6 }}>Fecha de la visita</label>
        <input type="date" value={formData._fecha || today()} onChange={e => setFormData(f => ({ ...f, _fecha: e.target.value }))} style={{ ...inputStyle, maxWidth: 220 }} />
      </Card>

      {/* Checklist de secciones */}
      {/* ── Presets: rápida / completa ── */}
      {(() => {
        const core = (CORE_SECTIONS[selCat.id] || []).filter(id => selCat.sections.some(s => s.id === id));
        const allIds = selCat.sections.map(s => s.id);
        const act = activeSections || allIds;
        const isCore = core.length > 0 && act.length === core.length && core.every(id => act.includes(id));
        const isAll = act.length === allIds.length;
        const presets = [
          ...(core.length ? [{ id: "rapida", icon: "⚡", title: "Visita rápida", desc: `${core.length} secciones esenciales — lo que se mide siempre`, active: isCore && !isAll, onClick: () => setActiveSections(core) }] : []),
          { id: "completa", icon: "📋", title: "Auditoría completa", desc: `Las ${allIds.length} secciones del módulo`, active: isAll, onClick: () => setActiveSections(allIds) },
        ];
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 16 }}>
            {presets.map(p => (
              <div key={p.id} onClick={p.onClick}
                style={{
                  cursor: "pointer", textAlign: "center", padding: "16px 14px", borderRadius: 12,
                  background: p.active ? selCat.color : C.card, color: p.active ? "#fff" : C.text,
                  border: `2px solid ${p.active ? selCat.color : C.borderLight}`, transition: "all 0.15s",
                }}>
                <div style={{ fontSize: 24 }}>{p.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>{p.title}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        );
      })()}

      <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>⚙️ Personalizar selección</div>
            <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>Tocá una sección para incluirla o sacarla.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setActiveSections(selCat.sections.map(s => s.id))} style={{ fontSize: 12, color: C.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Todos</button>
            <button onClick={() => setActiveSections([])} style={{ fontSize: 12, color: C.textLight, background: "none", border: "none", cursor: "pointer" }}>Ninguno</button>
          </div>
        </div>
        {selCat.sections.map((sec, i) => {
          const isActive = (activeSections || []).includes(sec.id);
          return (
            <div key={sec.id} onClick={() => setActiveSections(prev => {
              const curr = prev || selCat.sections.map(s => s.id);
              return curr.includes(sec.id) ? curr.filter(id => id !== sec.id) : [...curr, sec.id];
            })} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "13px 20px",
              borderBottom: i < selCat.sections.length - 1 ? `1px solid ${C.borderLight}` : "none",
              cursor: "pointer", background: isActive ? "#fff" : C.bg, transition: "background 0.15s",
            }}>
              {/* Checkbox */}
              <div style={{
                width: 22, height: 22, borderRadius: 6, border: `2px solid ${isActive ? selCat.color : C.border}`,
                background: isActive ? selCat.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s",
              }}>
                {isActive && <svg width="12" height="10" viewBox="0 0 12 10"><path d="M1 5l3.5 3.5L11 1" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>}
              </div>
              <div style={{ flex: 1, opacity: isActive ? 1 : 0.45 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{sec.title}</div>
                {sec.subtitle && <div style={{ fontSize: 12, color: C.textLight, marginTop: 1 }}>{sec.subtitle}</div>}
              </div>
              <div style={{ fontSize: 12, color: C.textLight, flexShrink: 0 }}>
                {sec.customComponent ? "🔧 Componente" : `${sec.fields.length} campos`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumen */}
      <div style={{ fontSize: 13, color: C.textLight, marginBottom: 20, textAlign: "center" }}>
        {(activeSections || []).length} de {selCat.sections.length} secciones seleccionadas
      </div>

      {/* Botón comenzar */}
      <Btn
        size="lg"
        onClick={() => {
          const acts = activeSections || selCat.sections.map(s => s.id);
          const exp = {};
          acts.forEach(id => { exp[id] = true; });
          setExpandedSections(exp);
          setWizardStep(0);
          setVw("newVisit");
        }}
        style={{ width: "100%", justifyContent: "center", padding: "14px 0", fontSize: 16 }}
        disabled={(activeSections || []).length === 0}
      >
        Comenzar recorrido →
      </Btn>
    </div>
  );

  // ── VISIT FORM ──
  const VisitForm = selCat && (
    <div style={{ padding: isMobile ? "16px 12px" : "24px 32px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <Btn variant="ghost" icon="back" size="sm" onClick={() => setVw("clientDetail")} style={{ marginBottom: 16 }}>Volver</Btn>
      {/* ── Banner de borrador recuperable ── */}
      {draftBanner && vw === "newVisit" && !selVisit && (
        <div style={{ background: "#FFF8E1", border: "1.5px solid #F59E0B", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#92400E" }}>Hay un borrador guardado para esta visita</div>
              <div style={{ fontSize: 12, color: "#B45309" }}>Podés recuperarlo o empezar desde cero.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={recoverDraft} style={{ padding: "7px 14px", background: "#F59E0B", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: ff }}>Recuperar</button>
            <button onClick={discardDraft} style={{ padding: "7px 14px", background: "transparent", color: "#92400E", border: "1px solid #F59E0B", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: ff }}>Descartar</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Badge color={selCat.color}>{selCat.name}</Badge>
          <h2 style={{ fontFamily: ffSerif, fontSize: 22, margin: "8px 0 0" }}>{vw === "viewVisit" ? "Detalle de Visita" : (selVisit ? "Editar Visita" : "Nueva Visita")}</h2>
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

      {/* ── Barra de progreso ── */}
      {vw !== "viewVisit" && (() => {
        const visibleSections = selCat.sections.filter(s => !activeSections || activeSections.includes(s.id));
        const filledCount = visibleSections.filter(sec =>
          sec.customComponent
            ? (sec.customComponent === "forage_stock"
                ? (formData[`${sec.id}_stock`]?.length > 0 || sec.fields.some(f => !!formData[f.id]))
                : !!formData[`${sec.id}_${sec.customComponent.replace("cowscore_","").replace("ph_scoring","ph").replace("forage_stock","stock")}`])
            : sec.fields.some(f => !!formData[f.id])
        ).length;
        const pct = visibleSections.length > 0 ? Math.round(filledCount / visibleSections.length * 100) : 0;
        const barColor = pct === 100 ? C.success : pct >= 50 ? selCat.color : C.warning;
        return (
          <div style={{ marginBottom: 16, background: C.card, borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.borderLight}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                Progreso de la visita
                {draftSavedAt && vw === "newVisit" && !selVisit && (
                  <span style={{ color: C.success, fontWeight: 700, marginLeft: 10, fontSize: 12 }}>✓ borrador guardado {draftSavedAt}</span>
                )}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{filledCount} / {visibleSections.length} secciones con datos</span>
            </div>
            <div style={{ height: 8, background: C.borderLight, borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 99, transition: "width 0.4s ease" }} />
            </div>
          </div>
        );
      })()}

      {/* ── WIZARD: una sección a la vez ── */}
      {(() => {
        const visibleSecs = selCat.sections.filter(sec => !activeSections || activeSections.includes(sec.id));
        const totalSteps = visibleSecs.length;
        const safeStep = Math.min(wizardStep, totalSteps - 1);
        const sec = visibleSecs[safeStep];
        if (!sec) return null;
        const secIdx = safeStep;
        const ro = vw === "viewVisit";
        const hasData = sec.customComponent
          ? (sec.customComponent === "forage_stock"
              ? (formData[`${sec.id}_stock`]?.length > 0 || sec.fields.some(f => !!formData[f.id]))
              : !!formData[`${sec.id}_${sec.customComponent.replace("cowscore_","").replace("ph_scoring","ph").replace("forage_stock","stock")}`])
          : sec.fields.some(f => !!formData[f.id]);

        // Miniaturas de navegación (dots)
        const dots = visibleSecs.map((s, i) => {
          const hd = s.customComponent
            ? (s.customComponent === "forage_stock"
                ? (formData[`${s.id}_stock`]?.length > 0 || s.fields.some(f => !!formData[f.id]))
                : !!formData[`${s.id}_${s.customComponent.replace("cowscore_","").replace("ph_scoring","ph").replace("forage_stock","stock")}`])
            : s.fields.some(f => !!formData[f.id]);
          return { idx: i, hd };
        });

        return (
          <>
            {/* Navegación mini por puntos */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {dots.map(d => (
                <button key={d.idx} onClick={() => setWizardStep(d.idx)} title={visibleSecs[d.idx].title}
                  style={{ width: d.idx === safeStep ? 28 : 10, height: 10, borderRadius: 99, border: "none", cursor: "pointer", padding: 0,
                    background: d.idx === safeStep ? selCat.color : d.hd ? selCat.color + "60" : C.borderLight,
                    transition: "all 0.2s", flexShrink: 0 }} />
              ))}
              <span style={{ fontSize: 12, color: C.textLight, marginLeft: 6 }}>{safeStep + 1} / {totalSteps}</span>
            </div>

            <Card style={{ marginBottom: 16, borderLeft: `4px solid ${selCat.color}`, minHeight: 200 }}>
              {/* Cabecera de sección */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: hasData ? selCat.color : C.borderLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 800, color: hasData ? "#fff" : C.textLight }}>
                  {hasData ? "✓" : secIdx + 1}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{sec.title}</h4>
                  <p style={{ margin: "3px 0 0", fontSize: 13, color: C.textLight }}>{sec.subtitle}</p>
                </div>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                {/* ── Comparación vs visita anterior (solo en modo nueva/editar) ── */}
                {prevVisit && vw !== "viewVisit" && (() => {
                  const pd = prevVisit.data || {};
                  const chips = [];
                  // Campos numéricos de la sección
                  sec.fields.forEach(f => {
                    if (f.type === "number" && pd[f.id] != null && pd[f.id] !== "") {
                      const curr = formData[f.id];
                      const prev = parseFloat(pd[f.id]);
                      if (curr != null && curr !== "" && !isNaN(parseFloat(curr))) {
                        const delta = round(parseFloat(curr) - prev, 2);
                        const icon = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
                        const col = delta === 0 ? C.textLight : (delta > 0 ? C.success : C.danger);
                        chips.push({ label: f.label.replace(/\(.*?\)/g, "").trim(), prev: `${prev}${f.unit || ""}`, curr: `${curr}${f.unit || ""}`, delta: `${delta > 0 ? "+" : ""}${delta}${f.unit || ""}`, icon, col });
                      } else {
                        chips.push({ label: f.label.replace(/\(.*?\)/g, "").trim(), prev: `${prev}${f.unit || ""}`, curr: null, col: C.textLight });
                      }
                    }
                  });
                  // CowScore: promedios
                  if (sec.customComponent?.startsWith("cowscore_")) {
                    const prevCs = pd[`${sec.id}_cowscore`];
                    const currCs = formData[`${sec.id}_cowscore`];
                    const prevVals = (prevCs?.cows || []).map(c => parseFloat(c.score)).filter(n => !isNaN(n));
                    if (prevVals.length) {
                      const prevAvg = round(prevVals.reduce((s, n) => s + n, 0) / prevVals.length, 2);
                      const label = "Prom. " + sec.title.replace(/[a-z]\)\s*/i, "").trim();
                      const currVals = (currCs?.cows || []).map(c => parseFloat(c.score)).filter(n => !isNaN(n));
                      if (currVals.length) {
                        const currAvg = round(currVals.reduce((s, n) => s + n, 0) / currVals.length, 2);
                        const delta = round(currAvg - prevAvg, 2);
                        const icon = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
                        const col = delta === 0 ? C.textLight : (delta > 0 ? C.success : C.danger);
                        chips.push({ label, prev: String(prevAvg), curr: String(currAvg), delta: `${delta >= 0 ? "+" : ""}${delta}`, icon, col });
                      } else {
                        chips.push({ label, prev: String(prevAvg), curr: null, col: C.textLight });
                      }
                    }
                  }
                  // pH
                  if (sec.customComponent === "ph_scoring") {
                    const prevPh = pd[`${sec.id}_ph`];
                    const prevPhVals = (prevPh?.samples || []).map(s => parseFloat(s.ph)).filter(n => !isNaN(n));
                    if (prevPhVals.length) {
                      const prevAvg = round(prevPhVals.reduce((s, n) => s + n, 0) / prevPhVals.length, 2);
                      const currPh = formData[`${sec.id}_ph`];
                      const currPhVals = (currPh?.samples || []).map(s => parseFloat(s.ph)).filter(n => !isNaN(n));
                      if (currPhVals.length) {
                        const currAvg = round(currPhVals.reduce((s, n) => s + n, 0) / currPhVals.length, 2);
                        const delta = round(currAvg - prevAvg, 2);
                        const icon = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
                        const col = delta === 0 ? C.textLight : (delta > 0 ? C.success : C.danger);
                        chips.push({ label: "pH prom.", prev: String(prevAvg), curr: String(currAvg), delta: `${delta >= 0 ? "+" : ""}${delta}`, icon, col });
                      } else {
                        chips.push({ label: "pH prom. (anterior)", prev: String(prevAvg), curr: null, col: C.textLight });
                      }
                    }
                  }
                  if (!chips.length) return null;
                  return (
                    <div style={{ background: "#f0f4ff", border: `1px solid ${C.primary}25`, borderRadius: 8, padding: "8px 12px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0 }}>vs {fmt(prevVisit.fecha)}</span>
                      {chips.slice(0, 6).map((ch, i) => (
                        <span key={i} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10, background: ch.curr ? (ch.col + "15") : C.borderLight, color: ch.curr ? ch.col : C.textLight, fontWeight: ch.curr ? 600 : 400 }}>
                          {ch.label}: {ch.prev}
                          {ch.curr && <> → {ch.curr} <span style={{ fontWeight: 700 }}>{ch.icon}{ch.delta}</span></>}
                        </span>
                      ))}
                    </div>
                  );
                })()}
                {/* Custom components */}
                {sec.customComponent === "ingredients" && (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: C.textLight, display: "block", marginBottom: 6 }}>Composición de la dieta</label>
                    <IngredientSelector
                      value={formData[`${sec.id}_ingredients`] || []}
                      onChange={val => handleFieldChange(`${sec.id}_ingredients`, val)}
                      readOnly={ro}
                      extraData={formData[`${sec.id}_mix`] || {}}
                      onExtraChange={ro ? null : val => handleFieldChange(`${sec.id}_mix`, val)}
                    />
                    <ForageStockPanel
                      value={formData[`${sec.id}_stock`] || []}
                      onChange={val => handleFieldChange(`${sec.id}_stock`, val)}
                      readOnly={ro}
                      dietItems={formData[`${sec.id}_ingredients`] || []}
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
                {sec.customComponent === "ph_scoring" && (
                  <PHScoring
                    value={formData[`${sec.id}_ph`] || { samples: [], obs: "" }}
                    onChange={val => handleFieldChange(`${sec.id}_ph`, val)}
                    readOnly={ro}
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
                {sec.customComponent === "forage_stock" && (
                  <ForageStockPanel
                    value={formData[`${sec.id}_stock`] || []}
                    onChange={val => handleFieldChange(`${sec.id}_stock`, val)}
                    readOnly={ro}
                    dietItems={[]}
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
            </Card>

            {/* Navegación Anterior / Siguiente — fija abajo (tablet friendly) */}
            <div style={{
              position: "sticky", bottom: 0, zIndex: 30,
              background: "rgba(240,245,251,0.96)", backdropFilter: "blur(6px)",
              borderTop: `1px solid ${C.borderLight}`, margin: "8px -8px 24px", padding: "12px 8px",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            }}>
              <Btn variant="outline" onClick={() => { setWizardStep(s => Math.max(0, s - 1)); window.scrollTo({ top: 0 }); }} disabled={safeStep === 0} style={{ padding: "13px 22px", fontSize: 15 }}>
                ← Anterior
              </Btn>

              {vw === "viewVisit" ? (
                safeStep < totalSteps - 1
                  ? <Btn onClick={() => { setWizardStep(s => s + 1); window.scrollTo({ top: 0 }); }} style={{ padding: "13px 22px", fontSize: 15 }}>Siguiente →</Btn>
                  : <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Btn icon="download" onClick={() => downloadReport(selVisit, "pdf")} style={{ background: C.primary }}>Informe PDF</Btn>
                      <Btn onClick={() => downloadReport(selVisit, "wa")} style={{ background: "#25D366" }}>Enviar por WhatsApp</Btn>
                      <Btn variant="outline" icon="download" onClick={() => downloadReport(selVisit, "html")}>HTML</Btn>
                      <Btn variant="outline" icon="download" onClick={() => downloadReport(selVisit, "txt")}>TXT</Btn>
                      <Btn variant="outline" icon="edit" onClick={() => { setWizardStep(0); setVw("newVisit"); }}>Editar</Btn>
                    </div>
              ) : (
                safeStep < totalSteps - 1
                  ? <Btn onClick={() => { setWizardStep(s => s + 1); window.scrollTo({ top: 0 }); }} style={{ padding: "13px 22px", fontSize: 15 }}>Siguiente →</Btn>
                  : <Btn icon="save" onClick={saveVisit} style={{ background: C.success, padding: "13px 22px", fontSize: 15 }}>Guardar Visita ✓</Btn>
              )}
            </div>

            {/* Plan de acción y seguimiento en último paso */}
            {safeStep === totalSteps - 1 && (
              <>
                {(formData.plan_revision?.length > 0) && (
                  <PlanRevisionPanel
                    value={formData.plan_revision}
                    onChange={val => handleFieldChange("plan_revision", val)}
                    readOnly={vw === "viewVisit"}
                    prevFecha={prevVisit?.fecha}
                  />
                )}
                <PlanAccionPanel
                  value={formData.plan_accion || []}
                  onChange={val => handleFieldChange("plan_accion", val)}
                  readOnly={vw === "viewVisit"}
                  color={selCat.color}
                />
              </>
            )}

            {/* Score Global Preparto en último paso */}
            {selCat?.id === "preparto" && safeStep === totalSteps - 1 && <PrepartoScoreCard data={formData} />}
          </>
        );
      })()}

    </div>
  );

  // ── BRIEFING PRE-VISITA ──
  const Briefing = selClient && (() => {
    const hoy = new Date();
    const fechas = visits.map(v => v.fecha).filter(Boolean).sort();
    const lastFecha = fechas[fechas.length - 1] || null;
    const diasDesde = lastFecha ? Math.floor((hoy - new Date(lastFecha)) / 86400000) : null;
    const freq = parseInt(selClient.frecuencia_dias) || 45;
    const atrasado = diasDesde !== null && diasDesde > freq;

    // Última visita por módulo
    const ultimaPorCat = {};
    visits.forEach(v => {
      const k = v.categoryId || v.category_id;
      if (!ultimaPorCat[k] || (v.fecha || "") > (ultimaPorCat[k].fecha || "")) ultimaPorCat[k] = v;
    });

    // Métricas fuera de rango en la última visita de cada módulo
    const rojos = [];
    METRICS.forEach(m => {
      const v = ultimaPorCat[m.cat];
      if (!v || !m.ref) return;
      const val = m.extract(v);
      if (val === null || isNaN(val)) return;
      if (val < m.ref[0] || val > m.ref[1]) rojos.push({ m, val, fecha: v.fecha });
    });

    // Recomendaciones abiertas y pendientes arrastradas
    const abiertos = [];
    Object.entries(ultimaPorCat).forEach(([catId, v]) => {
      const cat = CATEGORIES.find(c => c.id === catId);
      (v.data?.plan_accion || []).forEach(it => abiertos.push({ texto: it.texto, prioridad: it.prioridad, plazo: it.plazo, cat, tipo: "recomendación" }));
      (v.data?.plan_revision || []).filter(it => it.estado === "pendiente").forEach(it => abiertos.push({ texto: it.texto, prioridad: it.prioridad, cat, tipo: "pendiente anterior" }));
    });
    const orden = { alta: 0, media: 1, baja: 2 };
    abiertos.sort((a, b) => (orden[a.prioridad] ?? 1) - (orden[b.prioridad] ?? 1));

    // Módulos ordenados por antigüedad (los que hace más que no se revisan, primero)
    const modulos = CATEGORIES.map(cat => {
      const v = ultimaPorCat[cat.id];
      const dias = v ? Math.floor((hoy - new Date(v.fecha)) / 86400000) : null;
      return { cat, dias, fecha: v?.fecha || null };
    }).sort((a, b) => (b.dias ?? 99999) - (a.dias ?? 99999));

    return (
      <div style={{ padding: isMobile ? "16px 12px" : "24px 32px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        <Btn variant="ghost" icon="back" size="sm" onClick={() => setVw("clientDetail")} style={{ marginBottom: 16 }}>Volver</Btn>
        <h2 style={{ fontFamily: ffSerif, fontSize: isMobile ? 21 : 26, margin: "0 0 4px", fontWeight: 700 }}>🧭 Preparar visita</h2>
        <p style={{ color: C.textLight, margin: "0 0 20px", fontSize: 15 }}>{selClient.nombre} — {selClient.establecimiento}{selClient.localidad ? ` · ${selClient.localidad}` : ""}</p>

        {/* Estado general */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: "12px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Última visita</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: atrasado ? C.danger : C.text }}>{lastFecha ? `hace ${diasDesde} días` : "nunca"}</div>
            {lastFecha && <div style={{ fontSize: 11, color: C.textLight }}>{fmt(lastFecha)}</div>}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: "12px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Frecuencia acordada</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>cada {freq} días</div>
            {atrasado && <div style={{ fontSize: 11, color: C.danger, fontWeight: 700 }}>⚠ atrasada {diasDesde - freq} días</div>}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: "12px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Para revisar hoy</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: abiertos.length || rojos.length ? C.warning : C.success }}>{abiertos.length + rojos.length} punto{abiertos.length + rojos.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {/* Pendientes del plan */}
        {abiertos.length > 0 && (
          <Card style={{ marginBottom: 16, borderLeft: `4px solid ${C.warning}` }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>📋 Recomendaciones a revisar en el tambo</h4>
            <div style={{ display: "grid", gap: 8 }}>
              {abiertos.map((it, i) => {
                const pr = PRIORIDADES[it.prioridad] || PRIORIDADES.media;
                return (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: C.inputBg, borderRadius: 8, padding: "10px 12px" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: pr.color, borderRadius: 6, padding: "2px 8px", flexShrink: 0, marginTop: 1 }}>{pr.label}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14 }}>{it.texto}</div>
                      <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{it.cat?.name || ""} · {it.tipo}{it.plazo ? ` · plazo: ${it.plazo}` : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Métricas en rojo */}
        {rojos.length > 0 && (
          <Card style={{ marginBottom: 16, borderLeft: `4px solid ${C.danger}` }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>🔴 Fuera de rango en la última visita</h4>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {rojos.map((r, i) => (
                <span key={i} style={{ fontSize: 13, fontWeight: 600, padding: "6px 12px", borderRadius: 99, background: C.danger + "10", color: C.danger, border: `1px solid ${C.danger}30` }}>
                  {r.m.label}: {r.val}{r.m.unit} <span style={{ fontWeight: 400, opacity: 0.8 }}>(obj. {r.m.ref[0]}–{r.m.ref[1]})</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Módulos por antigüedad */}
        <Card style={{ marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>📂 Módulos — tocá para comenzar la visita</h4>
          <div style={{ display: "grid", gap: 8 }}>
            {modulos.map(({ cat, dias, fecha }) => (
              <div key={cat.id} onClick={() => startNewVisit(cat)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.borderLight}`, borderLeft: `4px solid ${cat.color}`, cursor: "pointer", background: C.card }}>
                <Icon name={cat.icon} color={cat.color} size={20} />
                <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{cat.name}</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: dias === null ? C.textLight : dias > freq ? C.danger : C.textLight }}>
                  {dias === null ? "sin visitas" : `hace ${dias} días (${fmt(fecha)})`}
                </span>
                <span style={{ color: cat.color, fontSize: 18 }}>›</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  })();

  // ── INFORMES ── (componente externo, ver debajo de DairyAuditApp)
  const InformesView = (
    <InformesPanel
      clients={clients}
      allVisitsCache={allVisitsCache}
      infoClient={infoClient}
      setInfoClient={setInfoClient}
      infoMetric={infoMetric}
      setInfoMetric={setInfoMetric}
      infoTab={infoTab}
      setInfoTab={setInfoTab}
    />
  );

  // ── PORTAL DEL CLIENTE ──────────────────────────────────────
  const ClientPortal = portalClient && (
    <div style={{ fontFamily: ff, minHeight: "100vh", background: C.bg, color: C.text }}>
      {Toast}

      {/* Header portal */}
      <div style={{
        background: `linear-gradient(90deg, ${C.primaryDark} 0%, ${C.primary} 100%)`,
        color: "#fff", padding: isMobile ? "0 12px" : "0 32px", height: isMobile ? 56 : 62,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 20px rgba(14,46,114,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🐄</div>
          <div>
            <div style={{ fontFamily: ffSerif, fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>Nutrisur</div>
            <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>Portal del Cliente</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.13)", borderRadius: 22, padding: "6px 16px 6px 10px", fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,255,255,0.2)" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
              {(portalClient.nombre || "C")[0].toUpperCase()}
            </div>
            <span>{portalClient.nombre}</span>
          </div>
          <button onClick={handlePortalLogout} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: ff }}>
            <Icon name="logout" size={15} /> Salir
          </button>
        </div>
      </div>

      {/* Contenido del portal */}
      {!portalSelVisit ? (
        // ── Vista: listado de visitas del cliente ──
        <div style={{ padding: isMobile ? "18px 14px" : "32px 36px", maxWidth: 900, margin: "0 auto" }}>
          {/* Info del establecimiento */}
          <Card style={{ marginBottom: 28, background: `linear-gradient(135deg, ${C.primaryDark}08, ${C.primary}05)`, border: `1.5px solid ${C.primary}20` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${C.primary}18, ${C.primaryLight}12)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, border: `1px solid ${C.primary}20`, flexShrink: 0 }}>🏡</div>
              <div>
                <h2 style={{ fontFamily: ffSerif, fontSize: 22, margin: "0 0 4px", color: C.text, fontWeight: 700 }}>{portalClient.establecimiento || portalClient.nombre}</h2>
                <div style={{ fontSize: 14, color: C.textLight, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {portalClient.localidad && <span>📍 {portalClient.localidad}{portalClient.provincia ? `, ${portalClient.provincia}` : ""}</span>}
                  {portalClient.contacto && <span>📞 {portalClient.contacto}</span>}
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.primary }}>{portalVisits.length}</div>
                <div style={{ fontSize: 12, color: C.textLight, fontWeight: 600 }}>visita{portalVisits.length !== 1 ? "s" : ""} registrada{portalVisits.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
          </Card>

          <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: C.text }}>Historial de visitas técnicas</h3>

          {portalVisits.length === 0 ? (
            <Card style={{ textAlign: "center", padding: "50px 40px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>Sin visitas registradas</div>
              <p style={{ color: C.textLight, margin: 0 }}>Las visitas técnicas aparecerán aquí una vez que tu técnico las registre.</p>
            </Card>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {portalVisits.map(v => {
                const cat = CATEGORIES.find(c => c.id === (v.categoryId || v.category_id));
                return (
                  <Card key={v.id} onClick={() => { setPortalSelVisit(v); setPortalSelCat(cat); }} style={{ cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: (cat?.color || C.primary) + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${(cat?.color || C.primary)}30` }}>
                        <Icon name={cat?.icon || "clipboard"} color={cat?.color || C.primary} size={22} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{cat?.name || v.categoryId}</div>
                        <div style={{ fontSize: 13, color: C.textLight, marginTop: 2, display: "flex", gap: 14, flexWrap: "wrap" }}>
                          <span>📅 {fmt(v.fecha)}</span>
                          {v.tecnico && <span>👨‍🔬 {v.tecnico}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Badge color={cat?.color || C.primary}>Ver informe</Badge>
                        <Icon name="compare" color={C.textLight} size={16} />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // ── Vista: detalle de una visita (solo lectura) ──
        <div style={{ padding: isMobile ? "16px 12px" : "24px 36px", maxWidth: 900, margin: "0 auto" }}>
          <button onClick={() => { setPortalSelVisit(null); setPortalSelCat(null); }}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.textLight, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: ff, padding: "6px 0", marginBottom: 20 }}>
            <Icon name="back" size={16} color={C.textLight} /> Volver al historial
          </button>

          {/* Header de la visita */}
          <Card style={{ marginBottom: 20, borderLeft: `4px solid ${portalSelCat?.color || C.primary}` }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: (portalSelCat?.color || C.primary) + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={portalSelCat?.icon || "clipboard"} color={portalSelCat?.color || C.primary} size={26} />
              </div>
              <div>
                <h2 style={{ fontFamily: ffSerif, fontSize: 20, margin: "0 0 4px", fontWeight: 700 }}>{portalSelCat?.name || portalSelVisit.categoryId}</h2>
                <div style={{ fontSize: 13, color: C.textLight, display: "flex", gap: 14 }}>
                  <span>📅 {fmt(portalSelVisit.fecha)}</span>
                  {portalSelVisit.tecnico && <span>👨‍🔬 Técnico: {portalSelVisit.tecnico}</span>}
                </div>
              </div>
            </div>
          </Card>

          {/* Secciones de la visita */}
          {(portalSelCat?.sections || []).map(sec => {
            const secData = portalSelVisit.data || {};
            const hasContent = sec.fields.some(f => secData[f.id]) || sec.customComponent;
            if (!hasContent) return null;
            return (
              <Card key={sec.id} style={{ marginBottom: 14 }}>
                <h4 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: C.text, paddingBottom: 10, borderBottom: `1px solid ${C.borderLight}` }}>{sec.title}</h4>
                {sec.subtitle && <p style={{ fontSize: 13, color: C.textLight, margin: "0 0 12px", fontStyle: "italic" }}>{sec.subtitle}</p>}
                <div style={{ display: "grid", gap: 8 }}>
                  {sec.fields.filter(f => secData[f.id]).map(f => (
                    <div key={f.id} style={{ display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.textLight, minWidth: 180, flexShrink: 0 }}>{f.label}:</span>
                      <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{String(secData[f.id])}{f.unit ? ` ${f.unit}` : ""}</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Si está en portal de cliente, renderizar portal ──
  if (vw === "clientPortal" && portalClient) return ClientPortal;

  const views = { dashboard: Dashboard, clients: ClientList, newClient: NewClient, clientDetail: ClientDetail, startVisit: StartVisit, newVisit: VisitForm, viewVisit: VisitForm, informes: InformesView, briefing: Briefing };

return (
  <div style={{ fontFamily: ff, minHeight: "100vh", background: C.bg, color: C.text }}>
    {Toast}
    {Header}
    <div style={{ minHeight: "calc(100vh - 62px)" }}>
      {views[vw]}
    </div>
  </div>
)}
