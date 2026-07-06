// ═══════════════════════════════════════════════════
// NUTRISUR — Informe de visita en PDF (jsPDF)
// Se carga con import() dinámico para no engordar el bundle inicial.
// ═══════════════════════════════════════════════════
import { jsPDF } from "jspdf";

const fmt = (d) => { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// Colores de marca (RGB)
const COL = {
  primary: [26, 79, 186],
  primaryDark: [14, 46, 114],
  text: [13, 31, 56],
  textLight: [91, 109, 138],
  success: [13, 125, 71],
  warning: [204, 138, 0],
  danger: [196, 43, 43],
  borderLight: [220, 232, 245],
  bgSoft: [240, 245, 251],
  white: [255, 255, 255],
};

// Rangos objetivo de los scores por vaca (mismos que usa la app)
const SCORE_TARGETS = {
  bcs: { nombre: "BCS (Condición Corporal)", target: [3.0, 3.5] },
  heces: { nombre: "Score de Heces", target: [3.0, 3.5] },
  rumen: { nombre: "Llenado Ruminal", target: [3.5, 4.5] },
};

const hexToRgb = (hex) => {
  const h = (hex || "#1A4FBA").replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

// ───────────────────────────────────────────────────
// Motor de layout: cursor vertical + saltos de página
// ───────────────────────────────────────────────────
function makeRenderer(doc) {
  const W = doc.internal.pageSize.getWidth();   // 210
  const H = doc.internal.pageSize.getHeight();  // 297
  const M = 14;                                  // margen
  const bodyW = W - M * 2;
  let y = M;

  const ensure = (h) => {
    if (y + h > H - 18) { doc.addPage(); y = M + 4; }
  };

  const setFont = (size, style = "normal", color = COL.text) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const dot = (x, yy, color) => {
    doc.setFillColor(...color);
    doc.circle(x, yy, 1.4, "F");
  };

  return {
    get y() { return y; },
    set y(v) { y = v; },
    W, H, M, bodyW, ensure, setFont, dot,

    gap(h = 3) { y += h; },

    hr(color = COL.borderLight) {
      ensure(3);
      doc.setDrawColor(...color); doc.setLineWidth(0.3);
      doc.line(M, y, W - M, y); y += 3;
    },

    // Encabezado de sección con barra de color
    sectionHeader(title, subtitle, hexColor) {
      ensure(14);
      const rgb = hexToRgb(hexColor);
      doc.setFillColor(...rgb);
      doc.rect(M, y, 1.8, subtitle ? 10 : 7, "F");
      setFont(11.5, "bold");
      doc.text(title, M + 4.5, y + 4.6);
      if (subtitle) {
        setFont(8.5, "normal", COL.textLight);
        doc.text(doc.splitTextToSize(subtitle, bodyW - 6), M + 4.5, y + 9);
      }
      y += (subtitle ? 12 : 9);
    },

    // Fila etiqueta: valor (con semáforo y delta opcionales)
    kv(label, value, opts = {}) {
      const lines = doc.splitTextToSize(String(value), bodyW - 62);
      const h = Math.max(5, lines.length * 4.2 + 1);
      ensure(h);
      setFont(9, "normal", COL.textLight);
      doc.text(label + ":", M + (opts.dotColor ? 4 : 0), y + 3.5);
      if (opts.dotColor) dot(M + 1.4, y + 2.3, opts.dotColor);
      setFont(9, "bold");
      doc.text(lines, M + 62, y + 3.5);
      if (opts.delta) {
        const dx = M + 62 + doc.getTextWidth(lines[0]) + 3;
        setFont(8, "bold", opts.delta.color);
        doc.text(opts.delta.txt, dx, y + 3.5);
      }
      y += h;
    },

    // Párrafo (observaciones, hallazgos)
    para(label, text) {
      const lines = doc.splitTextToSize(String(text), bodyW - 4);
      ensure(6 + lines.length * 4.2);
      setFont(9, "bold", COL.textLight);
      doc.text(label + ":", M, y + 3.5); y += 5.5;
      setFont(9, "normal");
      doc.text(lines, M + 2, y + 3); y += lines.length * 4.2 + 2;
    },

    // Tabla simple con encabezado
    table(headers, rows, widths, opts = {}) {
      const aligns = opts.aligns || headers.map(() => "left");
      const rowH = 5.4;
      const xs = []; let acc = M;
      widths.forEach(w => { xs.push(acc); acc += w; });

      const drawHeader = () => {
        doc.setFillColor(...COL.bgSoft);
        doc.rect(M, y, widths.reduce((a, b) => a + b, 0), rowH, "F");
        setFont(8, "bold", COL.primaryDark);
        headers.forEach((htxt, i) => {
          const tx = aligns[i] === "right" ? xs[i] + widths[i] - 2 : aligns[i] === "center" ? xs[i] + widths[i] / 2 : xs[i] + 2;
          doc.text(String(htxt), tx, y + 3.7, { align: aligns[i] === "left" ? undefined : aligns[i] });
        });
        y += rowH;
      };

      ensure(rowH * 2); drawHeader();
      rows.forEach((r, ri) => {
        if (y + rowH > H - 18) { doc.addPage(); y = M + 4; drawHeader(); }
        if (ri % 2 === 1) { doc.setFillColor(250, 251, 254); doc.rect(M, y, widths.reduce((a, b) => a + b, 0), rowH, "F"); }
        r.forEach((cell, i) => {
          const isObj = cell && typeof cell === "object";
          const txt = String(isObj ? cell.v : (cell ?? "—"));
          setFont(8, isObj && cell.bold ? "bold" : "normal", isObj && cell.color ? cell.color : COL.text);
          const tx = aligns[i] === "right" ? xs[i] + widths[i] - 2 : aligns[i] === "center" ? xs[i] + widths[i] / 2 : xs[i] + 2;
          doc.text(txt.length > 40 ? txt.slice(0, 40) + "…" : txt, tx, y + 3.7, { align: aligns[i] === "left" ? undefined : aligns[i] });
        });
        doc.setDrawColor(...COL.borderLight); doc.setLineWidth(0.15);
        doc.line(M, y + rowH, M + widths.reduce((a, b) => a + b, 0), y + rowH);
        y += rowH;
      });
      y += 2;
    },
  };
}

// ───────────────────────────────────────────────────
// Semáforo según rango objetivo
// ───────────────────────────────────────────────────
const trafficColor = (val, [lo, hi], tolerance = 0.25) => {
  if (val >= lo && val <= hi) return COL.success;
  if (val >= lo - tolerance && val <= hi + tolerance) return COL.warning;
  return COL.danger;
};

// Delta vs. visita anterior para un valor numérico
const deltaInfo = (curr, prevData, fieldId, unit) => {
  if (!prevData) return null;
  const p = parseFloat(prevData[fieldId]);
  const c = parseFloat(curr);
  if (isNaN(p) || isNaN(c) || p === c) return null;
  const d = round(c - p, 2);
  return { txt: `(${d > 0 ? "+" : ""}${d}${unit ? " " + unit : ""} vs. visita ant.)`, color: COL.textLight };
};

// ───────────────────────────────────────────────────
// KPIs para el resumen ejecutivo (con semáforo)
// ───────────────────────────────────────────────────
function collectKpis(d, category) {
  const kpis = [];
  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;

  category.sections.forEach(sec => {
    // Scores por vaca
    if (sec.customComponent?.startsWith("cowscore_")) {
      const type = sec.customComponent.replace("cowscore_", "");
      const cfg = SCORE_TARGETS[type];
      const cows = d[`${sec.id}_cowscore`]?.cows || [];
      const scores = cows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
      if (scores.length && cfg) {
        const a = round(avg(scores), 2);
        kpis.push({
          label: cfg.nombre,
          value: `${a}  (objetivo ${cfg.target[0]}–${cfg.target[1]}, n=${scores.length})`,
          color: trafficColor(a, cfg.target),
        });
      }
    }
    // Cetosis
    if (sec.customComponent === "ketosis") {
      const cows = d[`${sec.id}_ketosis`]?.cows || [];
      if (cows.length) {
        const prev = round(cows.filter(c => c.positivo).length / cows.length * 100, 1);
        kpis.push({
          label: "Prevalencia de cetosis",
          value: `${prev}%  (n=${cows.length}, alerta >15%)`,
          color: prev <= 15 ? COL.success : prev <= 25 ? COL.warning : COL.danger,
        });
      }
    }
    // Reserva forrajera mínima
    if (sec.customComponent === "ingredients" || sec.customComponent === "forage_stock") {
      const stock = d[`${sec.id}_stock`] || [];
      const dias = stock.map(l => {
        const sTC = parseFloat(l.stock_kg_tc) || 0;
        const consumo = parseFloat(l.consumo_kg_tc) || 0;
        const vacas = parseFloat(l.vacas) || 1;
        return consumo > 0 ? Math.floor(sTC / (consumo * vacas)) : null;
      }).filter(v => v !== null);
      if (dias.length) {
        const min = Math.min(...dias);
        const worst = stock.find((l, i) => dias[i] === min);
        kpis.push({
          label: "Reserva forrajera mínima",
          value: `${min} días${worst?.name ? ` (${worst.name})` : ""}`,
          color: min > 30 ? COL.success : min >= 15 ? COL.warning : COL.danger,
        });
      }
    }
  });

  // pH de orina (preparto)
  const phSamples = d.ph_ph?.samples || [];
  if (phSamples.length) {
    const vals = phSamples.map(s => parseFloat(s.ph)).filter(v => !isNaN(v));
    if (vals.length) {
      const a = round(avg(vals), 2);
      kpis.push({
        label: "pH de orina promedio",
        value: `${a}  (objetivo 6.0–7.0, n=${vals.length})`,
        color: a >= 6.0 && a <= 7.0 ? COL.success : a >= 5.8 ? COL.warning : COL.danger,
      });
    }
  }

  return kpis;
}

// ───────────────────────────────────────────────────
// Generador principal
// ───────────────────────────────────────────────────
export function buildVisitPdf({ visit, client, category, prevVisit, globalScore }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const R = makeRenderer(doc);
  const d = visit.data || {};
  const pd = prevVisit?.data || null;
  const catRgb = hexToRgb(category.color);

  // ── Encabezado de marca ──
  doc.setFillColor(...COL.primary);
  doc.rect(0, 0, R.W, 26, "F");
  doc.setFillColor(...COL.primaryDark);
  doc.rect(0, 26, R.W, 1.5, "F");
  R.setFont(19, "bold", COL.white);
  doc.text("NUTRISUR", R.M, 11);
  R.setFont(9.5, "normal", [200, 218, 255]);
  doc.text("Informe de visita técnica · Nutrición y auditoría de tambos", R.M, 17.5);
  R.setFont(12, "bold", COL.white);
  doc.text(category.name, R.W - R.M, 11, { align: "right" });
  R.setFont(9.5, "normal", [200, 218, 255]);
  doc.text(fmt(visit.fecha), R.W - R.M, 17.5, { align: "right" });
  R.y = 33;

  // ── Datos del cliente ──
  doc.setFillColor(...COL.bgSoft);
  doc.roundedRect(R.M, R.y, R.bodyW, 17, 2, 2, "F");
  R.setFont(11, "bold");
  doc.text(client.establecimiento || "-", R.M + 5, R.y + 6.5);
  R.setFont(8.5, "normal", COL.textLight);
  const info2 = [
    `Responsable: ${client.nombre || "-"}`,
    client.localidad || client.provincia ? `${client.localidad || ""}${client.localidad && client.provincia ? ", " : ""}${client.provincia || ""}` : null,
    client.sistema_productivo ? `Sistema: ${client.sistema_productivo}` : null,
    `Técnico: ${visit.tecnico || "-"}`,
  ].filter(Boolean).join("   ·   ");
  doc.text(info2, R.M + 5, R.y + 12.5);
  R.y += 21;

  // ── Score global (preparto) ──
  if (globalScore != null) {
    const sc = globalScore >= 80 ? COL.success : globalScore >= 60 ? COL.warning : COL.danger;
    const lbl = globalScore >= 80 ? "Buen estado" : globalScore >= 60 ? "Atención requerida" : "Crítico";
    doc.setFillColor(sc[0], sc[1], sc[2]);
    doc.roundedRect(R.M, R.y, R.bodyW, 12, 2, 2, "F");
    R.setFont(13, "bold", COL.white);
    doc.text(`Score global: ${globalScore}/100`, R.M + 5, R.y + 7.8);
    R.setFont(10, "bold", COL.white);
    doc.text(lbl, R.W - R.M - 5, R.y + 7.8, { align: "right" });
    R.y += 16;
  }

  if (prevVisit) {
    R.setFont(8, "italic", COL.textLight);
    doc.text(`Comparado con la visita anterior del ${fmt(prevVisit.fecha)}.`, R.M, R.y + 2);
    R.y += 6;
  }

  // ═══════════════════════════════════════════════
  // RESUMEN EJECUTIVO
  // ═══════════════════════════════════════════════
  const kpis = collectKpis(d, category);
  const plan = Array.isArray(d.plan_accion) ? d.plan_accion : [];
  const revision = Array.isArray(d.plan_revision) ? d.plan_revision : [];
  const hallazgoKey = ["hallazgos_principales", "fr_hallazgos", "cama_hallazgos", "ali_hallazgos", "ec_hallazgos"].find(k => d[k]);

  if (kpis.length || plan.length || revision.length || hallazgoKey) {
    R.gap(2);
    R.sectionHeader("Resumen ejecutivo", null, "#1A4FBA");

    // Indicadores clave con semáforo
    if (kpis.length) {
      kpis.forEach(k => R.kv(k.label, k.value, { dotColor: k.color, delta: k.delta ? { txt: k.delta, color: COL.textLight } : null }));
      R.gap(2);
    }

    // Hallazgos principales
    if (hallazgoKey) R.para("Hallazgos principales", d[hallazgoKey]);

    // Seguimiento del plan anterior
    if (revision.length) {
      const counts = { cumplida: 0, parcial: 0, pendiente: 0 };
      revision.forEach(it => { counts[it.estado] = (counts[it.estado] || 0) + 1; });
      R.ensure(7);
      R.setFont(9.5, "bold", COL.primaryDark);
      doc.text("Seguimiento del plan anterior", R.M, R.y + 3.5); R.y += 6;
      R.kv("Cumplimiento", `${counts.cumplida} cumplidas · ${counts.parcial} parciales · ${counts.pendiente} pendientes`, {
        dotColor: counts.pendiente === 0 ? COL.success : counts.cumplida + counts.parcial >= counts.pendiente ? COL.warning : COL.danger,
      });
      const estadoCol = { cumplida: COL.success, parcial: COL.warning, pendiente: COL.danger };
      const estadoTxt = { cumplida: "CUMPLIDA", parcial: "PARCIAL", pendiente: "PENDIENTE" };
      revision.forEach(it => {
        const lines = doc.splitTextToSize(it.texto || "", R.bodyW - 30);
        R.ensure(lines.length * 4 + 2.5);
        R.setFont(8, "bold", estadoCol[it.estado] || COL.textLight);
        doc.text(estadoTxt[it.estado] || "—", R.M + 2, R.y + 3.2);
        R.setFont(8.5, "normal");
        doc.text(lines, R.M + 26, R.y + 3.2);
        R.y += lines.length * 4 + 1.5;
      });
      R.gap(2);
    }

    // Plan de acción de esta visita
    if (plan.length) {
      R.ensure(7);
      R.setFont(9.5, "bold", COL.primaryDark);
      doc.text("Plan de acción", R.M, R.y + 3.5); R.y += 6;
      const prCol = { alta: COL.danger, media: COL.warning, baja: COL.success };
      const prTxt = { alta: "ALTA", media: "MEDIA", baja: "BAJA" };
      const orden = { alta: 0, media: 1, baja: 2 };
      [...plan].sort((a, b) => (orden[a.prioridad] ?? 1) - (orden[b.prioridad] ?? 1)).forEach((it, i) => {
        const txt = `${i + 1}. ${it.texto || ""}${it.plazo ? `  (plazo: ${it.plazo})` : ""}`;
        const lines = doc.splitTextToSize(txt, R.bodyW - 20);
        R.ensure(lines.length * 4 + 2.5);
        R.setFont(8, "bold", prCol[it.prioridad] || COL.warning);
        doc.text(prTxt[it.prioridad] || "MEDIA", R.M + 2, R.y + 3.2);
        R.setFont(8.5, "normal");
        doc.text(lines, R.M + 16, R.y + 3.2);
        R.y += lines.length * 4 + 1.5;
      });
    }

    R.gap(2);
    R.hr();
    R.setFont(8, "italic", COL.textLight);
    R.ensure(5);
    doc.text("Detalle completo de la visita a continuación.", R.M, R.y + 2.5);
    R.y += 6;
  }

  // ── Secciones ──
  category.sections.forEach(sec => {
    // ¿Tiene contenido?
    const hasFields = sec.fields.some(f => d[f.id]);
    const hasCustom = sec.customComponent && Object.keys(d).some(k => k.startsWith(sec.id + "_"));
    if (!hasFields && !hasCustom) return;

    R.gap(2);
    R.sectionHeader(sec.title, sec.subtitle, category.color);

    // ── Custom: Ingredientes / mezcla ──
    if (sec.customComponent === "ingredients") {
      const ings = d[`${sec.id}_ingredients`] || [];
      if (ings.length) {
        const totalTC = round(ings.reduce((s, i) => s + (parseFloat(i.kg_tal_cual) || 0), 0), 1);
        const totalMS = round(ings.reduce((s, i) => s + (parseFloat(i.kg_ms) || 0), 0), 1);
        R.table(
          ["Ingrediente", "kg TC", "% MS", "kg MS"],
          [
            ...ings.map(i => [i.name || "—", i.kg_tal_cual || "—", i.ms_pct ? i.ms_pct + "%" : "—", i.kg_ms || "—"]),
            [{ v: "TOTAL", bold: true }, { v: String(totalTC), bold: true }, { v: totalTC > 0 ? round(totalMS / totalTC * 100, 1) + "%" : "—", bold: true }, { v: String(totalMS), bold: true }],
          ],
          [92, 30, 30, 30], { aligns: ["left", "right", "center", "right"] }
        );
      }
      const mix = d[`${sec.id}_mix`];
      if (mix?.loadOrder) R.kv("Orden de carga", mix.loadOrder);
      if (mix?.mixTime) R.kv("Tiempo de mezclado", `${mix.mixTime} min`);
      if (mix?.bladesCond) R.kv("Estado de cuchillas", mix.bladesCond);
    }

    // ── Custom: stock de forrajes (en ingredients y forage_stock) ──
    if (sec.customComponent === "ingredients" || sec.customComponent === "forage_stock") {
      const stock = d[`${sec.id}_stock`] || [];
      if (stock.length) {
        R.setFont(9, "bold", COL.primaryDark);
        R.ensure(6); doc.text("Inventario de forrajes / reservas", R.M, R.y + 3.5); R.y += 6;
        R.table(
          ["Forraje", "Lote", "Stock kg TC", "kg MS", "Días"],
          stock.map(l => {
            const sTC = parseFloat(l.stock_kg_tc) || 0;
            const kgMS = parseFloat(l.ms_pct) > 0 ? round(sTC * parseFloat(l.ms_pct) / 100, 0) : null;
            const consumo = parseFloat(l.consumo_kg_tc) || 0;
            const vacas = parseFloat(l.vacas) || 1;
            const dias = consumo > 0 ? Math.floor(sTC / (consumo * vacas)) : null;
            const diasCol = dias === null ? COL.textLight : dias > 30 ? COL.success : dias >= 15 ? COL.warning : COL.danger;
            return [
              l.name || "—", l.lot || "—",
              sTC ? sTC.toLocaleString("es-UY") : "—",
              kgMS !== null ? kgMS.toLocaleString("es-UY") : "—",
              { v: dias !== null ? dias + " d" : "—", color: diasCol, bold: true },
            ];
          }),
          [62, 40, 30, 26, 24], { aligns: ["left", "left", "right", "right", "center"] }
        );
      }
    }

    // ── Custom: Penn State ──
    if (sec.customComponent === "pennstate") {
      const ps = d[`${sec.id}_pennstate`];
      if (ps) {
        const labels = { sup: "Superior (>19mm)", med: "Media (8-19mm)", inf: "Inferior (1.18-8mm)", fondo: "Fondo (<1.18mm)" };
        R.table(
          ["Bandeja", "Inicio", "Medio", "Final", "Prom.", "CV"],
          ["sup", "med", "inf", "fondo"].map(t => [
            labels[t],
            ps[`${t}_inicio`] ? ps[`${t}_inicio`] + "%" : "—",
            ps[`${t}_medio`] ? ps[`${t}_medio`] + "%" : "—",
            ps[`${t}_final`] ? ps[`${t}_final`] + "%" : "—",
            { v: ps[`${t}_avg`] ? ps[`${t}_avg`] + "%" : "—", bold: true },
            ps[`${t}_cv`] ? ps[`${t}_cv`] + "%" : "—",
          ]),
          [56, 25, 25, 25, 26, 25], { aligns: ["left", "center", "center", "center", "center", "center"] }
        );
        if (ps.sorting) R.kv("Sorting (selección)", ps.sorting);
        if (ps.obs) R.para("Observaciones", ps.obs);
      }
    }

    // ── Custom: scores por vaca (BCS / heces / rumen) ──
    if (sec.customComponent?.startsWith("cowscore_")) {
      const type = sec.customComponent.replace("cowscore_", "");
      const data = d[`${sec.id}_cowscore`];
      const cfg = SCORE_TARGETS[type];
      if (data?.cows?.length) {
        const scores = data.cows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
        const n = scores.length;
        if (n > 0) {
          const avg = round(scores.reduce((s, v) => s + v, 0) / n, 2);
          const enObj = cfg ? scores.filter(v => v >= cfg.target[0] && v <= cfg.target[1]).length : null;
          R.kv("Animales evaluados", String(n));
          R.kv("Promedio", `${avg}${cfg ? `  (objetivo ${cfg.target[0]}–${cfg.target[1]})` : ""}`, {
            dotColor: cfg ? trafficColor(avg, cfg.target) : undefined,
            delta: pd ? (() => {
              const prevCows = pd[`${sec.id}_cowscore`]?.cows || [];
              const pv = prevCows.map(c => parseFloat(c.score)).filter(v => !isNaN(v));
              if (!pv.length) return null;
              const pavg = round(pv.reduce((s, v) => s + v, 0) / pv.length, 2);
              if (pavg === avg) return null;
              return { txt: `(${avg - pavg > 0 ? "+" : ""}${round(avg - pavg, 2)} vs. visita ant.)`, color: COL.textLight };
            })() : null,
          });
          R.kv("Rango", `${Math.min(...scores)} – ${Math.max(...scores)}`);
          if (enObj !== null) R.kv("Dentro de objetivo", `${enObj} de ${n} (${round(enObj / n * 100, 0)}%)`);
          R.table(
            ["Caravana", "Score", "Nota"],
            data.cows.map(c => {
              const sv = parseFloat(c.score);
              return [
                c.caravana || "s/id",
                { v: c.score || "—", bold: true, color: cfg && !isNaN(sv) ? trafficColor(sv, cfg.target) : COL.text },
                c.nota || "",
              ];
            }),
            [45, 25, 112], { aligns: ["left", "center", "left"] }
          );
        }
        if (data.obs) R.para("Observaciones", data.obs);
      }
    }

    // ── Custom: cetosis ──
    if (sec.customComponent === "ketosis") {
      const k = d[`${sec.id}_ketosis`];
      if (k?.cows?.length) {
        const pos = k.cows.filter(c => c.positivo).length;
        const prev = round(pos / k.cows.length * 100, 1);
        R.kv("Testeadas / positivas", `${k.cows.length} / ${pos}  (prevalencia ${prev}%)`, {
          dotColor: prev <= 10 ? COL.success : prev <= 20 ? COL.warning : COL.danger,
        });
        R.table(
          ["Caravana", "DIM", "Método", "Resultado", "+/-", "Nota"],
          k.cows.map(c => [c.caravana || "s/id", c.dim || "—", c.metodo || "—", c.resultado || "—",
            { v: c.positivo ? "POS" : "neg", color: c.positivo ? COL.danger : COL.success, bold: true }, c.nota || ""]),
          [35, 18, 30, 30, 18, 51], { aligns: ["left", "center", "left", "left", "center", "left"] }
        );
        if (k.obs) R.para("Protocolo", k.obs);
      }
    }

    // ── Custom: enfermedades de transición ──
    if (sec.customComponent === "diseases") {
      const dis = d[`${sec.id}_diseases`];
      if (dis) {
        if (dis.paridas_ventana) R.kv("Paridas en ventana", `${dis.paridas_ventana}${dis.periodo_dias ? ` (período ${dis.periodo_dias} días)` : ""}`);
        const names = { da: "Desplaz. abomaso", hipocalcemia: "Hipocalcemia", rp: "Retención placenta", metritis: "Metritis", cetosis_cl: "Cetosis clínica", mastitis: "Mastitis", neumonia: "Neumonía", cojera: "Cojera" };
        const rows = Object.keys(names)
          .filter(k => dis[`${k}_casos`])
          .map(k => [names[k], dis[`${k}_casos`], dis[`${k}_incidencia`] ? dis[`${k}_incidencia`] + "%" : "—", dis[`${k}_reincid`] || "0", dis[`${k}_protocolo`] || ""]);
        if (rows.length) R.table(["Patología", "Casos", "Incidencia", "Reincid.", "Protocolo"], rows, [45, 20, 26, 22, 69], { aligns: ["left", "center", "center", "center", "left"] });
        if (dis.mortalidad) R.kv("Mortalidad", dis.mortalidad);
        if (dis.descartes) R.kv("Descartes", dis.descartes);
        if (dis.dias_1ia) R.kv("Días a 1ª IA", dis.dias_1ia);
        if (dis.obs_salud) R.para("Observaciones", dis.obs_salud);
      }
    }

    // ── Custom: evaluación de cama ──
    if (sec.customComponent === "bedding") {
      const b = d[`${sec.id}_bedding`];
      if (b?.points?.length) {
        R.table(
          ["#", "Ubicación", "T° sup", "T° prof", "Hum. sup", "Hum. prof", "Prof. cm"],
          b.points.map(p => [p.num, p.ubicacion || "—", p.temp_sup || "—", p.temp_prof || "—", p.hum_sup || "—", p.hum_prof || "—", p.profundidad || "—"]),
          [12, 52, 22, 22, 26, 26, 22], { aligns: ["center", "left", "center", "center", "center", "center", "center"] }
        );
        if (b.obs) R.para("Observaciones", b.obs);
      }
    }

    // ── Custom: limpieza (ubre/patas/flanco) ──
    if (sec.customComponent === "cleanliness") {
      const c = d[`${sec.id}_cleanliness`];
      if (c?.cows?.length) {
        R.kv("Animales evaluados", String(c.cows.length));
        R.table(
          ["Caravana", "Ubre", "Patas", "Flanco"],
          c.cows.map(cw => [cw.caravana || cw.num || "s/id", cw.ubre || "—", cw.patas || "—", cw.flanco || "—"]),
          [55, 42, 42, 43], { aligns: ["left", "center", "center", "center"] }
        );
        if (c.obs) R.para("Observaciones", c.obs);
      }
    }

    // ── Custom: procesado de grano ──
    if (sec.customComponent === "grain") {
      const g = d[`${sec.id}_grain`];
      if (g?.total_g) {
        const rows = ["t1", "t2", "t3", "t4", "t5"].filter(t => g[t]).map(t => [`Tamiz ${t.slice(1)}`, g[t] + " g", g[`${t}_pct`] ? g[`${t}_pct`] + "%" : "—"]);
        if (rows.length) R.table(["Tamiz", "Peso", "%"], rows, [60, 60, 62], { aligns: ["left", "right", "center"] });
        if (g.pct_rotos) R.kv("% granos rotos", g.pct_rotos + "%");
        if (g.mps) R.kv("MPS estimado", `~${g.mps} μ`);
        if (g.obs) R.para("Observaciones", g.obs);
      }
    }

    // ── Campos comunes ──
    sec.fields.forEach(f => {
      const val = d[f.id];
      if (!val) return;
      const txt = String(val);
      if (f.type === "textarea" || txt.length > 90) {
        R.para(f.label, txt);
      } else {
        R.kv(f.label, `${txt}${f.unit ? ` ${f.unit}` : ""}`, {
          delta: f.type === "number" ? deltaInfo(val, pd, f.id, f.unit) : null,
        });
      }
    });
  });

  // ── Pie de página en todas las páginas ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COL.borderLight); doc.setLineWidth(0.3);
    doc.line(R.M, R.H - 12, R.W - R.M, R.H - 12);
    R.setFont(7.5, "normal", COL.textLight);
    doc.text(`NutriSur · ${client.establecimiento || ""} · ${category.name} · ${fmt(visit.fecha)}`, R.M, R.H - 7.5);
    doc.text(`Página ${i} de ${pages}`, R.W - R.M, R.H - 7.5, { align: "right" });
    // franja de color de la categoría
    doc.setFillColor(...catRgb);
    doc.rect(0, R.H - 3, R.W, 3, "F");
  }

  return doc;
}

const pdfFileName = (client, category, visit) =>
  `NutriSur_${client.nombre}_${category.name}_${visit.fecha || "sin-fecha"}`.replace(/\s+/g, "_") + ".pdf";

export function downloadVisitPdf(args) {
  const doc = buildVisitPdf(args);
  doc.save(pdfFileName(args.client, args.category, args.visit));
}

// Compartir por WhatsApp: en el celular abre el menú de compartir con el PDF
// adjunto; en escritorio descarga el PDF y abre WhatsApp Web con el mensaje.
export async function shareVisitPdfWhatsApp(args) {
  const doc = buildVisitPdf(args);
  const { client, category, visit } = args;
  const filename = pdfFileName(client, category, visit);
  const texto = `Informe de visita — ${category.name}\n${client.establecimiento} · ${fmt(visit.fecha)}\nNutriSur`;
  const blob = doc.output("blob");

  try {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: texto });
      return "shared";
    }
  } catch (e) {
    if (e?.name === "AbortError") return "cancelled"; // el usuario cerró el menú
  }

  // Fallback (escritorio): descargar y abrir WhatsApp Web
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  window.open(`https://wa.me/?text=${encodeURIComponent(texto + "\n(Adjuntá el PDF que se acaba de descargar)")}`, "_blank");
  return "downloaded";
}
