export const LEGACY_WAVE_ID = "wave-legacy";
export const getEntryWaveId = (entry) => entry?.waveId || LEGACY_WAVE_ID;

export const normalizeWaves = (sourceDeck, rawWaves = []) => {
  const ids = [...new Set(sourceDeck.map(getEntryWaveId))];
  return ids.map((id, index) => {
    const saved = Array.isArray(rawWaves) ? rawWaves.find((wave) => wave?.id === id) : null;
    return {
      id,
      name: typeof saved?.name === "string" && saved.name.trim() ? saved.name.trim() : `W${index + 1}`,
      status: saved?.status === "cold" ? "cold" : "active",
      createdAt: Number.isSafeInteger(saved?.createdAt) && saved.createdAt >= 0 ? saved.createdAt : null,
    };
  });
};

export const createWave = (waves, name, now = Date.now()) => {
  let suffix = 0;
  let id = `wave-${now.toString(36)}`;
  while (waves.some((wave) => wave.id === id)) id = `wave-${now.toString(36)}-${++suffix}`;
  return { id, name: String(name ?? "").trim() || `W${waves.length + 1}`, status: "active", createdAt: now };
};
