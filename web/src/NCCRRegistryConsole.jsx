import React, { useMemo, useState } from "react";

/* ============================== helpers ============================== */

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mixHex(hexA, hexB, t) {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `rgb(${r},${g},${b})`;
}
// Vegetation-index convention: bare soil (brown) -> stressed (yellow) -> dense canopy (green)
function ndviColor(v) {
  if (v < 0.4) return mixHex("#8A6A3F", "#D9C14A", v / 0.4);
  return mixHex("#D9C14A", "#2C5A36", (v - 0.4) / 0.6);
}
function makeRaster(seed, bias, cols = 18, rows = 10) {
  let s = seed || 1;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const cells = [];
  for (let i = 0; i < cols * rows; i++) {
    let v = bias + (rand() - 0.5) * 0.5 + (rand() - 0.5) * 0.2;
    v = Math.max(0, Math.min(1, v));
    cells.push(v);
  }
  return cells;
}
function sparkPoints(data, w, h, pad) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  return data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * (h - pad * 2) - pad;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % 100000;
}
function scoreColor(score) {
  if (score < 40) return "var(--oxblood)";
  if (score < 70) return "var(--brass-text)";
  return "var(--verdant)";
}
function inr(n) {
  return n.toLocaleString("en-IN");
}
function getBreakdown(sub) {
  const weights = [
    ["NDVI Growth Delta", 40],
    ["Geolocation Match", 25],
    ["Document Consistency", 20],
    ["Historical Baseline", 15],
  ];
  if (sub.flagged) {
    const ndviMax = weights[0][1];
    const ndvi = Math.round(ndviMax * (sub.score < 30 ? 0.1 : 0.25));
    const remaining = Math.max(0, sub.score - ndvi);
    const restWeight = weights[1][1] + weights[2][1] + weights[3][1];
    return [
      { label: weights[0][0], max: weights[0][1], score: ndvi },
      { label: weights[1][0], max: weights[1][1], score: Math.round((remaining * weights[1][1]) / restWeight) },
      { label: weights[2][0], max: weights[2][1], score: Math.round((remaining * weights[2][1]) / restWeight) },
      { label: weights[3][0], max: weights[3][1], score: Math.round((remaining * weights[3][1]) / restWeight) },
    ];
  }
  return weights.map(([label, max]) => ({ label, max, score: Math.round(max * (sub.score / 100)) }));
}

/* ============================== data ============================== */

const SECTIONS = [
  { id: 1, label: "Command Center" },
  { id: 2, label: "Review Queue" },
  { id: 3, label: "Submission Detail" },
  { id: 4, label: "Dispute Management" },
  { id: 5, label: "Rules & Thresholds" },
  { id: 6, label: "Audit Trail" },
];

const SUBMISSIONS = [
  { id: "NCCR-24-4459", project: "Chotanagpur Bamboo Corridor", region: "Jharkhand", type: "Bamboo Plantation", submitted: "17 Aug 2026", score: 19, flagged: true, x: 59.7, y: 43.2, coord: "23.34°N 85.31°E" },
  { id: "NCCR-24-4468", project: "Sundarbans Mangrove Block 7", region: "West Bengal", type: "Blue Carbon", submitted: "20 Aug 2026", score: 34, flagged: true, x: 70.2, y: 46.0, coord: "22.57°N 88.36°E" },
  { id: "NCCR-24-4473", project: "Vindhya Dry Forest Reclaim", region: "Madhya Pradesh", type: "Afforestation", submitted: "22 Aug 2026", score: 47, flagged: true, x: 32.4, y: 43.5, coord: "23.25°N 77.40°E" },
  { id: "NCCR-24-4451", project: "Kutch Mangrove Revival", region: "Gujarat", type: "Blue Carbon", submitted: "14 Aug 2026", score: 57, flagged: false, x: 6.4, y: 41.7, coord: "23.73°N 69.86°E" },
  { id: "NCCR-24-4462", project: "Aravalli Greenbelt Phase II", region: "Rajasthan", type: "Afforestation", submitted: "18 Aug 2026", score: 65, flagged: false, x: 26.9, y: 30.0, coord: "26.90°N 75.80°E" },
  { id: "NCCR-24-4465", project: "Deccan Silvopasture Cluster", region: "Karnataka", type: "Agroforestry", submitted: "19 Aug 2026", score: 78, flagged: false, x: 33.1, y: 81.6, coord: "12.97°N 77.59°E" },
  { id: "NCCR-24-4455", project: "Western Ghats Buffer Restoration", region: "Kerala", type: "Afforestation", submitted: "15 Aug 2026", score: 88, flagged: false, x: 28.5, y: 92.9, coord: "9.93°N 76.26°E" },
  { id: "NCCR-24-4471", project: "Nilgiri Shola Restoration", region: "Tamil Nadu", type: "Afforestation", submitted: "21 Aug 2026", score: 91, flagged: false, x: 30.0, y: 87.4, coord: "11.41°N 76.70°E" },
  { id: "NCCR-24-4447", project: "Coromandel Coastal Shelterbelt", region: "Tamil Nadu", type: "Blue Carbon", submitted: "12 Aug 2026", score: 95, flagged: false, x: 40.8, y: 89.8, coord: "10.76°N 79.84°E" },
];

const ACTIVITY = [
  { time: "11:04", kind: "approve", text: "NCCR-24-4471 approved \u2014 Nilgiri Shola Restoration, +2,140 t issued" },
  { time: "10:47", kind: "flag", text: "NCCR-24-4468 flagged \u2014 NDVI growth delta below threshold" },
  { time: "10:21", kind: "dispute", text: "Dispute opened on NCCR-24-4459 \u2014 Chotanagpur Bamboo Corridor" },
  { time: "09:58", kind: "approve", text: "NCCR-24-4455 approved \u2014 Western Ghats Buffer Restoration, +3,860 t issued" },
  { time: "09:30", kind: "submit", text: "NCCR-24-4447 submitted \u2014 Coromandel Coastal Shelterbelt" },
  { time: "09:12", kind: "flag", text: "NCCR-24-4473 flagged \u2014 geolocation mismatch" },
];

const HISTOGRAM = [
  { label: "0\u201320", pct: 10, color: "var(--oxblood)" },
  { label: "21\u201340", pct: 22, color: "var(--oxblood)" },
  { label: "41\u201360", pct: 38, color: "var(--brass-text)" },
  { label: "61\u201380", pct: 72, color: "var(--verdant)" },
  { label: "81\u2013100", pct: 100, color: "var(--verdant-deep)" },
];

const SPARK = [2.1, 2.4, 2.2, 2.8, 3.1, 2.9, 3.4, 3.8, 3.6, 4.0, 4.3, 4.1, 4.5, 4.8];

const RESERVED_CONTENT = {
  4: {
    title: "Dispute Management",
    desc: "Where a challenged decision gets a second, independent look \u2014 evidence, comments and a resolution, all on one thread.",
    bullets: ["Evidence thread per disputed docket", "Independent second-reviewer assignment", "Resolution written back to the audit trail"],
  },
  5: {
    title: "Rules & Thresholds",
    desc: "The dials behind the queue \u2014 adjust what counts as suspicious without a redeploy.",
    bullets: ["NDVI growth-delta flag threshold", "Score-band sensitivity by project type", "Two-person sign-off above a credit value"],
  },
  6: {
    title: "Audit Trail",
    desc: "Every decision, timestamped and unchangeable \u2014 who approved what, and why.",
    bullets: ["Full action history per docket", "Reviewer identity and timestamp on every entry", "Exportable record for external audit"],
  },
};

/* ============================== global style ============================== */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

      .nccr, .nccr *{ box-sizing:border-box; }
      .nccr{
        --pine:#16302A; --pine-soft:#1E4038; --pine-deep:#0F211C;
        --parchment:#F1E8D6; --parchment-deep:#E7DBBF; --parchment-bright:#F8F2E4; --parchment-muted:#D9CFB8;
        --ink:#26211A; --ink-muted:#6E6250;
        --oxblood:#8B2E2A; --oxblood-pale:#F3E2DF;
        --brass:#A9822F; --brass-bright:#D8B65A; --brass-text:#8A6A22;
        --verdant:#3C7A49; --verdant-pale:#E4EEE1; --verdant-deep:#2A5636;
        --hairline: rgba(38,33,26,0.16);
        --hairline-pine: rgba(241,232,214,0.18);
        --font-display:'Newsreader', ui-serif, Georgia, serif;
        --font-body:'IBM Plex Sans', ui-sans-serif, Arial, sans-serif;
        --font-mono:'IBM Plex Mono', ui-monospace, Menlo, monospace;
        width:100%; height:100vh; background:var(--parchment); color:var(--ink);
        font-family:var(--font-body); font-size:14px; line-height:1.5;
        -webkit-font-smoothing:antialiased; position:relative; overflow:hidden;
      }
      .tnum{ font-variant-numeric:tabular-nums; font-feature-settings:"tnum" 1; }
      .mono{ font-family:var(--font-mono); }
      .small{ font-size:11.5px; color:var(--ink-muted); }
      .nccr-shell{ display:flex; height:100%; width:100%; }
      .nccr h1,.nccr h2,.nccr h3,.nccr p,.nccr ul,.nccr li{ margin:0; padding:0; }

      /* Rail */
      .nccr-rail{ position:relative; width:76px; flex:0 0 auto; background:var(--pine); display:flex; flex-direction:column; height:100%; }
      .nccr-rail-ribbon{ position:absolute; left:0; width:3px; background:var(--brass-bright); transition:top .35s cubic-bezier(.4,0,.2,1); }
      .nccr-rail-tab{ position:relative; flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; background:none; border:0; border-bottom:1px solid var(--hairline-pine); color:var(--parchment-muted); cursor:pointer; padding:6px 4px; font-family:var(--font-body); }
      .nccr-rail-tab:last-child{ border-bottom:0; }
      .nccr-rail-tab:hover{ background:rgba(255,255,255,0.05); color:var(--parchment-bright); }
      .nccr-rail-tab.is-active{ color:var(--brass-bright); }
      .nccr-rail-num{ font-size:11px; letter-spacing:.05em; }
      .nccr-rail-label{ writing-mode:vertical-rl; transform:rotate(180deg); font-size:9.5px; letter-spacing:.13em; text-transform:uppercase; }

      /* Main */
      .nccr-main{ flex:1; display:flex; flex-direction:column; min-width:0; height:100%; }
      .nccr-masthead{ position:relative; overflow:hidden; display:flex; align-items:center; justify-content:space-between; gap:24px; padding:18px 32px; background:var(--pine); color:var(--parchment-bright); border-bottom:3px solid var(--brass); flex:0 0 auto; }
      .nccr-masthead-left{ display:flex; align-items:center; gap:16px; position:relative; z-index:1; }
      .nccr-masthead-right{ display:flex; flex-direction:column; align-items:flex-end; gap:6px; position:relative; z-index:1; }
      .registry-mark{ width:42px; height:42px; color:var(--brass-bright); flex:0 0 auto; }
      .nccr-eyebrow{ font-family:var(--font-mono); font-size:10.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--parchment-muted); margin-bottom:3px; }
      .nccr-title{ font-family:var(--font-display); font-weight:600; font-size:25px; letter-spacing:.005em; }
      .nccr-subtitle{ font-size:11.5px; color:var(--parchment-muted); margin-top:3px; }
      .nccr-reviewer-tag{ font-family:var(--font-mono); font-size:10.5px; letter-spacing:.08em; border:1px solid var(--hairline-pine); padding:4px 8px; color:var(--parchment-muted); }
      .nccr-date{ font-family:var(--font-mono); font-size:12px; letter-spacing:.06em; color:var(--brass-bright); }

      .specimen-wm{ position:absolute; inset:-20px; display:flex; flex-wrap:wrap; align-content:center; gap:22px 36px; transform:rotate(-9deg) scale(1.25); opacity:.06; overflow:hidden; pointer-events:none; color:var(--parchment-bright); font-family:var(--font-mono); font-size:12px; letter-spacing:.18em; white-space:nowrap; z-index:0; }

      .nccr-content{ flex:1; overflow-y:auto; padding:26px 32px 56px; background-image: radial-gradient(circle, var(--hairline) 0.7px, transparent 0.7px); background-size:16px 16px; }

      .nccr-screen{ max-width:1180px; margin:0 auto; display:flex; flex-direction:column; gap:20px; }
      .nccr-screen-heading .nccr-eyebrow2{ font-family:var(--font-mono); font-size:11px; letter-spacing:.14em; color:var(--ink-muted); text-transform:uppercase; }
      .nccr-screen-heading h2{ font-family:var(--font-display); font-size:27px; margin:4px 0 4px; font-weight:600; }
      .nccr-screen-heading p{ color:var(--ink-muted); font-size:13.5px; }

      .nccr-panel{ background:var(--parchment-bright); border:1px solid var(--hairline); padding:18px 20px; }
      .nccr-panel-heading{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:14px; border-bottom:1px solid var(--hairline); padding-bottom:10px; gap:10px; }
      .nccr-panel-heading h3{ font-family:var(--font-display); font-size:16px; font-weight:600; }
      .nccr-panel-heading span{ font-size:10.5px; color:var(--ink-muted); font-family:var(--font-mono); white-space:nowrap; }

      /* KPIs */
      .nccr-kpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--hairline); border:1px solid var(--hairline); }
      .nccr-kpi{ background:var(--parchment-bright); padding:16px 18px; border-top:2px solid var(--ink-muted); }
      .nccr-kpi.accent-verdant{ border-top-color:var(--verdant); }
      .nccr-kpi.accent-oxblood{ border-top-color:var(--oxblood); }
      .nccr-kpi.accent-brass{ border-top-color:var(--brass); }
      .nccr-kpi-label{ font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-muted); }
      .nccr-kpi-value{ font-family:var(--font-display); font-size:32px; font-weight:600; margin:6px 0 3px; }
      .nccr-kpi-sub{ font-size:11.5px; color:var(--ink-muted); font-family:var(--font-mono); }

      .nccr-row2{ display:grid; grid-template-columns:1.6fr 1fr; gap:16px; align-items:stretch; }
      .nccr-row3{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }

      .nccr-log{ list-style:none; display:flex; flex-direction:column; gap:11px; }
      .nccr-log li{ display:flex; align-items:baseline; gap:10px; font-size:12.5px; }
      .nccr-log-time{ color:var(--ink-muted); font-family:var(--font-mono); font-size:11px; flex:0 0 auto; }
      .nccr-log-dot{ width:6px; height:6px; border-radius:50%; flex:0 0 auto; }
      .dot-approve{ background:var(--verdant); }
      .dot-flag{ background:var(--oxblood); }
      .dot-dispute{ background:var(--brass); }
      .dot-submit{ background:var(--ink-muted); }
      .nccr-log-text{ color:var(--ink); }

      .nccr-hist-bars{ display:flex; align-items:flex-end; gap:10px; height:120px; }
      .nccr-hist-col{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:6px; }
      .nccr-hist-bar{ width:100%; }
      .nccr-hist-label{ font-size:10px; color:var(--ink-muted); }

      .nccr-spark{ width:100%; height:90px; display:block; }
      .nccr-spark polyline{ fill:none; stroke:var(--verdant); stroke-width:2; }

      .nccr-plot{ position:relative; aspect-ratio:16/10; border:1px solid var(--hairline); background-image: linear-gradient(var(--hairline) 1px, transparent 1px), linear-gradient(90deg, var(--hairline) 1px, transparent 1px); background-size:10% 10%; }
      .nccr-plot-dot{ position:absolute; width:9px; height:9px; margin:-4.5px; border-radius:50%; background:var(--verdant); border:1.5px solid var(--parchment-bright); cursor:pointer; padding:0; }
      .nccr-plot-dot.is-flagged{ background:var(--oxblood); }

      /* Table */
      .nccr-table-wrap{ overflow-x:auto; border:1px solid var(--hairline); background:var(--parchment-bright); }
      .nccr-table{ width:100%; border-collapse:collapse; font-size:13px; min-width:740px; }
      .nccr-table th{ text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-muted); font-weight:600; padding:10px 14px; border-bottom:1px solid var(--ink-muted); }
      .nccr-table th.num{ text-align:right; }
      .nccr-table td{ padding:11px 14px; border-bottom:1px solid var(--hairline); vertical-align:middle; }
      .nccr-table td.num{ text-align:right; white-space:nowrap; }
      .nccr-table td.mono{ font-family:var(--font-mono); font-size:12px; }
      .nccr-table tbody tr{ cursor:pointer; }
      .nccr-table tbody tr:hover{ background:var(--parchment-deep); }
      .nccr-table tr.is-flagged td:first-child{ box-shadow: inset 3px 0 0 var(--oxblood); }
      .nccr-score-bar{ display:inline-block; width:60px; height:5px; background:var(--hairline); margin-right:8px; vertical-align:middle; position:relative; }
      .nccr-score-bar span{ position:absolute; inset:0; }
      .nccr-seal-dot{ display:inline-block; width:9px; height:9px; border-radius:50%; background:var(--oxblood-pale); border:1.5px solid var(--oxblood); }

      /* Detail */
      .nccr-picker{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:11.5px; color:var(--ink-muted); }
      .nccr-chip{ font-family:var(--font-mono); font-size:11px; padding:4px 8px; border:1px solid var(--hairline); background:var(--parchment-bright); cursor:pointer; color:var(--ink-muted); }
      .nccr-chip.is-active{ border-color:var(--pine); color:var(--pine); }
      .nccr-chip.is-flagged{ color:var(--oxblood); }

      .nccr-detail-grid{ display:grid; grid-template-columns:1.5fr 1fr; gap:16px; align-items:start; }
      .ndvi-compare{ position:relative; aspect-ratio:16/7; overflow:hidden; border:1px solid var(--hairline); }
      .ndvi-layer{ position:absolute; inset:0; }
      .ndvi-raster{ position:absolute; inset:0; display:grid; gap:1px; background:var(--pine-deep); }
      .ndvi-tag{ position:absolute; bottom:8px; font-family:var(--font-mono); font-size:10px; letter-spacing:.07em; background:rgba(15,33,28,0.82); color:var(--parchment-bright); padding:3px 7px; }
      .ndvi-tag-after{ right:8px; }
      .ndvi-tag-before{ left:8px; }
      .ndvi-handle{ position:absolute; top:0; bottom:0; width:2px; background:var(--brass-bright); pointer-events:none; }
      .ndvi-range{ position:absolute; inset:0; width:100%; height:100%; opacity:0; margin:0; cursor:ew-resize; }
      .nccr-ndvi-legend{ display:flex; align-items:center; gap:8px; margin-top:10px; font-size:10.5px; color:var(--ink-muted); }
      .nccr-ndvi-ramp{ flex:1; height:6px; background:linear-gradient(90deg, #8A6A3F, #D9C14A, #2C5A36); }

      .score-gauge{ width:128px; height:128px; margin:4px auto 10px; display:block; }
      .score-gauge text{ font-family:var(--font-mono); }
      .gauge-number{ font-size:29px; fill:var(--ink); font-weight:600; }
      .gauge-label{ font-size:9.5px; fill:var(--ink-muted); }

      .nccr-breakdown{ list-style:none; margin-top:8px; display:flex; flex-direction:column; gap:10px; }
      .nccr-breakdown li{ display:grid; grid-template-columns:1fr 84px 44px; align-items:center; gap:8px; font-size:12px; }
      .nccr-breakdown-bar{ height:5px; background:var(--hairline); position:relative; }
      .nccr-breakdown-bar span{ position:absolute; inset:0; background:var(--pine-soft); }

      .nccr-decision-row{ display:flex; align-items:center; gap:24px; flex-wrap:wrap; }
      .nccr-seals{ display:flex; gap:16px; }
      .seal-btn{ background:none; border:0; cursor:pointer; width:92px; height:92px; padding:0; opacity:.55; transition:opacity .2s, transform .2s; }
      .seal-btn:hover{ opacity:.85; }
      .seal-btn.is-stamped{ opacity:1; animation:stampDown .38s cubic-bezier(.34,1.56,.64,1); }
      @keyframes stampDown{ 0%{ transform:scale(1.5) rotate(-8deg); opacity:0; } 60%{ transform:scale(0.94) rotate(2deg); } 100%{ transform:scale(1) rotate(0deg); opacity:1; } }
      .nccr-decision-meta{ flex:1; min-width:220px; }
      .nccr-decision-meta code{ background:var(--parchment-deep); padding:1px 4px; font-family:var(--font-mono); }
      .nccr-tx{ color:var(--verdant-deep); margin-top:6px; }

      .nccr-note{ width:100%; margin-top:16px; border:1px solid var(--hairline); background-image:repeating-linear-gradient(var(--parchment-bright) 0 27px, var(--hairline) 27px 28px); background-color:var(--parchment-bright); line-height:28px; padding:6px 10px 0; font-family:var(--font-body); font-size:13px; color:var(--ink); resize:vertical; }
      .nccr-note:focus{ outline:2px solid var(--brass); }

      /* Reserved */
      .nccr-reserved{ position:relative; padding-top:8px; }
      .nccr-reserved-num{ position:absolute; top:-6px; right:0; font-family:var(--font-display); font-size:104px; color:var(--hairline); font-weight:600; line-height:1; z-index:0; }
      .nccr-reserved-list{ list-style:none; display:flex; flex-direction:column; gap:8px; max-width:460px; position:relative; z-index:1; }
      .nccr-reserved-list li{ padding:10px 14px; background:var(--parchment-bright); border:1px solid var(--hairline); border-left:2px solid var(--brass); font-size:13px; }
      .nccr-reserved-note{ font-family:var(--font-mono); font-size:11px; color:var(--ink-muted); }

      button:focus-visible, input:focus-visible, [tabindex]:focus-visible{ outline:2px solid var(--brass-bright); outline-offset:2px; }

      @media (max-width:900px){
        .nccr-row2, .nccr-row3, .nccr-detail-grid{ grid-template-columns:1fr; }
        .nccr-kpis{ grid-template-columns:repeat(2,1fr); }
      }
      @media (max-width:640px){
        .nccr-rail{ width:42px; }
        .nccr-rail-label{ display:none; }
        .nccr-masthead{ flex-direction:column; align-items:flex-start; padding:14px 16px; gap:12px; }
        .nccr-masthead-right{ align-items:flex-start; flex-direction:row; gap:10px; }
        .nccr-content{ padding:18px 14px 48px; }
        .nccr-title{ font-size:19px; }
      }
      @media (prefers-reduced-motion: reduce){
        .nccr-rail-ribbon{ transition:none; }
        .seal-btn.is-stamped{ animation:none; }
      }
    `}</style>
  );
}

/* ============================== small components ============================== */

function RegistryMark() {
  return (
    <svg viewBox="0 0 48 48" className="registry-mark" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" strokeWidth="1" />
      <path
        d="M24 13 L24 35 M16 20 L24 13 L32 20 M16 29 L24 35 L32 29"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpecimenWatermark() {
  const items = Array.from({ length: 18 });
  return (
    <div className="specimen-wm" aria-hidden="true">
      {items.map((_, i) => (
        <span key={i}>SPECIMEN &middot; ILLUSTRATIVE SAMPLE</span>
      ))}
    </div>
  );
}

function NdviRaster({ seed, bias, cols = 18, rows = 10 }) {
  const cells = useMemo(() => makeRaster(seed, bias, cols, rows), [seed, bias, cols, rows]);
  return (
    <div
      className="ndvi-raster"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {cells.map((v, i) => (
        <div key={i} style={{ background: ndviColor(v) }} />
      ))}
    </div>
  );
}

function NdviCompare({ seed, beforeBias, afterBias }) {
  const [pct, setPct] = useState(58);
  return (
    <div className="ndvi-compare">
      <div className="ndvi-layer">
        <NdviRaster seed={seed} bias={afterBias} />
        <span className="ndvi-tag ndvi-tag-after">AFTER &middot; AUG 2026</span>
      </div>
      <div className="ndvi-layer" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
        <NdviRaster seed={seed + 1} bias={beforeBias} />
        <span className="ndvi-tag ndvi-tag-before">BEFORE &middot; JAN 2024</span>
      </div>
      <div className="ndvi-handle" style={{ left: `${pct}%` }} />
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        className="ndvi-range"
        aria-label="Drag to compare vegetation index before and after"
      />
    </div>
  );
}

function ScoreGauge({ score, color }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = c * (1 - clamped / 100);
  return (
    <svg viewBox="0 0 132 132" className="score-gauge">
      <circle cx="66" cy="66" r={r} fill="none" style={{ stroke: "var(--hairline)" }} strokeWidth="9" />
      <circle
        cx="66"
        cy="66"
        r={r}
        fill="none"
        style={{ stroke: color }}
        strokeWidth="9"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 66 66)"
      />
      <text x="66" y="61" textAnchor="middle" className="gauge-number">{score}</text>
      <text x="66" y="80" textAnchor="middle" className="gauge-label">OUT OF 100</text>
    </svg>
  );
}

function SealStamp({ kind, stamped, onStamp }) {
  const isApprove = kind === "approve";
  const color = isApprove ? "var(--verdant)" : "var(--oxblood)";
  const label = isApprove ? "APPROVE" : "REJECT";
  const pathId = isApprove ? "sealPathApprove" : "sealPathReject";
  return (
    <button
      type="button"
      className={`seal-btn ${stamped ? "is-stamped" : ""}`}
      onClick={onStamp}
      aria-pressed={stamped}
      aria-label={isApprove ? "Approve submission" : "Reject submission"}
    >
      <svg viewBox="0 0 120 120">
        <defs>
          <path id={pathId} d="M 18,62 A 42,42 0 1,1 102,62" />
        </defs>
        <circle cx="60" cy="60" r="52" fill="none" style={{ stroke: color }} strokeWidth="2" />
        <circle cx="60" cy="60" r="43" fill="none" style={{ stroke: color }} strokeWidth="1" />
        <text fontSize="9.5" style={{ fill: color }} letterSpacing="2.5">
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
            {label} &bull; {label} &bull;
          </textPath>
        </text>
        {isApprove ? (
          <path d="M40 61 L53 74 L82 44" fill="none" style={{ stroke: color }} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M44 44 L76 76 M76 44 L44 76" fill="none" style={{ stroke: color }} strokeWidth="7" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className={`nccr-kpi ${accent ? `accent-${accent}` : ""}`}>
      <div className="nccr-kpi-label">{label}</div>
      <div className="nccr-kpi-value tnum">{value}</div>
      <div className="nccr-kpi-sub">{sub}</div>
    </div>
  );
}

function PanelHeading({ title, sub }) {
  return (
    <div className="nccr-panel-heading">
      <h3>{title}</h3>
      {sub && <span>{sub}</span>}
    </div>
  );
}

function ScreenHeading({ eyebrow, title, sub }) {
  return (
    <div className="nccr-screen-heading">
      <div className="nccr-eyebrow2 tnum">{eyebrow}</div>
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </div>
  );
}

function RailNav({ sections, active, activeIndex, onSelect }) {
  const n = sections.length;
  return (
    <nav className="nccr-rail" aria-label="Registry sections">
      <div className="nccr-rail-ribbon" style={{ top: `${(activeIndex / n) * 100}%`, height: `${100 / n}%` }} />
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`nccr-rail-tab ${active === s.id ? "is-active" : ""}`}
          onClick={() => onSelect(s.id)}
          aria-current={active === s.id ? "page" : undefined}
        >
          <span className="nccr-rail-num tnum">{String(s.id).padStart(2, "0")}</span>
          <span className="nccr-rail-label">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Masthead() {
  return (
    <header className="nccr-masthead">
      <SpecimenWatermark />
      <div className="nccr-masthead-left">
        <RegistryMark />
        <div>
          <div className="nccr-eyebrow">Registry &amp; Verification Console</div>
          <h1 className="nccr-title">National Carbon Credit Registry</h1>
          <div className="nccr-subtitle">Compliance &amp; Voluntary Carbon Markets &middot; Sample Interface</div>
        </div>
      </div>
      <div className="nccr-masthead-right">
        <div className="nccr-reviewer-tag">REVIEWER &middot; A. MENON</div>
        <div className="nccr-date tnum">27 AUG 2026</div>
      </div>
    </header>
  );
}

/* ============================== screens ============================== */

function Overview({ onOpen }) {
  return (
    <div className="nccr-screen">
      <ScreenHeading eyebrow="01 \u2014 Command Center" title="Registry Overview" sub="Where the registry stands right now, at a glance." />

      <div className="nccr-kpis">
        <KpiCard label="Pending Review" value="128" sub="+12 since yesterday" />
        <KpiCard label="Verified This Month" value="812" sub={`${inr(4186240)} tCO2e issued`} accent="verdant" />
        <KpiCard label="Flagged Submissions" value="23" sub="avg. confidence gap 41 pts" accent="oxblood" />
        <KpiCard label="Open Disputes" value="6" sub="oldest case: 6 days" accent="brass" />
      </div>

      <div className="nccr-row2">
        <div className="nccr-panel nccr-activity">
          <PanelHeading title="Registry Activity" sub="Most recent first" />
          <ul className="nccr-log">
            {ACTIVITY.map((a, i) => (
              <li key={i}>
                <span className="tnum nccr-log-time">{a.time}</span>
                <span className={`nccr-log-dot dot-${a.kind}`} />
                <span className="nccr-log-text">{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="nccr-panel">
          <PanelHeading title="Score Distribution" sub="All pending" />
          <div className="nccr-hist-bars">
            {HISTOGRAM.map((h, i) => (
              <div key={i} className="nccr-hist-col">
                <div className="nccr-hist-bar" style={{ height: `${h.pct}%`, background: h.color }} />
                <span className="nccr-hist-label tnum">{h.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="nccr-row3">
        <div className="nccr-panel">
          <PanelHeading title="Credits Issued" sub="Last 14 entries, million tCO2e" />
          <svg viewBox="0 0 280 90" className="nccr-spark" preserveAspectRatio="none">
            <polyline points={sparkPoints(SPARK, 280, 74, 6)} />
          </svg>
        </div>
        <div className="nccr-panel">
          <PanelHeading title="Registered Parcels" sub="District reference points" />
          <div className="nccr-plot">
            {SUBMISSIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`nccr-plot-dot ${s.flagged ? "is-flagged" : ""}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                onClick={() => onOpen(s.id)}
                title={`${s.id} \u00b7 ${s.coord}`}
                aria-label={`${s.project}, ${s.region}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Queue({ rows, onOpen }) {
  return (
    <div className="nccr-screen">
      <ScreenHeading eyebrow="02 \u2014 Review Queue" title="Submissions" sub="Sorted by composite score \u2014 lowest first, for audit priority." />
      <div className="nccr-table-wrap">
        <table className="nccr-table">
          <thead>
            <tr>
              <th>Docket No.</th>
              <th>Project</th>
              <th>Region</th>
              <th>Type</th>
              <th>Submitted</th>
              <th className="num">Score</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.flagged ? "is-flagged" : ""} onClick={() => onOpen(r.id)}>
                <td className="mono">{r.id}</td>
                <td>{r.project}</td>
                <td>{r.region}</td>
                <td>{r.type}</td>
                <td className="tnum">{r.submitted}</td>
                <td className="num">
                  <span className="nccr-score-bar">
                    <span style={{ width: `${r.score}%`, background: scoreColor(r.score) }} />
                  </span>
                  <span className="tnum" style={{ color: scoreColor(r.score) }}>{r.score}</span>
                </td>
                <td>{r.flagged && <span className="nccr-seal-dot" title="Flagged for review" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Detail({ submission, decision, onDecide, onPick, all }) {
  const breakdown = getBreakdown(submission);
  const seed = hashSeed(submission.id);
  return (
    <div className="nccr-screen">
      <ScreenHeading
        eyebrow="03 \u2014 Submission Detail"
        title={submission.project}
        sub={`${submission.id} \u00b7 ${submission.region} \u00b7 ${submission.type}`}
      />

      <div className="nccr-picker">
        <span>Jump to:</span>
        {all.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`nccr-chip ${s.id === submission.id ? "is-active" : ""} ${s.flagged ? "is-flagged" : ""}`}
            onClick={() => onPick(s.id)}
          >
            {s.id}
          </button>
        ))}
      </div>

      <div className="nccr-detail-grid">
        <div className="nccr-panel">
          <PanelHeading title="Vegetation Index Verification" sub="Sentinel-2 NDVI" />
          <NdviCompare seed={seed} beforeBias={0.28} afterBias={submission.flagged ? 0.32 : 0.78} />
          <div className="nccr-ndvi-legend">
            <span>Bare / Sparse</span>
            <span className="nccr-ndvi-ramp" />
            <span>Dense Canopy</span>
          </div>
        </div>

        <div className="nccr-panel">
          <PanelHeading title="Composite Score" />
          <ScoreGauge score={submission.score} color={scoreColor(submission.score)} />
          <ul className="nccr-breakdown">
            {breakdown.map((b, i) => (
              <li key={i}>
                <span>{b.label}</span>
                <span className="nccr-breakdown-bar">
                  <span style={{ width: `${Math.min(100, (b.score / b.max) * 100)}%` }} />
                </span>
                <span className="tnum" style={{ textAlign: "right" }}>{b.score}/{b.max}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="nccr-panel">
        <PanelHeading title="Registry Decision" sub="Recorded to the registry contract" />
        <div className="nccr-decision-row">
          <div className="nccr-seals">
            <SealStamp kind="approve" stamped={decision === "approved"} onStamp={() => onDecide("approved")} />
            <SealStamp kind="reject" stamped={decision === "rejected"} onStamp={() => onDecide("rejected")} />
          </div>
          <div className="nccr-decision-meta">
            <p className="mono small">
              Approve calls <code>RegistryLedger.recordDecision()</code>, then <code>CreditIssuer.mint()</code> for verified tCO2e.
            </p>
            {decision && (
              <p className="mono small nccr-tx">
                &#10003; Recorded &mdash; block #{18820000 + (seed % 500)} &middot; tx {`0x${seed.toString(16)}a3f9\u2026e22`}
              </p>
            )}
          </div>
        </div>
        <textarea className="nccr-note" placeholder="Reviewer note (optional)" rows={3} />
      </div>
    </div>
  );
}

function Reserved({ n, title, desc, bullets }) {
  return (
    <div className="nccr-screen nccr-reserved">
      <span className="nccr-reserved-num" aria-hidden="true">{n}</span>
      <ScreenHeading eyebrow={`${n} \u2014 Reserved`} title={title} sub={desc} />
      <ul className="nccr-reserved-list">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <p className="nccr-reserved-note">Scoped for the next build pass &mdash; shares the design system above.</p>
    </div>
  );
}

/* ============================== app ============================== */

export default function NCCRRegistryConsole() {
  const [active, setActive] = useState(1);
  const [selectedId, setSelectedId] = useState("NCCR-24-4468");
  const [decisions, setDecisions] = useState({});

  const selected = SUBMISSIONS.find((s) => s.id === selectedId) || SUBMISSIONS[0];
  const sortedQueue = useMemo(() => [...SUBMISSIONS].sort((a, b) => a.score - b.score), []);
  const activeIndex = SECTIONS.findIndex((s) => s.id === active);

  function openDetail(id) {
    setSelectedId(id);
    setActive(3);
  }
  function decide(id, verdict) {
    setDecisions((prev) => ({ ...prev, [id]: verdict }));
  }

  return (
    <div className="nccr">
      <GlobalStyle />
      <div className="nccr-shell">
        <RailNav sections={SECTIONS} active={active} activeIndex={activeIndex} onSelect={setActive} />
        <div className="nccr-main">
          <Masthead />
          <div className="nccr-content">
            {active === 1 && <Overview onOpen={openDetail} />}
            {active === 2 && <Queue rows={sortedQueue} onOpen={openDetail} />}
            {active === 3 && (
              <Detail
                submission={selected}
                decision={decisions[selected.id]}
                onDecide={(v) => decide(selected.id, v)}
                onPick={setSelectedId}
                all={SUBMISSIONS}
              />
            )}
            {active === 4 && <Reserved n="04" {...RESERVED_CONTENT[4]} />}
            {active === 5 && <Reserved n="05" {...RESERVED_CONTENT[5]} />}
            {active === 6 && <Reserved n="06" {...RESERVED_CONTENT[6]} />}
          </div>
        </div>
      </div>
    </div>
  );
}
