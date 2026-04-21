import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  initAudio,
  startBackgroundAmbience,
  startTelemetryBeacon,
  playDialogueBlip,
  playAttackSound,
  playCritSound,
  playCounterSound,
  triggerDivergenceAudio,
  updateSystemicAudio,
  stopAllAudio
} from './audio';
import './index.css';

// ─── NARRATIVE TURNS ──────────────────────────────────────────────────────────
const TURNS = [
  {
    id: 1,
    announce: 'NORDEN invokes LABORATORY PERFECTION!',
    lines: [
      { speaker: 'GENERAL', text: 'The Sphere of Annihilation. You told me radar interference was a solvable edge case, Norden.' },
      { speaker: 'NORDEN', text: 'In controlled conditions it performed flawlessly. The laboratory data was unambiguous.' },
      { speaker: 'GENERAL', text: "The Fleet wasn't a laboratory. It was a war." },
    ],
  },
  {
    id: 2,
    announce: 'GENERAL cites SYSTEMIC BLOAT!',
    lines: [
      { speaker: 'GENERAL', text: 'Five hundred technicians per Battle Analyzer. Ten percent nervous breakdown rate. Per deployment.' },
      { speaker: 'NORDEN', text: 'The performance gains justified the support overhead. The math is quite clear.' },
      { speaker: 'GENERAL', text: "The math doesn't account for the man who collapses at the console." },
    ],
  },
  {
    id: 3,
    announce: 'NORDEN reframes HYSTERESIS!',
    lines: [
      { speaker: 'NORDEN', text: 'The Exponential Field was our most elegant solution—' },
      { speaker: 'GENERAL', text: 'It left every ship permanently altered. They could never return to their original state, Norden. Never.' },
      { speaker: 'NORDEN', text: 'A minor hysteretic residue. Theoretically manageable.' },
      { speaker: 'GENERAL', text: "There is nothing theoretical about a ship that no longer knows what it is." },
    ],
  },
  {
    id: 4,
    announce: 'GENERAL demands INTEROPERABILITY!',
    lines: [
      { speaker: 'GENERAL', text: "By the end, the nuts and bolts weren't interchangeable between ships. You understand what that means?" },
      { speaker: 'NORDEN', text: 'Specialisation is the price of advancement—' },
      { speaker: 'GENERAL', text: "It means the Fleet could no longer fix itself. You optimised us into paralysis." },
    ],
  },
  {
    id: 5,
    announce: 'FATAL HYSTERESIS ERROR.',
    lines: [
      { speaker: 'GENERAL', text: "I've asked to be moved to a different cell. They refused." },
      { speaker: 'NORDEN', text: 'I... I see... see... the var... the variables...' },
      { speaker: 'GENERAL', text: 'We built something that defeated us more completely than the enemy ever could. And now we share a room.' },
      { speaker: 'NORDEN', text: 'The math... mathematics... the model is... is... [SYSTEMIC COLLAPSE]' },
    ],
  },
];

// ─── GENERAL'S MOVE LINES (2 rounds per move slot) ───────────────────────────
const GENERAL_MOVE_LINES = {
  tl: [
    'GENERAL: Five hundred engineers per analyzer. One in ten broke down. Those were not variables, Norden. They were men.',
    'GENERAL: You keep recasting the casualty figures as acceptable parameters. I watched those men collapse. They were your colleagues.',
  ],
  tr: [
    'GENERAL: Every theory you handed us was killed on first contact with the actual war.',
    'GENERAL: Operational friction is not a refinement problem when it destroys the entire operation.',
  ],
  bl: [
    'GENERAL: By the end a ship could not repair any other ship. That is what your specialisation actually purchased.',
    'GENERAL: Your optimisation was so precise it made us unable to survive in the field. The Fleet could not fix itself.',
  ],
  br: [
    'GENERAL: Every man who broke at his post was a system failure your equations never admitted to.',
    'GENERAL: The human cost was not a footnote. It was the result. That is the actual outcome of your work.',
  ],
};

const NORDEN_COUNTERS = {
  tl: {
    hit: { callout: 'NORDEN responds with THEORETICAL PURITY!', line: 'NORDEN: The laboratory data was unambiguous. Look at the Manhattan Project—operational anomalies will always exist, but the core physics remain unassailable. The environment is simply non-compliant.' },
    deflect: { callout: 'NORDEN deploys STATISTICAL DEFENSE!', line: 'NORDEN: Casualty rates were within documented stress parameters. Our early analog computers correctly modeled this human variance. It is a known, acceptable constant.' },
  },
  tr: {
    hit: { callout: 'NORDEN invokes LABORATORY SUPERIORITY!', line: 'NORDEN: Even the early V2 programs had their aerodynamic friction, General. We have moved past such primitive constraints. Friction disappears at sufficient technological advantage.' },
    deflect: { callout: 'NORDEN deploys ADVANCEMENT LOGIC!', line: 'NORDEN: Transitional friction is the standard cost of any advance. The alternative is permanent stagnation. We cannot build the future using legacy combustion paradigms.' },
  },
  bl: {
    deflect: { callout: 'NORDEN deploys SPECIALISATION DOCTRINE!', line: 'NORDEN: Specialisation is the necessary price of peak performance. The French built the Maginot Line for legacy interoperability, and history proved static systems fail against hyper-focused advancement.' },
    hit: { callout: 'NORDEN invokes SCALE THEORY!', line: 'NORDEN: Field repair is a logistical problem of scale. The first Dreadnoughts couldn\'t dock in standard ports, yet they redefined naval dominance. You are conflating local inconvenience with strategic obsolescence.' },
  },
  br: {
    deflect: { callout: 'NORDEN deploys UTILITARIAN CALCULUS!', line: 'NORDEN: The aggregate strategic outcome is statistically disproportionate to individual incident costs. The mathematics of modern warfare are cold, General, but they are precise.' },
    hit: { callout: 'NORDEN uses ANALYTICAL FRAMING!', line: 'NORDEN: Individual human cost is analytically distinct from systemic validity. We are building the ultimate weapon, not a life raft. To conflate the two is an emotional argument, not a strategic one.' },
  },
};

// ─── MOVES ────────────────────────────────────────────────────────────────────
const MOVES = [
  { slot: 'tl', label: 'Invoke Casualty', type: 'HUMAN', callout: 'GENERAL used INVOKE CASUALTY!', dmg: 18 },
  { slot: 'tr', label: 'Cite Friction', type: 'EMPIRICAL', callout: 'GENERAL used CITE FRICTION!', dmg: 15 },
  { slot: 'bl', label: 'Demand Interop.', type: 'SYSTEMIC', callout: 'GENERAL used DEMAND INTEROP.!', dmg: 20 },
  { slot: 'br', label: 'Cite Human Cost', type: 'ETHICAL', callout: 'GENERAL used CITE HUMAN COST!', dmg: 16 },
];

const TYPE_COLORS = { HUMAN: '#FF8888', EMPIRICAL: '#88CCFF', SYSTEMIC: '#FFD700', ETHICAL: '#88FF99' };

// ─── TIMING & HP ──────────────────────────────────────────────────────────────
const TURN_STARTS = [0, 22, 44, 66, 88];
const CRASH_START = 110;
const BRICK_AT = 120;
const TOTAL = 120;
const GENERAL_HP = [100, 82, 65, 43, 18, 0];
// Norden starts at 100, player attacks chip this down significantly
const NORDEN_BASE = [100, 95, 88, 78, 65, 0];
const TYPE_SPEED = 18; // ms per character

// Minimum time (ms) a line stays fully visible before the next step begins
const READ_PAD = 1800;

// Calculate how long to wait: typing time + reading pad
const lineWait = (text) => text.length * TYPE_SPEED + READ_PAD;

// ─── DIVERGENCE GRAPH DATA ────────────────────────────────────────────────────
const DIV_DATA = [
  { desc: 'Turn 1 ─ Pure Alignment: Norden is perfectly calm. The laboratory models hold.', pct: 0 },
  { desc: 'Turn 2 ─ Mild Discrepancy: Norden feels irritation. He dismisses early friction as user error.', pct: 12 },
  { desc: 'Turn 3 ─ Hysteretic Strain: Norden grows rigid. He attempts to mathematically force theory over reality.', pct: 33 },
  { desc: 'Turn 4 ─ Structural Paralysis: Norden is desperate. The system is permanently fractured. He blames the Fleet.', pct: 68 },
  { desc: 'Turn 5 ─ Cognitive Dissonance: Norden’s composure shatters. The gap exceeds all theoretical capacity.', pct: 89 },
  { desc: 'SYSTEM CRASH ─ Total Collapse: Norden\'s mind and the system have fatally diverged.', pct: 100 },
];

// ─── JAIL CELL BACKGROUND — Pokémon-style High Fidelity (Gritty Prison Version) ──
// We maintain the lower horizon for pokemon-style perspective, 
// but re-introduce the gritty, detailed jail cell architecture.
function drawJailCell(ctx, W, H, decay) {
  ctx.clearRect(0, 0, W, H);

  // ── Key geometry ─────────────────────────────────────────────────────────
  const HORIZ = Math.round(H * 0.46);  // Lowered horizon further to fix clipping
  const VPx = W * 0.5;               // Centered perspective
  const ta = Math.max(0.1, 1 - decay * 0.12); // smooth decay attenuation

  const CEIL = Math.round(H * 0.05);
  const WALL_TOP = CEIL;
  const LEFT_INSET = W * 0.06;
  const RIGHT_INSET = W * 0.05;

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1: CEILING & LIGHTING
  // ═══════════════════════════════════════════════════════════════════════════
  const ceilGrd = ctx.createLinearGradient(0, 0, 0, CEIL);
  ceilGrd.addColorStop(0, '#060608');
  ceilGrd.addColorStop(1, '#0C0C10');
  ctx.fillStyle = ceilGrd;
  ctx.fillRect(0, 0, W, CEIL);

  // Fluorescent tube
  const tL = W * 0.28, tW = W * 0.44;
  ctx.fillStyle = '#08080C';
  ctx.fillRect(tL - 10, 0, tW + 20, CEIL);

  // Tube glow
  ctx.fillStyle = `rgba(200, 230, 255, ${ta * 0.8})`;
  ctx.fillRect(tL, 2, tW, CEIL - 2);

  // Volumetric cold cone
  const cone = ctx.createRadialGradient(W * 0.5, CEIL, 10, W * 0.5, CEIL, H * 0.7);
  cone.addColorStop(0, `rgba(180,220,255,${0.12 * ta})`);
  cone.addColorStop(0.3, `rgba(150,190,250,${0.04 * ta})`);
  cone.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cone;
  ctx.fillRect(0, 0, W, H);

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2: BACK WALL — Detailed Concrete Blocks (Cold Version)
  // ═══════════════════════════════════════════════════════════════════════════
  const wallGrd = ctx.createRadialGradient(W * 0.5, HORIZ * 0.5, 20, W * 0.5, HORIZ * 0.5, W * 0.6);
  wallGrd.addColorStop(0, '#282A2E');
  wallGrd.addColorStop(0.5, '#1A1C20');
  wallGrd.addColorStop(1, '#0C0E12');
  ctx.fillStyle = wallGrd;
  ctx.fillRect(LEFT_INSET, WALL_TOP, W - LEFT_INSET - RIGHT_INSET, HORIZ - WALL_TOP);

  const wallW = W - LEFT_INSET - RIGHT_INSET;
  const wallH = HORIZ - WALL_TOP;
  const BW = Math.floor(wallW / 12);
  const BH = Math.floor(wallH / 5);

  // Block grid
  for (let r = 0; r < 6; r++) {
    const xOff = (r % 2) * (BW * 0.5);
    for (let c = -1; c <= 12; c++) {
      const noise = ((r * 7 + (c + 5) * 13) % 15);
      const bx = LEFT_INSET + c * BW + xOff + 2;
      const by = WALL_TOP + r * BH + 2;
      const b = 30 + noise;

      ctx.fillStyle = `rgb(${b},${b + 2},${b + 5})`;
      ctx.fillRect(bx, by, BW - 4, BH - 4);

      // Bevels
      ctx.fillStyle = `rgba(255,255,255,${0.02 + noise * 0.002})`;
      ctx.fillRect(bx, by, BW - 4, 2); // top highlights
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(bx, by + BH - 6, BW - 4, 3); // bottom shadows
    }
  }

  // Deep mortar
  for (let r = 0; r <= 6; r++) {
    ctx.fillStyle = '#060608';
    ctx.fillRect(LEFT_INSET, WALL_TOP + r * BH, wallW, 2);
  }

  // Tally marks
  const tallyX = LEFT_INSET + wallW * 0.12;
  const tallyY = WALL_TOP + wallH * 0.45;
  ctx.strokeStyle = 'rgba(160,180,200,0.15)';
  ctx.lineWidth = 1.5;
  for (let g = 0; g < 4; g++) {
    const gx = tallyX + g * 24;
    for (let t = 0; t < 4; t++) {
      ctx.beginPath(); ctx.moveTo(gx + t * 5, tallyY); ctx.lineTo(gx + t * 5, tallyY + 12); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(gx - 2, tallyY + 10); ctx.lineTo(gx + 18, tallyY + 2); ctx.stroke();
  }

  // ── Cell Window (Back wall, right side)
  const wX = LEFT_INSET + wallW * 0.65;
  const wY = WALL_TOP + BH * 0.8;
  const wW = BW * 2.5;
  const wH = BH * 2.2;

  ctx.fillStyle = '#06080A'; // recess
  ctx.fillRect(wX - 4, wY - 4, wW + 8, wH + 8);

  // Sky
  const skyGrd = ctx.createLinearGradient(wX, wY, wX, wY + wH);
  skyGrd.addColorStop(0, `rgba(40,55,75,${0.2 * ta})`);
  skyGrd.addColorStop(1, `rgba(15,20,30,${0.05 * ta})`);
  ctx.fillStyle = skyGrd;
  ctx.fillRect(wX, wY, wW, wH);

  // Light spill
  const spill = ctx.createLinearGradient(wX, wY + wH, wX - 80, H);
  spill.addColorStop(0, `rgba(160, 200, 255, ${0.1 * ta})`);
  spill.addColorStop(1, 'transparent');
  ctx.fillStyle = spill;
  ctx.beginPath();
  ctx.moveTo(wX, wY + wH); ctx.lineTo(wX + wW, wY + wH); ctx.lineTo(wX + wW + 40, H); ctx.lineTo(wX - 100, H);
  ctx.fill();

  // Window bars
  for (let wb = 0; wb <= 4; wb++) {
    const bx = wX + (wb / 4) * wW - 2;
    ctx.fillStyle = '#050505';
    ctx.fillRect(bx, wY, 4, wH);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(bx + 1, wY, 1, wH); // shine

    // cast shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.moveTo(bx - 2, wY + wH); ctx.lineTo(bx + 3, wY + wH); ctx.lineTo(bx + 3 - (80 - wb * 20), H); ctx.lineTo(bx - 2 - (80 - wb * 20), H);
    ctx.fill();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 3: SIDE WALLS & COT
  // ═══════════════════════════════════════════════════════════════════════════
  ctx.fillStyle = '#101216';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(LEFT_INSET, WALL_TOP); ctx.lineTo(LEFT_INSET, HORIZ); ctx.lineTo(0, H); ctx.fill();

  ctx.fillStyle = '#0E1014';
  ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W - RIGHT_INSET, WALL_TOP); ctx.lineTo(W - RIGHT_INSET, HORIZ); ctx.lineTo(W, H); ctx.fill();

  // Cot frame on left wall
  const cotX = LEFT_INSET * 0.2;
  const cotY = HORIZ - BH * 0.5;
  const cotW = LEFT_INSET + W * 0.15;
  const cotH = BH * 0.4;

  ctx.fillStyle = '#16181C';
  ctx.fillRect(cotX, cotY, cotW, 4);        // top rail
  ctx.fillRect(cotX, cotY + cotH, cotW, 4); // bottom rail
  ctx.fillRect(cotX + 4, cotY, 4, cotH + 8); // legs
  ctx.fillRect(cotX + cotW - 6, cotY, 4, cotH + 8);

  ctx.fillStyle = '#22262A'; // mattress
  ctx.fillRect(cotX + 8, cotY + 3, cotW - 14, cotH - 2);
  ctx.fillStyle = '#2A2E34'; // pillow
  ctx.fillRect(cotX + 10, cotY + 4, 30, cotH - 6);

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 4: FLOOR — Concrete Tiles with Perspective
  // ═══════════════════════════════════════════════════════════════════════════
  const floorGrd = ctx.createLinearGradient(0, HORIZ, 0, H);
  floorGrd.addColorStop(0, '#101216');
  floorGrd.addColorStop(0.5, '#1A1E24');
  floorGrd.addColorStop(1, '#0C0E12');
  ctx.fillStyle = floorGrd;
  ctx.fillRect(0, HORIZ, W, H - HORIZ);

  ctx.strokeStyle = `rgba(100, 120, 140, ${0.1 * ta})`;
  ctx.lineWidth = 2;

  // Radial Lines (Floor grooves)
  for (let i = 0; i <= 24; i++) {
    const rx = (i / 24) * W * 4 - W * 1.5;
    ctx.beginPath();
    ctx.moveTo(rx, H + 50);
    ctx.lineTo(VPx + (rx - VPx) * 0.1, HORIZ);
    ctx.stroke();
  }
  // Horizontals (Perspective spacing)
  for (let j = 1; j <= 12; j++) {
    const t = j / 12;
    const y = HORIZ + (H - HORIZ) * Math.pow(t, 0.7);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Floor Edge Occlusion
  const occ = ctx.createLinearGradient(0, HORIZ, 0, HORIZ + 30);
  occ.addColorStop(0, 'rgba(0,0,0,0.6)'); occ.addColorStop(1, 'transparent');
  ctx.fillStyle = occ; ctx.fillRect(0, HORIZ, W, 30);

  // Vignette for depth
  const vignette = ctx.createRadialGradient(W * 0.5, H * 0.6, H * 0.2, W * 0.5, H * 0.6, W * 0.8);
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 5: CONTAINMENT PLATFORMS (Replacing dirt mounds)
  // ═══════════════════════════════════════════════════════════════════════════
  // Far platform (Norden) - High right
  drawPlatform(ctx, W * 0.58, H * 0.50, W * 0.32, H * 0.05, decay, 'far', ta);

  // Near platform (General) - Low left, massive
  drawPlatform(ctx, -W * 0.08, H * 0.84, W * 0.58, H * 0.08, decay, 'near', ta);

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 6: DECAY / HYSTERESIS EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════
  if (decay >= 3) {
    const decAlpha = (decay - 2) * 0.1;
    ctx.fillStyle = `rgba(255, 60, 0, ${decAlpha})`;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    // Falling digital ash / fragmentation
    ctx.fillStyle = `rgba(255, 107, 0, ${decAlpha * 2})`;
    for (let p = 0; p < 30; p++) {
      const px = (p * 57 + (Date.now() / 15)) % W;
      const py = (p * 83 + (Date.now() / 20)) % H;
      ctx.fillRect(px, py, (p % 3) + 1, (p % 4) + 1);
    }
  }
}

// ── Sleek, Geometric Pokémon-style Battle Platform
function drawPlatform(ctx, x, y, w, h, decay, type, ta) {
  const isFar = type === 'far';
  const rimH = h;

  // Base shadow cast on floor
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + rimH / 2 + 8, w / 2 + 4, h * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cylinder/Rim (Front face of the disc)
  const rimGrd = ctx.createLinearGradient(x, y, x, y + rimH);
  rimGrd.addColorStop(0, isFar ? '#202428' : '#2A2E32');
  rimGrd.addColorStop(0.5, isFar ? '#121518' : '#1A1D20');
  rimGrd.addColorStop(1, '#06080A');
  ctx.fillStyle = rimGrd;

  // Draw thick extruded ellipse
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y, w / 2, h, 0, Math.PI, 0, true); // top half
  ctx.lineTo(x + w, y + rimH);
  ctx.ellipse(x + w / 2, y + rimH, w / 2, h, 0, 0, Math.PI, false); // bottom half
  ctx.lineTo(x, y);
  ctx.fill();

  // Top Surface (where character stands)
  const topGrd = ctx.createLinearGradient(x, y - h, x, y + h);
  topGrd.addColorStop(0, isFar ? '#30363C' : '#3A4046');
  topGrd.addColorStop(1, isFar ? '#181C20' : '#22262A');
  ctx.fillStyle = topGrd;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y, w / 2, h, 0, 0, Math.PI * 2);
  ctx.fill();

  // Edge Highlighter (The glowing rim characteristic of Pokemon stands)
  ctx.strokeStyle = isFar ? `rgba(157, 0, 255, ${0.4 * ta})` : `rgba(0, 255, 178, ${0.4 * ta})`;
  ctx.lineWidth = isFar ? 2 : 3;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y, w / 2 - 2, h - 2, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Inner geometric detail line
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y, w / 2 - 12, h - 8, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Decay overlay
  if (decay >= 3) {
    ctx.fillStyle = `rgba(255,0,0,${(decay - 2) * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y, w / 2, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function JailCellBackground({ decay }) {
  const canvasRef = useRef(null);
  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c?.parentElement) return;
    const W = c.parentElement.offsetWidth, H = c.parentElement.offsetHeight;
    if (!W || !H) return;
    c.width = W; c.height = H;
    drawJailCell(c.getContext('2d'), W, H, decay);
  }, [decay]);
  useEffect(() => { redraw(); }, [redraw]);
  useEffect(() => {
    const ro = new ResizeObserver(redraw);
    if (canvasRef.current?.parentElement) ro.observe(canvasRef.current.parentElement);
    return () => ro.disconnect();
  }, [redraw]);
  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
    />
  );
}

// ─── START SCREEN ─────────────────────────────────────────────────────────────

function StartScreen({ onStart }) {
  return (
    <div className="start-screen scanlines">
      <div className="start-content">
        <h1 className="start-title">SYSTEMIC DIVERGENCE</h1>
        <div className="start-instructions">
          <h3>SITUATION REPORT</h3>
          <p>You are the General of the Fleet. Your forces have completely collapsed because we abandoned reliable military operations in Relentless pursuit of unbroken, but over-complicated technological superiority.</p>
          <p>You now find yourself locked in a containment cell with Professor Norden, the architect of these flawless, failing models.</p>
          <h3>OBJECTIVE</h3>
          <p>You have 120 seconds before irreversible system divergence.</p>
          <p>Select rhetorical arguments to attack Norden's theoretical certainty. He will counter with raw mathematical data.</p>
          <p>Attempt to break his models before your own mind diverges.</p>
        </div>
        <button className="start-button" onClick={onStart}>[ INITIALIZE SESSION ]</button>
      </div>
    </div>
  );
}

// ─── GAME OVER SCREEN ─────────────────────────────────────────────────────────

function GameOverScreen({ score }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1600),
      setTimeout(() => setPhase(3), 3600),
      setTimeout(() => setPhase(4), 4800)
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <div className="gameover-screen scanlines">
      <AnimatePresence>
        {phase >= 1 && (
          <motion.div className="go-header" key="go-header"
            initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="go-title">SYSTEMIC OVERLOAD</div>
            <div className="go-subtitle">SYSTEMIC DIVERGENCE : TERMINAL STATE</div>
          </motion.div>
        )}
        {phase >= 2 && (
          <motion.p className="go-quote" style={{ fontSize: '1.4rem', lineHeight: '1.6', textAlign: 'center', marginTop: '3rem' }} key="go-quote"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }}>
            "We replaced imperfect courage with flawless logic.<br />
            If the equations were undeniably perfect...<br />
            Then what exactly was the true cost of our certainty?"
          </motion.p>
        )}
        {phase >= 3 && (
          <motion.div className="go-cell-note" style={{ marginTop: '3rem' }} key="go-note"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            [ The cell remains locked. The divergence is permanent. ]
          </motion.div>
        )}
        {phase >= 4 && (
          <motion.div className="go-restart" key="go-restart"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.9 }}>
            Press F5 to attempt reconciliation
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── DIVERGENCE GRAPH ─────────────────────────────────────────────────────────

function DivergenceGraph({ turnIdx, elapsed, crashed }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const smoothT = useRef(null);
  const smoothR = useRef(null);
  const elRef = useRef(elapsed);
  useEffect(() => { elRef.current = elapsed; }, [elapsed]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const W = c.width, H = c.height;
    const ctx = c.getContext('2d');
    const mid = H * 0.5;

    if (smoothT.current === null) smoothT.current = mid;
    if (smoothR.current === null) smoothR.current = mid;

    const SCROLL = 1.5;
    const img = ctx.getImageData(Math.ceil(SCROLL), 0, W - Math.ceil(SCROLL), H);
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#020401';
    ctx.fillRect(W - Math.ceil(SCROLL) - 1, 0, Math.ceil(SCROLL) + 2, H);

    const el = elRef.current ?? 0;
    const frac = Math.max(0, Math.min(el / 120, 1.0)); // 0.0 (start) to 1.0 (crash)
    const t = Date.now() / 1000;

    if (!crashed) {
      const theoryTarget = mid - Math.sin(t * 0.72) * 14 - (frac * 6);
      smoothT.current = smoothT.current * 0.82 + theoryTarget * 0.18;

      const jitter = Math.max(0, frac - 0.2);
      const offsetAmt = frac * 28; // Reduced to fit inside new 110px constraints comfortably
      const noiseAmt = frac * 20 + (Math.random() - 0.5) * jitter * 25;

      const realityTarget = mid
        + offsetAmt
        + Math.sin(t * 0.72 + (frac * 1.5) * Math.PI) * (14 * (1 - frac * 0.5))
        + (Math.random() - 0.5) * 2 * noiseAmt;

      smoothR.current = smoothR.current * 0.82 + realityTarget * 0.18;

      const ty = Math.max(2, Math.min(H - 3, Math.round(smoothT.current)));
      const ry = Math.max(2, Math.min(H - 3, Math.round(smoothR.current)));

      // Fill gap with an intensifying warning color
      if (frac > 0.1) {
        const lo = Math.min(ty, ry), hi = Math.max(ty, ry);
        const gapA = frac < 0.4 ? 0.055 : 0.09;
        ctx.fillStyle = frac < 0.4 ? `rgba(255,200,0,${gapA})` : `rgba(255,70,0,${gapA})`;
        ctx.fillRect(W - 2, lo, 2, hi - lo);
      }

      ctx.fillStyle = '#00FFB2'; ctx.shadowColor = '#00FFB2'; ctx.shadowBlur = 3;
      ctx.fillRect(W - 2, ty - 1, 2, 2);

      // Color shifts organically from green to burning red as HP drops
      const rR = Math.round(0 + (255 - 0) * frac);
      const rG = Math.round(255 + (23 - 255) * frac);
      const rB = Math.round(178 + (68 - 178) * frac);
      const dColor = `rgb(${rR},${rG},${rB})`;

      ctx.fillStyle = dColor; ctx.shadowColor = dColor; ctx.shadowBlur = 3;
      ctx.fillRect(W - 2, ry - 1, 2, 2);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = 'rgba(0,255,178,0.85)'; ctx.fillRect(W - 2, mid, 2, 2);
      const ry = mid + (Math.random() - 0.5) * H;
      ctx.fillStyle = 'rgba(255,23,68,0.65)'; ctx.fillRect(W - 2, ry, 2, Math.random() * 4);
    }

    frameRef.current = requestAnimationFrame(draw);
  }, [crashed]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#020401'; ctx.fillRect(0, 0, c.width, c.height);
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  const di = crashed ? 5 : Math.min(turnIdx, 4);
  const divData = DIV_DATA[di];
  const rColors = ['#00FFB2', '#BBFF20', '#FFC400', '#FF6B00', '#FF1744', '#FF1744'];
  const pctColor = di < 2 ? '#00FFB2' : di < 4 ? '#FFC400' : '#FF1744';

  return (
    <div className="div-strip">
      <div className="div-toprow">
        <span className="div-title">THEORY VS REALITY GRAPH (TRACKING HYSTERESIS DIVERGENCE)</span>
        <div className="div-legend">
          <span className="div-leg-item" style={{ color: 'rgba(0,255,178,0.65)' }}>─ NORDEN'S STABLE MODEL</span>
          <span className="div-leg-item" style={{ color: rColors[di] }}>─ ERRATIC FIELD REALITY</span>
        </div>
      </div>
      <div className="div-canvas-wrap">
        <canvas ref={canvasRef} width={900} height={46} className="div-canvas" style={{ height: '46px' }} />
        <div className="div-midline" />
      </div>
      <div className="div-botrow">
        <span className="div-desc">{divData.desc}</span>
        <span className="div-pct" style={{ color: pctColor, textShadow: `0 0 5px ${pctColor}` }}>
          DIVERGENCE: {divData.pct}%
        </span>
      </div>
    </div>
  );
}

// ─── INFO CARD ────────────────────────────────────────────────────────────────

function InfoCard({ name, hp, maxHp, level, sub, isEnemy }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const col = pct > 50 ? '#39FF14' : pct > 20 ? '#FF6B00' : '#FF1744';
  return (
    <div className={`info-card ${isEnemy ? 'enemy' : 'player'}`}>
      <div className="ic-header">
        <span className="ic-name">{name}</span>
      </div>
      <div className="ic-sub">{sub}</div>
      <div className="hp-row">
        <span className="hp-lbl">HP</span>
        <div className="hp-track">
          <motion.div
            className="hp-fill"
            animate={{ width: `${pct}%`, backgroundColor: col }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            style={{ boxShadow: `0 0 8px ${col}55` }}
          />
        </div>
      </div>
      <div className="hp-num">{Math.round(hp)} / {maxHp}</div>
    </div>
  );
}

// ─── GENERAL — BACK VIEW (High Detail, Gen 5 Pokemon Style) ─────────────────────────────

function GeneralSprite({ decay, attacking, hit }) {
  const anim = decay < 2 ? 'breathe 2.5s ease-in-out infinite'
    : decay === 2 ? 'breatheStutter 2.5s ease-in-out infinite' : 'none';
  const jitter = decay >= 4;
  const fColor = decay >= 3 ? `rgba(255,107,0,${(decay - 2) * 0.35})` : 'transparent';
  return (
    <motion.svg width="380" height="460" viewBox="0 0 20 28"
      className="pixel-sprite"
      style={{
        imageRendering: 'pixelated', transformOrigin: 'bottom center',
        animation: jitter ? 'generalJitter 0.09s steps(1) infinite' : anim,
        filter: decay >= 3
          ? `drop-shadow(0 0 ${(decay - 2) * 8}px rgba(255,107,0,${(decay - 2) * 0.6})) contrast(${1.25 - decay * 0.06})`
          : 'drop-shadow(0 8px 18px rgba(0,0,0,0.85)) drop-shadow(0 2px 4px rgba(0,255,178,0.15))',
      }}
      animate={
        hit ? { x: [-12, 12, -8, 8, -5, 0], filter: 'brightness(1.5)' } :
          attacking ? { x: [0, 60, 60, 0], scaleX: [1, 1.08, 1.08, 1] } :
            {}
      }
      transition={hit ? { duration: 0.4, ease: 'easeOut' } : attacking ? { duration: 0.5, ease: [0.4, 0, 0.2, 1] } : {}}
    >
      {/* Expanded Hat */}
      <rect x="3" y="0" width="14" height="2" fill="url(#gGold)" />
      <rect x="4" y="2" width="12" height="4" fill="#3B4822" />
      <rect x="2" y="5" width="16" height="1" fill="#111" /> {/* Hat Brim Wide */}
      <rect x="2" y="6" width="16" height="1" fill="#000" /> {/* Brim Shadow */}

      {/* Head/Neck */}
      <rect x="6" y="7" width="8" height="3" fill="#D6B88C" />
      <rect x="6" y="7" width="8" height="1" fill="#8B5A2B" /> {/* Neck Shadow */}
      <rect x="7" y="10" width="6" height="2" fill="#C4A07A" />

      {/* Broad Coat Core */}
      <rect x="3" y="12" width="14" height="11" fill="url(#gCoat)" />
      <rect x="4" y="12" width="1" height="11" fill="#AACC88" opacity="0.3" /> {/* Left edge highlight */}
      <rect x="9" y="12" width="1" height="11" fill="#0A0A0A" opacity="0.6" /> {/* Deep center fold */}

      {/* Epaulettes - Flashy */}
      <rect x="1" y="11" width="4" height="3" fill="#3B4822" />
      <rect x="1" y="11" width="4" height="1.5" fill="url(#gGold)" />
      <rect x="15" y="11" width="4" height="3" fill="#3B4822" />
      <rect x="15" y="11" width="4" height="1.5" fill="url(#gGold)" />

      {/* Thick Arms */}
      <rect x="1" y="14" width="3" height="7" fill="#405226" />
      <rect x="16" y="14" width="3" height="7" fill="#35441E" />
      <rect x="1" y="20" width="3" height="1" fill="#222" />
      <rect x="16" y="20" width="3" height="1" fill="#222" />

      {/* Hands */}
      <rect x="0.5" y="21" width="3.5" height="2" fill="#D6B88C" />
      <rect x="16" y="21" width="3.5" height="2" fill="#D6B88C" />

      {/* Back Half-Belt */}
      <rect x="4" y="22" width="12" height="2" fill="#2A3515" />
      <rect x="4" y="21.5" width="1" height="3" fill="#111" /> {/* Belt loop left */}
      <rect x="15" y="21.5" width="1" height="3" fill="#111" /> {/* Belt loop right */}
      <rect x="9" y="22" width="2" height="2" fill="#111" /> {/* Center stitching shadow */}

      {/* Legs & High-Poly Boots */}
      <rect x="4" y="24" width="5" height="2" fill="#1C2410" />
      <rect x="11" y="24" width="5" height="2" fill="#151A08" />

      {/* Boots Base */}
      <rect x="3.5" y="26" width="6" height="2" fill="#0C0A0A" />
      <rect x="10.5" y="26" width="6" height="2" fill="#050505" />
      <rect x="4.5" y="26" width="2" height="1" fill="#666" /> /* Boot reflection */
      <rect x="12" y="26" width="2" height="1" fill="#444" />

      {decay >= 3 && <rect x="18" y="0" width="2" height="28" fill={fColor} />}
    </motion.svg>
  );
}

// ─── NORDEN — FRONT VIEW (Crisper, Farther perspective) ───────────────────────────────

function NordenSprite({ decay, hit, nordenAttacking }) {
  const desat = decay >= 4 ? 0.3 : 0;
  return (
    <motion.svg width="180" height="300" viewBox="0 0 18 30"
      className="norden-idle pixel-sprite"
      style={{
        imageRendering: 'pixelated', transformOrigin: 'bottom center',
        filter: `saturate(${1 - desat}) drop-shadow(0 8px 24px rgba(0,0,0,0.95)) drop-shadow(0 0 8px rgba(157,0,255,0.2))`,
      }}
      animate={
        nordenAttacking ? { y: [0, 40, 10, 0], scaleY: [1, 0.9, 1.05, 1], filter: 'brightness(1.4)' } :
          hit ? { x: [0, -18, 18, -14, 14, -8, 0] } :
            {}
      }
      transition={
        nordenAttacking ? { duration: 0.55, ease: 'easeInOut' } :
          hit ? { duration: 0.44, ease: 'easeOut' } :
            {}
      }
    >
      {/* Crisp Hair */}
      <rect x="5" y="0" width="8" height="2" fill="#0A0502" />
      <rect x="4" y="1" width="2" height="4" fill="#0A0502" />
      <rect x="12" y="1" width="2" height="3" fill="#0A0502" />
      <rect x="6" y="0" width="2" height="1" fill="#444" /> {/* Hair sheen */}

      {/* Refined Face */}
      <rect x="5" y="2" width="8" height="7" fill="#FFE4C4" />
      <rect x="5.5" y="8" width="7" height="1" fill="#C4A47A" /> {/* Jaw shadow */}

      {/* Glasses (Neon glow reflection) */}
      <rect x="5.5" y="3.5" width="3" height="2" fill="none" stroke="#222" strokeWidth="0.5" />
      <rect x="9.5" y="3.5" width="3" height="2" fill="none" stroke="#222" strokeWidth="0.5" />
      <rect x="8.5" y="4" width="1" height="0.5" fill="#222" />
      <rect x="6" y="4" width="1.5" height="1" fill="#00FFB2" opacity="0.3" /> {/* Lab computer reflection */}
      <rect x="10" y="4" width="1.5" height="1" fill="#00FFB2" opacity="0.3" />

      {/* Strict White Collar */}
      <rect x="6" y="9" width="6" height="2" fill="#FFF" />
      <rect x="6" y="10.5" width="6" height="0.5" fill="#CCC" />

      {/* Wide Lab Coat Form */}
      <rect x="3" y="11" width="12" height="13" fill="url(#nCoat)" />
      <rect x="5" y="11" width="0.5" height="13" fill="#777" opacity="0.5" /> /* Folds */
      <rect x="13" y="11" width="0.5" height="13" fill="#777" opacity="0.5" />

      {/* Bright Purple Tie */}
      <rect x="8" y="11" width="2" height="9" fill="url(#nTie)" />
      <rect x="7.5" y="11" width="3" height="1.5" fill="#B300FF" /> /* Knot */

      {/* Pocket & Pens */}
      <rect x="4" y="13" width="2.5" height="3" fill="#F0F0F0" />
      <rect x="4.5" y="11.5" width="0.5" height="1.5" fill="#FF0055" /> /* Red pen */
      <rect x="5.5" y="12" width="0.5" height="1" fill="#222" /> /* Black pen */

      {/* Arms & Hands */}
      <rect x="1" y="12" width="2" height="8" fill="#DDD" />
      <rect x="15" y="12" width="2" height="8" fill="#CCC" />
      <rect x="0.5" y="20" width="2.5" height="2" fill="#FFE4C4" />
      <rect x="15" y="20" width="2.5" height="2" fill="#D4B48A" />

      {/* Trousers */}
      <rect x="5" y="24" width="3.5" height="5" fill="#151515" />
      <rect x="9.5" y="24" width="3.5" height="5" fill="#111" />

      {/* Pointed Formal Shoes */}
      <rect x="4.5" y="28" width="4.5" height="2" fill="#050505" />
      <rect x="9" y="28" width="4.5" height="2" fill="#000" />
      <rect x="5" y="28.5" width="1.5" height="0.5" fill="#FFF" opacity="0.5" /> /* Spitshine */
      <rect x="10.5" y="28.5" width="1.5" height="0.5" fill="#FFF" opacity="0.5" />

    </motion.svg>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);

  // ── Core narrative state ─────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const [turnIdx, setTurnIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [crashed, setCrashed] = useState(false);
  const [bricked, setBricked] = useState(false);

  // ── Combat state ─────────────────────────────────────────────────────────
  const [usedMoves, setUsedMoves] = useState([]);
  const [moveRound, setMoveRound] = useState(0);
  const [nordenHp, setNordenHp] = useState(100);
  const [generalHp, setGeneralHp] = useState(100);
  const [isInBattle, setIsInBattle] = useState(false);
  const [score, setScore] = useState({ general: 0, norden: 0 });
  const [attacking, setAttacking] = useState(false);
  const [nordenHit, setNordenHit] = useState(false);
  const [nordenAttack, setNordenAttack] = useState(false);
  const [generalHit, setGeneralHit] = useState(false);
  const [arenaShaking, setArenaShaking] = useState(false);
  const [showHitFlash, setHitFlash] = useState(false);
  const [showImpact, setImpact] = useState(false);
  const [showNImpact, setNImpact] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState([]);

  // ── Dialogue / typewriter ────────────────────────────────────────────────
  const [displayReq, setDisplayReq] = useState({ key: 0, speaker: '', text: '' });
  const [typedText, setTypedText] = useState('');
  const [typeComplete, setTypeComplete] = useState(false);

  // ── Audio Triggers ───────────────────────────────────────────────────────
  useEffect(() => {
    if (crashed) triggerDivergenceAudio();
  }, [crashed]);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const startTime = useRef(null);
  const prevTurn = useRef(0);
  const prevLine = useRef(0);
  const seqRef = useRef({ timers: [], id: 0 });
  const normalLineRef = useRef('');

  // ── showText ─────────────────────────────────────────────────────────────
  const showText = useCallback((speaker, text) => {
    setDisplayReq(prev => ({ key: prev.key + 1, speaker, text }));
  }, []);

  // ── spawnFloatingText ────────────────────────────────────────────────────
  const spawnFloatingText = useCallback((text, type, target) => {
    const id = Date.now() + Math.random();
    setFloatingTexts(prev => [...prev, { id, text, type, target }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
    }, 1800);
  }, []);

  // ── runSequence — cancellable sequential timer runner ────────────────────
  const runSequence = useCallback((steps) => {
    seqRef.current.timers.forEach(clearTimeout);
    const myId = seqRef.current.id + 1;
    seqRef.current = { timers: [], id: myId };
    let acc = 0;
    steps.forEach(({ delay, fn }) => {
      acc += delay;
      const t = setTimeout(() => { if (seqRef.current.id === myId) fn(); }, acc);
      seqRef.current.timers.push(t);
    });
  }, []);

  // ── Typewriter ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!displayReq.text) return;
    setTypedText('');
    setTypeComplete(false);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i <= displayReq.text.length) {
        setTypedText(displayReq.text.slice(0, i));
        if (i % 2 === 0) playDialogueBlip();
      } else {
        setTypeComplete(true);
        clearInterval(iv);
      }
    }, TYPE_SPEED);
    return () => clearInterval(iv);
  }, [displayReq.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Main timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted) return;
    if (!startTime.current) startTime.current = Date.now();
    const iv = setInterval(() => {
      const e = Math.floor((Date.now() - startTime.current) / 1000);
      setElapsed(e);
      const nt = TURN_STARTS.reduce((acc, ts, i) => e >= ts ? i : acc, 0);
      updateSystemicAudio(e, nt);
      if (nt !== prevTurn.current) {
        prevTurn.current = nt; setTurnIdx(nt); setLineIdx(0); prevLine.current = 0;
      }
      if (e >= CRASH_START) setCrashed(true);
      if (e >= BRICK_AT) { setBricked(true); stopAllAudio(); }
    }, 250);
    return () => clearInterval(iv);
  }, [gameStarted]);

  // ── Line advancement ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted) return;
    const tElapsed = elapsed - (TURN_STARTS[turnIdx] ?? 0);
    const n = TURNS[Math.min(turnIdx, 4)].lines.length;
    const nl = Math.min(Math.floor(tElapsed / (22 / n)), n - 1);
    if (nl !== prevLine.current) { prevLine.current = nl; setLineIdx(nl); }
  }, [elapsed, turnIdx, gameStarted]);

  // ── Normal dialogue (only when not in a battle sequence) ──────────────────
  useEffect(() => {
    if (!gameStarted || isInBattle) return;
    const ti = Math.min(turnIdx, 4);
    const line = TURNS[ti].lines[lineIdx];
    if (!line) return;
    const full = `${line.speaker}: ${line.text}`;
    if (full === normalLineRef.current) return;
    normalLineRef.current = full;
    showText(line.speaker, full);
  }, [gameStarted, turnIdx, lineIdx, isInBattle, showText]);

  // ── Move handler ──────────────────────────────────────────────────────────
  const handleMove = useCallback((move) => {
    if (usedMoves.includes(move.slot) || isInBattle || crashed) return;

    const newUsed = [...usedMoves, move.slot];
    const isLastMove = newUsed.length >= MOVES.length;
    setUsedMoves(newUsed);

    // ── BALANCED DAMAGE ──────────────────────────────────────────────────
    // Base damage from move + small variance (±3)
    const variance = Math.floor(Math.random() * 7) - 3;
    let actualDmg = move.dmg + variance;

    // Critical Hit logic
    const isCrit = Math.random() < 0.15; // 15% chance
    if (isCrit) { actualDmg = Math.floor(actualDmg * 1.5); }

    // Determine battle outcome
    const genChance = Math.max(0.35, 0.60 - turnIdx * 0.05);
    const won = Math.random() < genChance;

    setScore(p => ({ general: p.general + (won ? 1 : 0), norden: p.norden + (won ? 0 : 1) }));

    // Apply damage to Norden's HP
    actualDmg = won ? actualDmg : Math.floor(actualDmg * 0.4); // deflected hits do 40% damage
    setNordenHp(prev => Math.max(1, prev - actualDmg));

    const r = moveRound;
    const genLine = GENERAL_MOVE_LINES[move.slot][r % GENERAL_MOVE_LINES[move.slot].length];
    const counter = won ? NORDEN_COUNTERS[move.slot].hit : NORDEN_COUNTERS[move.slot].deflect;

    let resultTx;
    if (won) {
      resultTx = isCrit
        ? `▲ CRITICAL HIT! — ${actualDmg} DMG. A profound analytical breakthrough rips through the models.`
        : `▲ EFFECTIVE — ${actualDmg} DMG. The argument lands. Norden's certainty fractures.`;
    } else {
      resultTx = `▼ DEFLECTED — ${actualDmg} DMG. Theory holds firm. The laboratory data is undefeated.`;
    }

    // ── TIMING: generous delays so each line can be read ─────────────────
    const gWait = lineWait(genLine);
    const nWait = lineWait(counter.line);

    runSequence([
      // T+0: Battle callout
      { delay: 0, fn: () => { setIsInBattle(true); showText('BATTLE', move.callout); } },
      // T+500: General lunges forward
      { delay: 500, fn: () => setAttacking(true) },
      // T+900: Impact on Norden
      {
        delay: 900, fn: () => {
          setAttacking(false);
          if (won) { isCrit ? playCritSound() : playAttackSound(); } else { playAttackSound(); }
          spawnFloatingText(won ? (isCrit ? `CRIT! ${actualDmg}` : `${actualDmg} DMG`) : `DEFLECT: ${actualDmg}`,
            won ? (isCrit ? 'dmg-crit' : 'dmg-hit') : 'dmg-deflect', 'norden');

          setNordenHit(true); setArenaShaking(true); setHitFlash(true); setImpact(true);
          setTimeout(() => { setNordenHit(false); setArenaShaking(false); setHitFlash(false); }, 450);
          setTimeout(() => setImpact(false), 550);
        }
      },
      // T+1200: General's argument line — waits for full type + read time
      { delay: 1200, fn: () => showText('GENERAL', genLine) },
      // After reading General's line: Norden counter-attack callout
      { delay: gWait, fn: () => { showText('BATTLE', counter.callout); } },
      // T+800: Norden lunges
      { delay: 800, fn: () => { setNordenAttack(true); playCounterSound(); } },
      // T+600: Impact on General
      {
        delay: 600, fn: () => {
          setNordenAttack(false); setGeneralHit(true); setNImpact(true);
          const cDmg = won ? 12 : 22;
          setGeneralHp(prev => Math.max(1, prev - cDmg));
          spawnFloatingText(won ? `COUNTER: ${cDmg}` : `COUNTER: ${cDmg}`, 'dmg-deflect', 'general');

          setTimeout(() => { setGeneralHit(false); }, 450);
          setTimeout(() => setNImpact(false), 550);
        }
      },
      // T+900: Norden's counter line — waits for full type + read time
      { delay: 900, fn: () => showText('NORDEN', counter.line) },
      // After reading Norden's line: Result verdict
      { delay: nWait, fn: () => showText('RESULT', resultTx) },
      // After reading result: End battle sequence
      {
        delay: lineWait(resultTx), fn: () => {
          setIsInBattle(false);
          normalLineRef.current = '';
          if (isLastMove) {
            setTimeout(() => {
              setMoveRound(mr => mr + 1);
              setUsedMoves([]);
            }, 500);
          }
        }
      },
    ]);
  }, [usedMoves, isInBattle, crashed, moveRound, turnIdx, showText, spawnFloatingText, runSequence]);

  // ── Derived values ────────────────────────────────────────────────────────
  const ti = Math.min(turnIdx, 5);
  const generalDisp = Math.max(1, generalHp);
  // Norden's displayed HP: lower of base decay OR player-inflicted damage
  const nordenBaseHp = NORDEN_BASE[ti];
  const nordenDisp = Math.max(1, Math.min(nordenBaseHp, nordenHp));
  const remaining = Math.max(0, TOTAL - elapsed);

  const iBlur = turnIdx >= 3 ? `blur(${(turnIdx - 2) * 0.25}px)` : 'none';

  // Toned-down decay: no full desaturation or heavy blur, just subtle shifts
  const decayFilter = [
    'none',
    'hue-rotate(4deg) saturate(1.05)',
    'hue-rotate(10deg) saturate(0.92)',
    'hue-rotate(18deg) saturate(0.72)',
    'hue-rotate(26deg) saturate(0.55) brightness(0.92)',
  ][Math.min(turnIdx, 4)];

  const chromaShift = turnIdx >= 1 ? 1.5 + turnIdx * 1.0 : 0;
  // No flicker class — removed the aggressive strobing
  const flickerClass = '';

  const targetLen = displayReq.text.length;
  const roundLabel = moveRound > 0 ? ` [R${moveRound + 1}]` : '';

  return (
    <>
      <style>{`
        @keyframes breathe        { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(1.03)} }
        @keyframes breatheStutter { 0%,45%,55%,100%{transform:scaleY(1)} 50%{transform:scaleY(1.03)} }
        @keyframes generalJitter  {
          0%{transform:translate(0,0)skewX(0)} 25%{transform:translate(-2px,1px)skewX(-1.2deg)}
          50%{transform:translate(3px,-1px)skewX(1deg)} 75%{transform:translate(-1px,2px)skewX(0.4deg)}
        }
        @keyframes nordenBlink { 0%,90%,100%{opacity:1} 93%,98%{opacity:0.78} }
        .norden-idle { animation: nordenBlink 5.2s step-end infinite; }
      `}</style>

      {!gameStarted && <StartScreen onStart={async () => {
        await initAudio();
        startBackgroundAmbience();
        startTelemetryBeacon();
        setGameStarted(true);
      }} />}

      {gameStarted && crashed && bricked && <GameOverScreen score={score} />}

      {gameStarted && !bricked && (
        <div className={`battle-root scanlines ${flickerClass}`}>
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
              <radialGradient id="gCoat" cx="50%" cy="50%" r="65%">
                <stop offset="0%" stopColor="#506630" /><stop offset="50%" stopColor="#3B4822" /><stop offset="100%" stopColor="#1E2A12" />
              </radialGradient>
              <linearGradient id="gGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFF088" /><stop offset="40%" stopColor="#FFD700" /><stop offset="100%" stopColor="#B8860B" />
              </linearGradient>
              <linearGradient id="nCoat" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E8E8E8" /><stop offset="40%" stopColor="#FFFFFF" /><stop offset="80%" stopColor="#D4D4D4" /><stop offset="100%" stopColor="#A0A0A0" />
              </linearGradient>
              <radialGradient id="nTie" cx="50%" cy="0%">
                <stop offset="0%" stopColor="#D940FF" /><stop offset="100%" stopColor="#6600AA" />
              </radialGradient>
            </defs>
          </svg>

          {/* ── Prominent Doom Timer ── */}
          <div className={`doom-timer-container ${remaining < 30 ? 'doom-critical' : ''}`}>
            <div className="doom-label">SYSTEM DIVERGENCE IN</div>
            <div className="doom-time">{Math.max(0, remaining).toFixed(0)}s</div>
          </div>

          {/* ═══ BATTLE ARENA ════════════════════════════════════════════ */}
          <div
            className={`battle-arena ${arenaShaking ? 'arena-shake' : ''}`}
            style={{ filter: decayFilter, transition: 'filter 2.8s ease' }}
          >
            <JailCellBackground decay={turnIdx} />

            {/* Floating Combat Text */}
            {floatingTexts.map(ft => (
              <div key={ft.id} className={`floating-text ${ft.type} float-${ft.target}`}>
                {ft.text}
              </div>
            ))}

            {/* Chromatic aberration */}
            {chromaShift > 0 && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9,
                boxShadow: `inset ${chromaShift}px 0 0 rgba(255,0,50,0.14), inset -${chromaShift}px 0 0 rgba(0,50,255,0.14)`,
              }} />
            )}

            {/* Hit flash */}
            {showHitFlash && <div className="hit-flash" />}

            {/* Impact bursts */}
            {showImpact && <div className="impact-enemy" />}
            {showNImpact && <div className="impact-player" />}

            {/* ── Norden info card — top left ── */}
            <div className="info-card-pos-enemy">
              <InfoCard name="NORDEN" hp={nordenDisp} maxHp={100}
                level="∞" sub="RHETORICAL DEFENSE" isEnemy={true} />
            </div>

            {/* ── Norden sprite — top right, feet on far mound ── */}
            <div className="unit-container unit-enemy">
              <div className="sprite-idle-a">
                <NordenSprite decay={turnIdx} hit={nordenHit} nordenAttacking={nordenAttack} />
              </div>
            </div>

            {/* ── General sprite — bottom left, feet on near mound ── */}
            <div className="unit-container unit-player">
              <div className="sprite-idle-b">
                <GeneralSprite decay={turnIdx} attacking={attacking} hit={generalHit} />
              </div>
            </div>

            {/* ── General info card — bottom right ── */}
            <div className="info-card-pos-player">
              <InfoCard name="GENERAL" hp={generalDisp} maxHp={100}
                level="7" sub="COMMAND INTEGRITY" isEnemy={false} />
            </div>

            {/* Turn badge */}
            <div className="arena-badge">TURN {Math.min(turnIdx + 1, 5)}/5</div>
          </div>

          {/* ═══ DIVERGENCE GRAPH ════════════════════════════════════════ */}
          <DivergenceGraph turnIdx={turnIdx} elapsed={elapsed} crashed={crashed} />

          {/* ═══ BATTLE UI ═══════════════════════════════════════════════ */}
          <div className="battle-ui">

            {/* LEFT — Dialogue box */}
            <div className="dialogue-panel">
              <div className="dialogue-who">{displayReq.speaker ? `[ ${displayReq.speaker} ]` : ''}</div>
              <div className="typewriter-text" style={{ filter: iBlur }}>
                {typedText}
                {!typeComplete && targetLen > 0 && (
                  <span className="typewriter-cursor">▋</span>
                )}
              </div>
              {typeComplete && !isInBattle && (
                <div className="dialogue-arrow">▼</div>
              )}
              <div className="battle-announce">
                {TURNS[Math.min(turnIdx, 4)]?.announce}
              </div>
            </div>

            {/* RIGHT — Move selection */}
            <div className="move-panel">
              <div className="move-panel-header">
                <span className="move-panel-label">
                  {isInBattle
                    ? (nordenAttack ? 'NORDEN counters...' : '...')
                    : usedMoves.length < MOVES.length
                      ? `What will GENERAL do?${roundLabel}`
                      : 'Regrouping...'}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="move-panel-score">
                    {score.general > 0 || score.norden > 0
                      ? `W:${score.general} L:${score.norden}` : ''}
                  </span>
                </div>
              </div>
              <div className="move-grid">
                {MOVES.map((mv) => {
                  const used = usedMoves.includes(mv.slot);
                  const disabled = crashed || isInBattle || used;
                  return (
                    <button
                      key={mv.slot}
                      className={`move-btn ${used ? 'used' : ''}`}
                      disabled={disabled}
                      onClick={() => handleMove(mv)}
                    >
                      <span className="move-label">
                        {used ? '▓ ' : '► '}{mv.label}
                      </span>
                      <span
                        className="move-type"
                        style={!used ? { color: TYPE_COLORS[mv.type] } : {}}
                      >
                        {mv.type} — {mv.dmg} PWR
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ═══ FOOTER ══════════════════════════════════════════════════ */}
          <div className="battle-footer">
            <span>SA Task 1B — HCD Program</span>
            <span>Based on Clarke's "Superiority" (1951)</span>
            <span>DIVERGENCE SIM v6.0</span>
          </div>
        </div>
      )}
    </>
  );
}
