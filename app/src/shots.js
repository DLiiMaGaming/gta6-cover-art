// Fixed scenes for screenshots: ?shot=cover shows the exported cover alone,
// ?shot=editor shows the workbench with sample photos loaded. Query knobs:
// layout, grade, size (1080x1080 | 1080x1350 | 1920x1080), photo, photo2,
// caption (title), subtitle, badge. &selftest=1 also renders every export size
// offscreen and records the PNG byte counts on window.__selftest, so a headless
// run can prove the export path works without a download.

import { SIZES, drawCover } from './render.js';

window.addEventListener('error', (ev) => {
  const box = document.getElementById('shotErrors');
  if (box) {
    box.hidden = false;
    box.textContent += `PAGE ERROR: ${ev.message}\n`;
  }
});

function pickSize(params) {
  return SIZES.find((s) => s.id === params.get('size')) ?? SIZES[0];
}

function applyCaption(params, state) {
  const title = params.get('caption');
  if (title != null) state.title = title;
  const subtitle = params.get('subtitle');
  if (subtitle != null) state.subtitle = subtitle;
  const badge = params.get('badge');
  if (badge != null) state.badge = badge;
  const layout = params.get('layout');
  if (layout) state.layout = layout;
  const grade = params.get('grade');
  if (grade) state.grade = grade;
  const titleInput = document.getElementById('titleInput');
  if (titleInput) titleInput.value = state.title;
  const subtitleInput = document.getElementById('subtitleInput');
  if (subtitleInput) subtitleInput.value = state.subtitle;
  const badgeInput = document.getElementById('badgeInput');
  if (badgeInput) badgeInput.value = state.badge;
}

async function loadNamed(state, name) {
  const img = await window.__viceCoast.loadImage(`samples/${name}.jpg`);
  state.photos.push({ img, name: `${name}.jpg`, url: `samples/${name}.jpg` });
  return state.photos.length - 1;
}

function spreadPhotos(state) {
  // Round-robin through the tray so neighbouring panels show different
  // photos. The hero focus sits high (fy 0.3) so a portrait photo keeps its
  // subject's head inside a wide hero panel instead of cropping it away.
  state.panels.forEach((p, i) => {
    if (!state.photos.length) return;
    p.photo = i % state.photos.length;
    p.zoom = 1; p.fx = 0.5; p.fy = i === 0 ? 0.3 : 0.5;
  });
}

function markReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

async function runSelfTest(state) {
  const results = {};
  for (const size of SIZES) {
    const out = document.createElement('canvas');
    out.width = size.w;
    out.height = size.h;
    drawCover(out, state, size.w, size.h, { forExport: true });
    const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
    results[size.id] = blob ? blob.size : -1;
  }
  window.__selftest = results;
  const box = document.getElementById('shotErrors');
  if (box) {
    box.hidden = false;
    box.textContent += `SELFTEST: ${JSON.stringify(results)}\n`;
  }
}

export async function runShotScene(shot, params, state, ui) {
  try {
    applyCaption(params, state);
    state.size = pickSize(params).id;
    await loadNamed(state, params.get('photo') ?? 'pier');
    const second = params.get('photo2');
    if (second) await loadNamed(state, second);
    state.trayPick = 0;
    ui.renderTray();
    spreadPhotos(state);

    if (shot === 'cover') {
      document.body.classList.add('shot-cover');
      const size = pickSize(params);
      const canvas = document.getElementById('stage');
      canvas.width = size.w;
      canvas.height = size.h;
      drawCover(canvas, state, size.w, size.h, { forExport: true });
      document.getElementById('stageEmpty').style.display = 'none';
    } else {
      ui.refreshPanelLabel();
      ui.repaint();
    }
    if (params.get('selftest') === '1') await runSelfTest(state);
    markReady();
  } catch (err) {
    const box = document.getElementById('shotErrors');
    if (box) {
      box.hidden = false;
      box.textContent += `SHOT FAILED: ${err.message}\n`;
    }
    window.__shotReady = true;
  }
}
