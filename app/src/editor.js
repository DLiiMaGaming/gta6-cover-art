// Vice Coast Cover Lab — editor wiring: photos, panels, caption, export.
// Keeps one `coverState`, redraws the preview canvas on every change, and hands
// the same state to render.js for both the live preview and the PNG export.

import { LAYOUTS, GRADES, SIZES, panelSlots, drawCover } from './render.js';
import { runShotScene } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const PREVIEW_MAX = 900;

const coverState = {
  layout: 'hero',
  grade: 'sunset',
  size: '1080x1080',
  title: 'VICE COAST',
  subtitle: 'Sunset Heist',
  badge: 'LEONIDA • EST. 2026',
  grain: true,
  frame: true,
  photos: [], // { img, name, url }
  panels: [], // { photo: index|null, zoom, fx, fy } — one per layout slot
  selected: -1,
  trayPick: -1,
};

function slotCount() {
  return LAYOUTS.find((l) => l.id === coverState.layout).panels;
}

function resizePanels() {
  const n = slotCount();
  const kept = coverState.panels.slice(0, n);
  while (kept.length < n) kept.push({ photo: null, zoom: 1, fx: 0.5, fy: 0.5 });
  coverState.panels = kept;
  if (coverState.selected >= n) coverState.selected = -1;
}

function currentSize() {
  return SIZES.find((s) => s.id === coverState.size);
}

/** Sizes the preview canvas to the export aspect and repaints the cover. */
function repaint() {
  const { w, h } = currentSize();
  const scale = Math.min(1, PREVIEW_MAX / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const slots = drawCover(canvas, coverState, canvas.width, canvas.height, {
    highlight: coverState.selected,
  });
  $('stageSize').textContent = `${w} × ${h}`;
  $('stageEmpty').style.display = coverState.photos.length ? 'none' : 'grid';
  return slots;
}

function refreshPanelLabel() {
  const i = coverState.selected;
  const label = $('panelLabel');
  const zoom = $('zoomSlider');
  const centre = $('centerBtn');
  const clear = $('clearPanelBtn');
  if (i < 0) {
    label.textContent = 'No panel selected yet — click a panel on the cover.';
    zoom.disabled = true; centre.disabled = true; clear.disabled = true;
    return;
  }
  const panel = coverState.panels[i];
  const photo = panel.photo != null ? coverState.photos[panel.photo] : null;
  label.textContent = photo
    ? `Panel ${i + 1} — ${photo.name} · zoom ${panel.zoom.toFixed(2)}×`
    : `Panel ${i + 1} — empty. Pick a photo in the tray, then click this panel.`;
  zoom.disabled = panel.photo == null;
  zoom.value = String(panel.zoom);
  centre.disabled = panel.photo == null;
  clear.disabled = panel.photo == null;
}

function renderTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  coverState.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb' + (coverState.trayPick === i ? ' on' : '');
    btn.title = photo.name;
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.name;
    btn.appendChild(img);
    const x = document.createElement('span');
    x.className = 'x';
    x.textContent = '×';
    x.title = 'Remove this photo';
    x.addEventListener('click', (ev) => {
      ev.stopPropagation();
      removePhoto(i);
    });
    btn.appendChild(x);
    btn.addEventListener('click', () => {
      coverState.trayPick = i;
      renderTray();
    });
    tray.appendChild(btn);
  });
}

function removePhoto(i) {
  const gone = coverState.photos[i];
  if (gone && gone.url.startsWith('blob:')) URL.revokeObjectURL(gone.url);
  coverState.photos.splice(i, 1);
  coverState.panels.forEach((p) => {
    if (p.photo === i) p.photo = null;
    else if (p.photo != null && p.photo > i) p.photo -= 1;
  });
  if (coverState.trayPick === i) coverState.trayPick = -1;
  else if (coverState.trayPick > i) coverState.trayPick -= 1;
  renderTray();
  refreshPanelLabel();
  repaint();
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + url));
    img.src = url;
  });
}

async function addPhotoFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    coverState.photos.push({ img, name: file.name, url });
    coverState.trayPick = coverState.photos.length - 1;
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('Could not read ' + file.name);
  }
}

async function addSamplePhotos() {
  for (const [name, url] of [
    ['boulevard.jpg', 'samples/boulevard.jpg'],
    ['pier.jpg', 'samples/pier.jpg'],
  ]) {
    if (coverState.photos.some((p) => p.name === name)) continue;
    const img = await loadImage(url);
    coverState.photos.push({ img, name, url });
  }
  if (coverState.trayPick < 0 && coverState.photos.length) coverState.trayPick = 0;
  renderTray();
  repaint();
}

function placeTrayPhotoIn(slot) {
  if (coverState.trayPick < 0) return false;
  coverState.panels[slot] = { photo: coverState.trayPick, zoom: 1, fx: 0.5, fy: 0.5 };
  coverState.selected = slot;
  refreshPanelLabel();
  repaint();
  return true;
}

function buildChips(container, items, current, onPick) {
  container.innerHTML = '';
  items.forEach((item) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (item.id === current ? ' on' : '');
    if (item.swatch) {
      const dot = document.createElement('span');
      dot.className = 'swatch';
      dot.style.background = item.swatch;
      b.appendChild(dot);
    }
    b.appendChild(document.createTextNode(item.name));
    b.addEventListener('click', () => {
      onPick(item.id);
      buildChips(container, items, item.id, onPick);
    });
    container.appendChild(b);
  });
}

function bindControls() {
  buildChips($('layoutRow'), LAYOUTS, coverState.layout, (id) => {
    coverState.layout = id;
    resizePanels();
    refreshPanelLabel();
    repaint();
  });
  buildChips($('gradeRow'), GRADES, coverState.grade, (id) => {
    coverState.grade = id;
    repaint();
  });
  buildChips($('sizeRow'), SIZES, coverState.size, (id) => {
    coverState.size = id;
    repaint();
  });

  $('fileInput').addEventListener('change', async (ev) => {
    const files = [...ev.target.files];
    for (const file of files) {
      try { await addPhotoFile(file); } catch (err) { console.error(err); }
    }
    ev.target.value = '';
    renderTray();
    repaint();
    if (coverState.photos.length && coverState.panels.every((p) => p.photo == null)) {
      coverState.panels.forEach((p, i) => { p.photo = Math.min(i, coverState.photos.length - 1); });
      repaint();
    }
  });
  $('sampleBtn').addEventListener('click', () => {
    addSamplePhotos().then(() => {
      if (coverState.panels.every((p) => p.photo == null) && coverState.photos.length) {
        coverState.panels.forEach((p, i) => { p.photo = Math.min(i, coverState.photos.length - 1); });
        repaint();
      }
    }).catch(console.error);
  });
  $('emptySamples').addEventListener('click', () => $('sampleBtn').click());
  $('fillAllBtn').addEventListener('click', () => {
    if (coverState.trayPick < 0) return;
    coverState.panels.forEach((p) => { p.photo = coverState.trayPick; p.zoom = 1; p.fx = 0.5; p.fy = 0.5; });
    repaint();
  });

  $('grainToggle').addEventListener('change', (ev) => { coverState.grain = ev.target.checked; repaint(); });
  $('frameToggle').addEventListener('change', (ev) => { coverState.frame = ev.target.checked; repaint(); });
  $('titleInput').addEventListener('input', (ev) => { coverState.title = ev.target.value; repaint(); });
  $('subtitleInput').addEventListener('input', (ev) => { coverState.subtitle = ev.target.value; repaint(); });
  $('badgeInput').addEventListener('input', (ev) => { coverState.badge = ev.target.value; repaint(); });

  $('zoomSlider').addEventListener('input', (ev) => {
    const i = coverState.selected;
    if (i < 0) return;
    coverState.panels[i].zoom = Number(ev.target.value);
    refreshPanelLabel();
    repaint();
  });
  $('centerBtn').addEventListener('click', () => {
    const i = coverState.selected;
    if (i < 0) return;
    coverState.panels[i].fx = 0.5; coverState.panels[i].fy = 0.5;
    repaint();
  });
  $('clearPanelBtn').addEventListener('click', () => {
    const i = coverState.selected;
    if (i < 0) return;
    coverState.panels[i] = { photo: null, zoom: 1, fx: 0.5, fy: 0.5 };
    refreshPanelLabel();
    repaint();
  });

  $('exportBtn').addEventListener('click', () => exportCover(currentSize()));
  $('exportAllBtn').addEventListener('click', async () => {
    for (const size of SIZES) await exportCover(size);
  });
}

// --- Pointer: click selects a panel, drag pans its photo, wheel zooms it. ---

let drag = null;

function canvasPoint(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (ev.clientX - r.left) * (canvas.width / r.width),
    y: (ev.clientY - r.top) * (canvas.height / r.height),
  };
}

function slotAt(point) {
  const slots = panelSlots(coverState.layout, canvas.width, canvas.height);
  return slots.findIndex((s) => point.x >= s.x && point.x <= s.x + s.w && point.y >= s.y && point.y <= s.y + s.h);
}

canvas.addEventListener('pointerdown', (ev) => {
  const point = canvasPoint(ev);
  const i = slotAt(point);
  if (i < 0) return;
  coverState.selected = i;
  const panel = coverState.panels[i];
  if (coverState.trayPick >= 0 && panel.photo == null) placeTrayPhotoIn(i);
  drag = { slot: i, x: point.x, y: point.y, moved: false };
  canvas.setPointerCapture(ev.pointerId);
  refreshPanelLabel();
  repaint();
});

canvas.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  const point = canvasPoint(ev);
  const panel = coverState.panels[drag.slot];
  const photo = panel.photo != null ? coverState.photos[panel.photo] : null;
  if (!photo) return;
  const dx = point.x - drag.x, dy = point.y - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  const slots = panelSlots(coverState.layout, canvas.width, canvas.height);
  const slot = slots[drag.slot];
  const base = Math.max(slot.w / photo.img.naturalWidth, slot.h / photo.img.naturalHeight);
  panel.fx = Math.min(1, Math.max(0, panel.fx - dx / (photo.img.naturalWidth * base * panel.zoom)));
  panel.fy = Math.min(1, Math.max(0, panel.fy - dy / (photo.img.naturalHeight * base * panel.zoom)));
  drag.x = point.x; drag.y = point.y;
  refreshPanelLabel();
  repaint();
});

canvas.addEventListener('pointerup', () => { drag = null; });

canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const i = coverState.selected;
  if (i < 0) return;
  const panel = coverState.panels[i];
  if (panel.photo == null) return;
  panel.zoom = Math.min(3, Math.max(1, panel.zoom * (ev.deltaY < 0 ? 1.08 : 0.93)));
  refreshPanelLabel();
  repaint();
}, { passive: false });

// Drag-and-drop photos straight onto the stage.
window.addEventListener('dragover', (ev) => ev.preventDefault());
window.addEventListener('drop', async (ev) => {
  ev.preventDefault();
  const files = [...(ev.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    try { await addPhotoFile(file); } catch (err) { console.error(err); }
  }
  renderTray();
  repaint();
});

// --- Export: the same drawCover, at full post size, saved as a PNG. ---

function exportCover(size) {
  return new Promise((resolve) => {
    const out = document.createElement('canvas');
    out.width = size.w;
    out.height = size.h;
    drawCover(out, coverState, size.w, size.h, { forExport: true });
    out.toBlob((blob) => {
      if (!blob) { resolve(null); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-coast-cover-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      $('exportStatus').textContent = `Saved vice-coast-cover-${size.w}x${size.h}.png (${(blob.size / 1024).toFixed(0)} KB)`;
      resolve(blob);
    }, 'image/png');
  });
}

// Exposed for the screenshot self-test (?shot=…&selftest=1).
window.__viceCoast = { coverState, exportCover, repaint, addSamplePhotos, loadImage };

// --- Boot: fonts first (lettering must be real Anton/Pacifico), then the scene. ---

resizePanels();
bindControls();
refreshPanelLabel();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
document.fonts.load('16px Anton').catch(() => {});
document.fonts.load('16px Pacifico').catch(() => {});
document.fonts.ready.then(() => {
  if (shot) {
    runShotScene(shot, params, coverState, { repaint, addSamplePhotos, refreshPanelLabel, renderTray });
  } else {
    repaint();
  }
});
