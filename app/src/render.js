// Vice Coast cover renderer: draws the multi-panel poster onto any 2D canvas.
// Pure drawing — no DOM, no network — so the editor preview and the PNG export
// share exactly the same picture. Layouts, grades and lettering are all defined
// here; the editor only keeps state and hands it over.

export const LAYOUTS = [
  { id: 'hero', name: 'Hero + 3', panels: 4 },
  { id: 'grid', name: 'Four Square', panels: 4 },
  { id: 'trio', name: 'Triple Strip', panels: 3 },
  { id: 'full', name: 'Full Bleed', panels: 1 },
  { id: 'tilt', name: 'Tilted Snaps', panels: 2 },
];

export const GRADES = [
  { id: 'sunset', name: 'Vice Sunset', swatch: 'linear-gradient(135deg,#ff9a3d,#ff2e88)' },
  { id: 'neon', name: 'Neon Nights', swatch: 'linear-gradient(135deg,#19e3d6,#ff2e88)' },
  { id: 'gold', name: 'Golden Hour', swatch: 'linear-gradient(135deg,#ffd76a,#ff7a1a)' },
  { id: 'noir', name: 'Palm Noir', swatch: 'linear-gradient(135deg,#e8e8e8,#333)' },
  { id: 'raw', name: 'No Grade', swatch: 'linear-gradient(135deg,#888,#444)' },
];

export const SIZES = [
  { id: '1080x1080', name: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  { id: '1080x1350', name: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  { id: '1920x1080', name: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
];

const FRAME = '#f7f1e6'; // warm poster paper
const INK = '#160a24';   // deep plum, the poster's dark

/** Panel rectangles for a layout, as fractions of the cover, gutters included. */
export function panelSlots(layoutId, W, H) {
  const g = Math.round(Math.min(W, H) * 0.012); // gutter
  const m = Math.round(Math.min(W, H) * 0.022); // outer frame
  const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
  const w = x1 - x0, h = y1 - y0;
  switch (layoutId) {
    case 'hero': {
      const heroW = Math.round(w * 0.6);
      const sideX = x0 + heroW + g, sideW = x1 - sideX;
      const third = Math.floor((h - 2 * g) / 3);
      return [
        { x: x0, y: y0, w: heroW, h },
        { x: sideX, y: y0, w: sideW, h: third },
        { x: sideX, y: y0 + third + g, w: sideW, h: third },
        { x: sideX, y: y0 + 2 * (third + g), w: sideW, h: h - 2 * (third + g) },
      ];
    }
    case 'grid': {
      const cw = Math.floor((w - g) / 2), ch = Math.floor((h - g) / 2);
      return [
        { x: x0, y: y0, w: cw, h: ch },
        { x: x0 + cw + g, y: y0, w: w - cw - g, h: ch },
        { x: x0, y: y0 + ch + g, w: cw, h: h - ch - g },
        { x: x0 + cw + g, y: y0 + ch + g, w: w - cw - g, h: h - ch - g },
      ];
    }
    case 'trio': {
      const cw = Math.floor((w - 2 * g) / 3);
      return [
        { x: x0, y: y0, w: cw, h },
        { x: x0 + cw + g, y: y0, w: cw, h },
        { x: x0 + 2 * (cw + g), y: y0, w: w - 2 * (cw + g), h },
      ];
    }
    case 'tilt': {
      const pw = Math.round(w * 0.52), ph = Math.round(h * 0.58);
      return [
        { x: x0 + Math.round(w * 0.06), y: y0 + Math.round(h * 0.10), w: pw, h: ph, rot: -0.055 },
        { x: x1 - pw - Math.round(w * 0.05), y: y0 + Math.round(h * 0.30), w: pw, h: ph, rot: 0.05 },
      ];
    }
    case 'full':
    default:
      return [{ x: x0, y: y0, w, h }];
  }
}

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  const c = document.createElement('canvas');
  c.width = 140; c.height = 140;
  const nctx = c.getContext('2d');
  const img = nctx.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  noiseTile = c;
  return noiseTile;
}

/** Draws one photo into a rectangle, cover-fit, with the panel's zoom and focus point. */
function drawPhotoInto(ctx, img, rect, panel) {
  const zoom = panel?.zoom ?? 1;
  const fx = panel?.fx ?? 0.5, fy = panel?.fy ?? 0.5;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const dw = img.naturalWidth * base * zoom;
  const dh = img.naturalHeight * base * zoom;
  let dx = rect.x + rect.w / 2 - dw * fx;
  let dy = rect.y + rect.h / 2 - dh * fy;
  dx = Math.min(rect.x, Math.max(rect.x + rect.w - dw, dx));
  dy = Math.min(rect.y, Math.max(rect.y + rect.h - dh, dy));
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Paints a colour grade over a rectangle with blend modes. */
function paintGrade(ctx, rect, gradeId) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (gradeId === 'sunset') {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, 'rgba(255, 154, 61, 0.34)');
    g.addColorStop(0.55, 'rgba(255, 46, 136, 0.22)');
    g.addColorStop(1, 'rgba(90, 20, 140, 0.34)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255, 120, 40, 0.5)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else if (gradeId === 'neon') {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    g.addColorStop(0, 'rgba(25, 227, 214, 0.30)');
    g.addColorStop(1, 'rgba(255, 46, 136, 0.34)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(20, 10, 60, 0.22)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else if (gradeId === 'gold') {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255, 190, 60, 0.75)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, 'rgba(255, 220, 120, 0.20)');
    g.addColorStop(1, 'rgba(255, 110, 20, 0.30)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else if (gradeId === 'noir') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

/** Retro synthwave sky for the tilted-snaps layout: gradient, sun disc, scanlines. */
function paintSky(ctx, W, H) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1b0b3b');
  sky.addColorStop(0.42, '#7b1e6e');
  sky.addColorStop(0.68, '#ff2e88');
  sky.addColorStop(1, '#ff9a3d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const cx = W * 0.5, cy = H * 0.42, r = Math.min(W, H) * 0.2;
  const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  sun.addColorStop(0, '#ffe98a');
  sun.addColorStop(0.6, '#ffb347');
  sun.addColorStop(1, '#ff5e78');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(27, 11, 59, 0.55)';
  const gap = r * 0.16;
  for (let i = 0; i < 5; i++) {
    const y = cy + r * 0.12 + i * gap;
    ctx.fillRect(cx - r, y, r * 2, gap * (0.22 + i * 0.12));
  }
}

/** Fits a one-line title across a width by shrinking the font until it fits. */
function fittedFont(ctx, text, family, startPx, maxW, weight = '') {
  let px = startPx;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > 14 && ctx.measureText(text).width > maxW) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

function drawCaptionBlock(ctx, state, W, H, slots) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const badge = (state.badge || '').trim().toUpperCase();
  const pad = Math.round(Math.min(W, H) * 0.045);
  const bandH = Math.round(H * 0.24);
  const bandY = H - bandH;

  // Dark legibility band rising from the foot.
  const band = ctx.createLinearGradient(0, bandY - bandH * 0.4, 0, H);
  band.addColorStop(0, 'rgba(10, 4, 20, 0)');
  band.addColorStop(1, 'rgba(10, 4, 20, 0.82)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY - bandH * 0.4, W, bandH + bandH * 0.4);

  // Badge pill, top left.
  if (badge) {
    const fs = Math.max(13, Math.round(W * 0.016));
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    const tw = ctx.measureText(badge).width;
    const bx = pad, by = pad, bw = tw + fs * 1.7, bh = fs * 2.1;
    ctx.fillStyle = 'rgba(10, 4, 20, 0.72)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 200, 87, 0.9)';
    ctx.lineWidth = Math.max(1, W * 0.0012);
    ctx.stroke();
    ctx.fillStyle = '#ffc857';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, bx + fs * 0.85, by + bh / 2 + 1);
  }

  // Neon script subtitle, tilted, glowing pink, clear above the title block.
  if (subtitle) {
    const px = fittedFont(ctx, subtitle, 'Pacifico, cursive', Math.round(W * 0.048), W - pad * 2);
    ctx.save();
    ctx.translate(pad + 6, H - Math.round(H * 0.205));
    ctx.rotate(-0.045);
    ctx.font = `${px}px Pacifico, cursive`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = px * 0.55;
    ctx.fillStyle = '#ffd7ec';
    ctx.fillText(subtitle, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Big condensed title with a warm gradient fill and a dark outline.
  if (title) {
    const maxW = W - pad * 2;
    const px = fittedFont(ctx, title, 'Anton, sans-serif', Math.round(W * 0.115), maxW);
    const grad = ctx.createLinearGradient(0, H - Math.round(H * 0.13), 0, H - Math.round(H * 0.02));
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#ffd9a0');
    ctx.font = `${px}px Anton, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(22, 10, 36, 0.9)';
    ctx.lineWidth = Math.max(2, px * 0.07);
    const ty = H - Math.round(H * 0.035);
    ctx.strokeText(title, pad, ty);
    ctx.fillStyle = grad;
    ctx.fillText(title, pad, ty);
  }
}

/**
 * Draws the whole cover onto `canvas` (sized to W x H by the caller).
 * `state` holds layout, grade, title, subtitle, badge, grain, frame, photos and
 * per-slot panel crops. `opts.highlight` marks one slot in the live preview.
 */
export function drawCover(canvas, state, W, H, opts = {}) {
  const ctx = canvas.getContext('2d');
  const slots = panelSlots(state.layout, W, H);
  const frameOn = state.frame !== false;

  ctx.clearRect(0, 0, W, H);
  if (state.layout === 'tilt') {
    paintSky(ctx, W, H);
  } else {
    ctx.fillStyle = '#241233';
    ctx.fillRect(0, 0, W, H);
  }
  if (frameOn) {
    ctx.fillStyle = FRAME;
    ctx.fillRect(0, 0, W, H);
    if (state.layout === 'tilt') {
      // Sky fills the frame's inner area, not from the canvas origin.
      const m = Math.round(Math.min(W, H) * 0.022);
      ctx.save();
      ctx.translate(m, m);
      paintSky(ctx, W - 2 * m, H - 2 * m);
      ctx.restore();
    }
  }

  const gutter = Math.round(Math.min(W, H) * 0.012);
  slots.forEach((slot, i) => {
    const panel = state.panels?.[i];
    const img = panel && panel.photo != null ? state.photos[panel.photo]?.img : null;
    ctx.save();
    // Move the origin to the slot's top-left corner, then rotate around its
    // centre for tilted snapshots — every slot draws in its own local space.
    ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
    if (slot.rot) ctx.rotate(slot.rot);
    ctx.translate(-slot.w / 2, -slot.h / 2);
    // Snapshot-style white border for tilted snaps, thin dark seam otherwise.
    if (state.layout === 'tilt') {
      ctx.fillStyle = '#fdfaf3';
      ctx.fillRect(-gutter * 0.9, -gutter * 0.9, slot.w + gutter * 1.8, slot.h + gutter * 1.8);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Math.round(W * 0.02);
      ctx.shadowOffsetY = Math.round(W * 0.008);
    }
    ctx.beginPath();
    ctx.rect(0, 0, slot.w, slot.h);
    ctx.clip();
    if (img) {
      drawPhotoInto(ctx, img, { x: 0, y: 0, w: slot.w, h: slot.h }, panel);
      paintGrade(ctx, { x: 0, y: 0, w: slot.w, h: slot.h }, state.grade);
    } else {
      const empty = ctx.createLinearGradient(0, 0, slot.w, slot.h);
      empty.addColorStop(0, '#3a2154');
      empty.addColorStop(1, '#1c0e2e');
      ctx.fillStyle = empty;
      ctx.fillRect(0, 0, slot.w, slot.h);
      ctx.fillStyle = 'rgba(244, 238, 247, 0.55)';
      ctx.font = `600 ${Math.max(13, Math.round(slot.w * 0.045))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Add a photo', slot.w / 2, slot.h / 2);
    }
    ctx.restore();

    // Selected-panel marker, preview only.
    if (opts.highlight === i && !opts.forExport) {
      ctx.save();
      ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
      if (slot.rot) ctx.rotate(slot.rot);
      ctx.translate(-slot.w / 2, -slot.h / 2);
      ctx.strokeStyle = '#ffc857';
      ctx.lineWidth = Math.max(3, Math.round(W * 0.004));
      ctx.setLineDash([Math.round(W * 0.012), Math.round(W * 0.008)]);
      ctx.strokeRect(2, 2, slot.w - 4, slot.h - 4);
      ctx.restore();
    }
  });

  drawCaptionBlock(ctx, state, W, H, slots);

  // Vignette + grain over everything, export included.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10, 4, 20, 0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  if (state.grain !== false) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  return slots;
}
