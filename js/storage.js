const PRESETS_KEY = "msv_presets_v1";
const CURRENT_KEY = "msv_current_v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function loadPresets() {
  return readJson(PRESETS_KEY, []);
}

export function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function upsertPreset(preset) {
  const presets = loadPresets();
  const idx = presets.findIndex((p) => p.id === preset.id);
  if (idx >= 0) presets[idx] = preset;
  else presets.push(preset);
  savePresets(presets);
  return presets;
}

export function deletePreset(id) {
  const presets = loadPresets().filter((p) => p.id !== id);
  savePresets(presets);
  return presets;
}

export function loadCurrent() {
  return readJson(CURRENT_KEY, null);
}

export function saveCurrent(streams) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(streams));
}
