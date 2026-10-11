// Minimal 3D vector helpers operating on plain {x, y, z} objects.
// Kept dependency-free so the physics module also runs under Node for offline
// trajectory checks (see tools/verify-physics.mjs).
export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const addScaled = (a, b, s) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const scaleTo = (a, l) => {
  const n = Math.hypot(a.x, a.y, a.z);
  return n > 1e-9 ? scale(a, l / n) : v3();
};
export const norm = (a) => {
  const n = Math.hypot(a.x, a.y, a.z);
  return n > 1e-9 ? scale(a, 1 / n) : v3();
};
export const lerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
