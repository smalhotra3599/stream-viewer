import { computeTileLayout } from "./tiling.js";
import { createTileMedia } from "./player.js";
import {
  loadPresets,
  upsertPreset,
  deletePreset,
  loadCurrent,
  saveCurrent,
} from "./storage.js";

const el = {
  toolbar: document.getElementById("toolbar"),
  countButtons: document.getElementById("count-buttons"),
  addSlotBtn: document.getElementById("add-slot-btn"),
  toggleSetupBtn: document.getElementById("toggle-setup-btn"),
  presetSelect: document.getElementById("preset-select"),
  presetName: document.getElementById("preset-name"),
  savePresetBtn: document.getElementById("save-preset-btn"),
  deletePresetBtn: document.getElementById("delete-preset-btn"),
  fullscreenBtn: document.getElementById("fullscreen-btn"),
  setupPanel: document.getElementById("setup-panel"),
  gridContainer: document.getElementById("grid-container"),
};

const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `t_${Date.now()}_${Math.random().toString(16).slice(2)}`);

function defaultStreams(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: uid(),
    type: "hls",
    url: "",
    label: `Stream ${i + 1}`,
  }));
}

let streams = loadCurrent() || defaultStreams(6);
let focusedId = null;

// id -> { wrapper, overlayLabel, mutedBadge, media, snapshot: {type,url} }
const tiles = new Map();

function persist() {
  saveCurrent(streams);
}

// ---------- Setup panel ----------

function renderSetupPanel() {
  el.setupPanel.innerHTML = "";
  streams.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "slot-row";

    const idx = document.createElement("span");
    idx.className = "slot-index";
    idx.textContent = String(i + 1);

    const label = document.createElement("input");
    label.type = "text";
    label.className = "slot-label";
    label.value = s.label;
    label.placeholder = "Label";
    label.addEventListener("input", () => {
      s.label = label.value;
      updateTileLabel(s.id);
      persist();
    });

    const type = document.createElement("select");
    type.className = "slot-type";
    type.innerHTML = `<option value="hls">HLS (.m3u8)</option><option value="iframe">Iframe embed</option>`;
    type.value = s.type;
    type.addEventListener("change", () => {
      s.type = type.value;
      persist();
      syncTile(s);
    });

    const url = document.createElement("input");
    url.type = "text";
    url.className = "slot-url";
    url.value = s.url;
    url.placeholder = "Paste .m3u8 or embed URL";
    url.addEventListener("focus", () => url.select());
    url.addEventListener("change", () => {
      s.url = url.value.trim();
      persist();
      syncTile(s);
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "slot-remove";
    remove.textContent = "✕";
    remove.title = "Remove slot";
    remove.addEventListener("click", () => removeSlot(s.id));

    row.append(idx, label, type, url, remove);
    el.setupPanel.appendChild(row);
  });
  syncActiveCountButton();
}

function syncActiveCountButton() {
  const n = streams.length;
  el.countButtons.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.count) === n);
  });
}

// ---------- Grid / tiles ----------

function destroyTile(id) {
  const t = tiles.get(id);
  if (!t) return;
  t.media?.destroy();
  t.wrapper.remove();
  tiles.delete(id);
}

function createTile(stream) {
  const wrapper = document.createElement("div");
  wrapper.className = "tile";
  wrapper.dataset.id = stream.id;
  wrapper.draggable = true;

  let media = null;
  if (stream.url) {
    media = createTileMedia(stream);
    wrapper.appendChild(media.el);
  } else {
    const empty = document.createElement("div");
    empty.className = "tile-empty";
    empty.textContent = "No stream — add a URL below";
    wrapper.appendChild(empty);
  }

  const overlay = document.createElement("div");
  overlay.className = "tile-overlay";

  const top = document.createElement("div");
  top.className = "tile-overlay-top";
  const muteBtn = document.createElement("button");
  muteBtn.type = "button";
  muteBtn.textContent = "🔇";
  muteBtn.title = "Toggle audio focus";
  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFocus(stream.id);
  });
  top.appendChild(muteBtn);

  const labelEl = document.createElement("div");
  labelEl.className = "tile-label";
  labelEl.textContent = stream.label;

  overlay.append(top, labelEl);
  wrapper.appendChild(overlay);

  wrapper.addEventListener("click", () => toggleFocus(stream.id));

  wrapper.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", stream.id);
    e.dataTransfer.effectAllowed = "move";
  });
  wrapper.addEventListener("dragover", (e) => e.preventDefault());
  wrapper.addEventListener("drop", (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    reorder(draggedId, stream.id);
  });

  el.gridContainer.appendChild(wrapper);
  tiles.set(stream.id, {
    wrapper,
    labelEl,
    media,
    snapshot: { type: stream.type, url: stream.url },
  });
}

function syncTile(stream) {
  const t = tiles.get(stream.id);
  if (!t) return;
  const changed = t.snapshot.type !== stream.type || t.snapshot.url !== stream.url;
  if (!changed) return;

  t.media?.destroy();
  // clear previous media/empty-state node (first child before overlay)
  const old = t.wrapper.querySelector("video, iframe, .tile-empty");
  if (old) old.remove();

  if (stream.url) {
    t.media = createTileMedia(stream);
    t.wrapper.insertBefore(t.media.el, t.wrapper.firstChild);
  } else {
    t.media = null;
    const empty = document.createElement("div");
    empty.className = "tile-empty";
    empty.textContent = "No stream — add a URL below";
    t.wrapper.insertBefore(empty, t.wrapper.firstChild);
  }
  t.snapshot = { type: stream.type, url: stream.url };

  if (focusedId === stream.id) t.media?.setMuted(false);
}

function updateTileLabel(id) {
  const t = tiles.get(id);
  const s = streams.find((x) => x.id === id);
  if (t && s) t.labelEl.textContent = s.label;
}

function syncGrid() {
  const liveIds = new Set(streams.map((s) => s.id));
  for (const id of [...tiles.keys()]) {
    if (!liveIds.has(id)) destroyTile(id);
  }
  for (const s of streams) {
    if (!tiles.has(s.id)) createTile(s);
    else syncTile(s);
  }
  // reorder DOM to match streams order
  for (const s of streams) {
    el.gridContainer.appendChild(tiles.get(s.id).wrapper);
  }
  layoutGrid();
}

function layoutGrid() {
  const rect = el.gridContainer.getBoundingClientRect();
  const n = streams.length;
  if (n === 0) return;
  const layout = computeTileLayout(n, rect.width, rect.height);
  streams.forEach((s, i) => {
    const t = tiles.get(s.id);
    const r = layout.rects[i];
    if (!t || !r) return;
    t.wrapper.style.left = `${r.x}px`;
    t.wrapper.style.top = `${r.y}px`;
    t.wrapper.style.width = `${r.w}px`;
    t.wrapper.style.height = `${r.h}px`;
  });
}

new ResizeObserver(() => layoutGrid()).observe(el.gridContainer);

// ---------- Mutations ----------

function setCount(n) {
  if (n > streams.length) {
    streams = streams.concat(defaultStreams(n - streams.length).map((s, i) => ({
      ...s,
      label: `Stream ${streams.length + i + 1}`,
    })));
  } else if (n < streams.length) {
    streams = streams.slice(0, n);
  }
  persist();
  syncGrid();
  renderSetupPanel();
}

function addSlot() {
  streams.push({ id: uid(), type: "hls", url: "", label: `Stream ${streams.length + 1}` });
  persist();
  syncGrid();
  renderSetupPanel();
}

function removeSlot(id) {
  streams = streams.filter((s) => s.id !== id);
  if (focusedId === id) focusedId = null;
  persist();
  syncGrid();
  renderSetupPanel();
}

function reorder(draggedId, targetId) {
  if (draggedId === targetId) return;
  const from = streams.findIndex((s) => s.id === draggedId);
  const to = streams.findIndex((s) => s.id === targetId);
  if (from === -1 || to === -1) return;
  const [moved] = streams.splice(from, 1);
  streams.splice(to, 0, moved);
  persist();
  syncGrid();
  renderSetupPanel();
}

function toggleFocus(id) {
  focusedId = focusedId === id ? null : id;
  for (const [tid, t] of tiles) {
    const isFocused = tid === focusedId;
    t.wrapper.classList.toggle("focused", isFocused);
    t.media?.setMuted(!isFocused);
  }
}

// ---------- Presets ----------

function renderPresetSelect() {
  const presets = loadPresets();
  el.presetSelect.innerHTML = `<option value="">— Load a preset —</option>`;
  for (const p of presets) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    el.presetSelect.appendChild(opt);
  }
}

el.savePresetBtn.addEventListener("click", () => {
  const name = el.presetName.value.trim();
  if (!name) return;
  const presets = loadPresets();
  const existing = presets.find((p) => p.name === name);
  const preset = { id: existing ? existing.id : uid(), name, streams };
  upsertPreset(preset);
  renderPresetSelect();
  el.presetSelect.value = preset.id;
});

el.deletePresetBtn.addEventListener("click", () => {
  const id = el.presetSelect.value;
  if (!id) return;
  deletePreset(id);
  renderPresetSelect();
  el.presetName.value = "";
});

el.presetSelect.addEventListener("change", () => {
  const id = el.presetSelect.value;
  if (!id) return;
  const preset = loadPresets().find((p) => p.id === id);
  if (!preset) return;
  streams = preset.streams.map((s) => ({ ...s, id: uid() }));
  focusedId = null;
  el.presetName.value = preset.name;
  persist();
  syncGrid();
  renderSetupPanel();
});

// ---------- Count buttons ----------

el.countButtons.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-count]");
  if (!btn) return;
  setCount(Number(btn.dataset.count));
});

el.addSlotBtn.addEventListener("click", addSlot);

// ---------- Setup panel collapse ----------

const SETUP_COLLAPSED_KEY = "msv_setup_collapsed_v1";

function setSetupCollapsed(collapsed) {
  el.setupPanel.classList.toggle("collapsed", collapsed);
  el.toggleSetupBtn.textContent = collapsed ? "▸ Show URLs" : "▾ Hide URLs";
  localStorage.setItem(SETUP_COLLAPSED_KEY, collapsed ? "1" : "0");
  requestAnimationFrame(layoutGrid);
}

el.toggleSetupBtn.addEventListener("click", () => {
  setSetupCollapsed(!el.setupPanel.classList.contains("collapsed"));
});

setSetupCollapsed(localStorage.getItem(SETUP_COLLAPSED_KEY) === "1");

// ---------- Full screen ----------

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

el.fullscreenBtn.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
  // grid container size changes when chrome (toolbar/setup panel) hides/shows
  requestAnimationFrame(layoutGrid);
});

// ---------- Keyboard shortcuts ----------

document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

  if (e.key === "f" || e.key === "F") {
    toggleFullscreen();
  } else if (e.key >= "1" && e.key <= "9") {
    const idx = Number(e.key) - 1;
    if (streams[idx]) toggleFocus(streams[idx].id);
  } else if (e.key === "m" || e.key === "M") {
    if (focusedId) toggleFocus(focusedId);
  }
});

// ---------- Init ----------

renderSetupPanel();
renderPresetSelect();
syncGrid();
