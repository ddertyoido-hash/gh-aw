// Ball flight model for a 40 mm table tennis ball.
//
// Built on real numbers: a 2.7 g ball in 1.225 kg/m³ air with Cd 0.40 (terminal
// velocity ≈ 9 m/s, which is what a real ball does) and a lift coefficient that
// grows with the spin ratio, so topspin genuinely dips and backspin genuinely
// floats. Table contacts use the rigid-sphere impulse solution, so a topspin ball
// kicks forward off the bounce while the spin bleeds away.
//
// Everything here is plain maths on {x, y, z} objects, so the whole model also
// runs under Node for offline trajectory checks (see tools/verify-physics.mjs).
import { v3, add, addScaled, scale, cross, len, norm } from './vec3.js';

/* -------------------------------------------------------------------- table */
export const BALL_R = 0.02;
export const BALL_M = 0.0027;
export const G = 9.81;

export const TABLE = { halfW: 0.7625, halfL: 1.37, top: 0.76, thick: 0.018 };
export const NET = { h: 0.1525, over: 0.1525 };
export const TABLE_Y = TABLE.top + BALL_R;

// Paddle planes: the ball is struck as it crosses one of these.
export const PLAY_Z = 1.62;
export const OPP_Z = -1.62;
export const MISS_Z = 2.5;

// Court reach limits for a paddle (centre of the blade).
export const REACH_X = 1.06;
export const REACH_Y = [0.78, 1.42];

const RHO = 1.225;
const CD = 0.4;
const AREA = Math.PI * BALL_R * BALL_R;
const K_DRAG = (0.5 * RHO * CD * AREA) / BALL_M;
const K_MAGNUS = (0.5 * RHO * AREA) / BALL_M;
const E_TABLE = 0.88;
const MU_TABLE = 0.25;
const E_FLOOR = 0.7;
const SPIN_TAU = 3.0;

/* -------------------------------------------------------------- integration */
export function accel(v, w) {
  const speed = len(v);
  if (speed < 1e-4) return v3(0, -G, 0);
  let a = addScaled(v3(0, -G, 0), v, -K_DRAG * speed);
  const spin = len(w);
  if (spin > 1e-4) {
    const ratio = (spin * BALL_R) / speed;
    const lift = Math.min(0.62, 0.72 * ratio);
    const dir = norm(cross(w, v));
    if (len(dir) > 1e-6) a = addScaled(a, dir, K_MAGNUS * lift * speed * speed);
  }
  return a;
}

/** Advance a ball one step (semi-implicit Euler; 200-240 Hz is plenty). */
export function step(b, dt) {
  b.v = addScaled(b.v, accel(b.v, b.w), dt);
  b.p = addScaled(b.p, b.v, dt);
  b.w = scale(b.w, Math.exp(-dt / SPIN_TAU));
}

export const makeBall = (p = v3(0, TABLE_Y, 1), v = v3(), w = v3()) => ({
  p: { ...p },
  v: { ...v },
  w: { ...w },
});

export const withinTable = (p) =>
  Math.abs(p.x) <= TABLE.halfW + 0.012 && Math.abs(p.z) <= TABLE.halfL + 0.012;

/* ----------------------------------------------------------------- contacts */
/**
 * Table top contact. `prevY` (optional) is the ball's height before the step so a
 * fast ball cannot tunnel through the surface in a single frame.
 */
export function resolveTable(b, prevY = null) {
  if (b.v.y >= 0) return null;
  const bottom = b.p.y - BALL_R;
  const crossed = prevY !== null && prevY - BALL_R > TABLE.top && bottom <= TABLE.top;
  if (!crossed && (bottom > TABLE.top || b.p.y < TABLE.top - 0.12)) return null;
  if (!withinTable(b.p)) return null;

  b.p.y = TABLE.top + BALL_R;
  const Jn = (1 + E_TABLE) * BALL_M * -b.v.y;
  b.v.y = -b.v.y * E_TABLE;

  // Velocity of the material point of the ball that touches the table.
  const contact = v3(0, -BALL_R, 0);
  const swing = cross(b.w, contact);
  const u = { x: b.v.x + swing.x, y: 0, z: b.v.z + swing.z };
  const um = Math.hypot(u.x, u.z);
  if (um > 1e-6) {
    const stick = (2 * BALL_M * um) / 7;
    const slide = MU_TABLE * Jn;
    const Jt = Math.min(stick, slide);
    const jx = (-u.x / um) * Jt;
    const jz = (-u.z / um) * Jt;
    b.v.x += jx / BALL_M;
    b.v.z += jz / BALL_M;
    const I = 0.4 * BALL_M * BALL_R * BALL_R;
    b.w = add(b.w, scale(cross(contact, v3(jx, 0, jz)), 1 / I));
  }
  return { p: { ...b.p }, speed: len(b.v), spin: len(b.w) };
}

/** Net contact. `prevZ` is the ball's z before the step, used to detect crossing. */
export function resolveNet(b, prevZ) {
  if ((prevZ > 0) === (b.p.z > 0)) return false;
  if (b.p.y - BALL_R > TABLE.top + NET.h) return false;
  if (Math.abs(b.p.x) > TABLE.halfW + NET.over) return false;

  b.p.z = prevZ > 0 ? 0.025 : -0.025;
  b.v.z *= -0.22;
  b.v.x *= 0.45;
  b.v.y *= 0.35;
  b.w = scale(b.w, 0.3);
  return true;
}

export function resolveFloor(b) {
  if (b.v.y >= 0 || b.p.y - BALL_R > 0) return null;
  b.p.y = BALL_R;
  b.v.y = -b.v.y * E_FLOOR;
  b.v.x *= 0.8;
  b.v.z *= 0.8;
  b.w = scale(b.w, 0.7);
  return { p: { ...b.p } };
}

/** Step the ball and report whatever it touched, in the order it would touch it. */
export function advance(b, dt) {
  const prev = { x: b.p.x, y: b.p.y, z: b.p.z };
  step(b, dt);
  const ev = { net: false, table: null, floor: null };
  if (resolveNet(b, prev.z)) {
    ev.net = true;
    return ev;
  }
  const hit = resolveTable(b, prev.y);
  if (hit) {
    ev.table = hit;
    return ev;
  }
  ev.floor = resolveFloor(b);
  return ev;
}

/* ------------------------------------------------------------- trajectories */
/**
 * Advances a throw-away ball until something decisive happens.
 * Result types: net | bounce | floor | out | timeout.
 */
export function trace(from, vel, spin = v3(), { maxT = 3, dt = 1 / 220 } = {}) {
  const b = { p: { ...from }, v: { ...vel }, w: { ...spin } };
  let t = 0;
  while (t < maxT) {
    const ev = advance(b, dt);
    t += dt;
    if (ev.net) return { type: 'net', t, p: { ...b.p }, b };
    if (ev.table) {
      return {
        type: 'bounce',
        inBounds: Math.abs(ev.table.p.x) <= TABLE.halfW && Math.abs(ev.table.p.z) <= TABLE.halfL,
        t,
        p: ev.table.p,
        b,
      };
    }
    if (ev.floor) return { type: 'floor', t, p: { ...b.p }, b };
    if (Math.abs(b.p.x) > 4 || Math.abs(b.p.z) > 4) return { type: 'out', t, p: { ...b.p }, b };
  }
  return { type: 'timeout', t, p: { ...b.p }, b };
}

/** How far along the launch direction the ball got before it landed. */
function reachAlong(from, result, aim) {
  const dx = aim.x - from.x;
  const dz = aim.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  if (result.type === 'net') return -0.25;
  if (result.type === 'timeout' || result.type === 'out') return d + 8;
  return ((result.p.x - from.x) * dx + (result.p.z - from.z) * dz) / d;
}

const SOLVE_OPTS = { maxT: 2, dt: 1 / 220 };

/**
 * Launch velocity of magnitude `speed` that makes the ball bounce ON `target`,
 * despite air drag and the ball's own spin bending the flight.
 *
 * Speed is the input (a player's power decides it) and the launch angle is solved
 * by bisection, then the aim point is re-projected twice to remove the lateral
 * drift that sidespin causes. The whole solve costs ~20 short simulations, so it
 * runs once per struck ball, never per frame.
 */
function solveAtSpeed(from, target, speed, spin, arcBias, maxAngle) {
  const aim = { x: target.x, y: target.y, z: target.z };
  let velocity = null;

  for (let pass = 0; pass < 2; pass++) {
    const dx = aim.x - from.x;
    const dz = aim.z - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-3) return velocity;
    const ux = dx / dist;
    const uz = dz / dist;
    const launch = (theta) => ({
      x: ux * speed * Math.cos(theta),
      y: speed * Math.sin(theta),
      z: uz * speed * Math.cos(theta),
    });

    let lo = 0;
    let hi = maxAngle;
    for (let i = 0; i < 11; i++) {
      const theta = (lo + hi) / 2;
      const r = trace(from, launch(theta), spin, SOLVE_OPTS);
      if (reachAlong(from, r, aim) < dist) lo = theta;
      else hi = theta;
    }

    const theta = Math.min(1.15, (lo + hi) / 2 + arcBias);
    velocity = launch(theta);
    const landed = trace(from, velocity, spin, SOLVE_OPTS);
    if (landed.type !== 'bounce') continue;
    const ex = target.x - landed.p.x;
    const ez = target.z - landed.p.z;
    if (Math.hypot(ex, ez) < 0.02) break;
    aim.x += ex;
    aim.z += ez;
  }
  return velocity;
}

/**
 * A shot the player (or the opponent) has judged: pace decides the launch speed and
 * the solver decides the angle. If that pace cannot physically reach the aim point
 * the speed is nudged until it can, so a wild swing still produces a legal ball
 * instead of a launch that flies off the end of the arena.
 */
export function solveShot({ from, target, speed, spin = v3(), arcBias = 0, maxAngle = 0.9 }) {
  let s = speed;
  let last = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const v = solveAtSpeed(from, target, s, spin, arcBias, maxAngle);
    if (!v) {
      s *= 1.2;
      continue;
    }
    last = v;
    const r = trace(from, v, spin, SOLVE_OPTS);
    if (r.type === 'bounce' && r.inBounds) return v;
    if (r.type === 'net' || r.type === 'bounce') s *= 1.15; // fell short of the aim
    else s *= 0.85; // sailed past it
  }
  return last;
}

/** Follow a served ball past its first bounce: does it clear the net and land over? */
function serveFlight(startBall, dir) {
  const b = { p: { ...startBall.p }, v: { ...startBall.v }, w: { ...startBall.w } };
  let t = 0;
  let margin = Infinity;
  while (t < 2.5) {
    const beforeZ = b.p.z;
    const beforeY = b.p.y;
    const ev = advance(b, 1 / 220);
    t += 1 / 220;
    if (ev.net) return { ok: false, margin: -1 };
    if ((beforeZ < 0) !== (b.p.z < 0)) {
      const k = -beforeZ / (b.p.z - beforeZ || 1e-9);
      const y = beforeY + (b.p.y - beforeY) * k;
      margin = Math.min(margin, y - (TABLE.top + NET.h + BALL_R));
    }
    if (ev.table) return { ok: Math.sign(ev.table.p.z) === -dir, margin, landing: ev.table.p };
    if (ev.floor) return { ok: false, margin };
  }
  return { ok: false, margin };
}

const serveLaunch = (from, aim, speed, theta) => {
  const dx = aim.x - from.x;
  const dz = aim.z - from.z;
  const d = Math.hypot(dx, dz) || 1e-3;
  return {
    x: (dx / d) * speed * Math.cos(theta),
    y: speed * Math.sin(theta),
    z: (dz / d) * speed * Math.cos(theta),
  };
};

/**
 * Serve finder. A serve has to bounce on the server's own half and then carry over
 * the net, so for a realistic launch angle this bisects the pace that drops the ball
 * on a spot on the server's own side, then keeps the first candidate whose ball
 * clears the net with a margin and lands legally past it. A serve therefore looks
 * like a serve: a short arc down onto your own half, then up and over the net.
 */
export function solveServe({ from, dir, aimX, spin = v3() }) {
  // Launch angle (rad) and how far up the server's own half the serve lands. The
  // ball has to bounce first, so the useful landings sit near the net where the
  // bounce still has room to lift the ball over it.
  const plan = [
    [0.6, 0.3],
    [0.65, 0.3],
    [0.7, 0.32],
    [0.55, 0.34],
    [0.8, 0.34],
    [0.9, 0.36],
    [0.5, 0.4],
    [1.0, 0.4],
    [0.45, 0.45],
  ];
  let best = null;
  for (const [theta, depth] of plan) {
    const aim = { x: aimX, y: TABLE_Y, z: dir * depth };
    const dist = Math.hypot(aim.x - from.x, aim.z - from.z);
    let lo = 3;
    let hi = 12;
    for (let i = 0; i < 9; i++) {
      const s = (lo + hi) / 2;
      const r = trace(from, serveLaunch(from, aim, s, theta), spin, {
        maxT: 1.6,
        dt: 1 / 220,
      });
      // Wherever the ball first came down: short of the aim means "hit it softer".
      const reach =
        r.type === 'net'
          ? -0.25
          : r.type === 'bounce' || r.type === 'floor'
            ? Math.hypot(r.p.x - from.x, r.p.z - from.z)
            : dist + 8;
      if (reach < dist) lo = s;
      else hi = s;
    }
    const velocity = serveLaunch(from, aim, (lo + hi) / 2, theta);
    const first = trace(from, velocity, spin, { maxT: 1.6, dt: 1 / 220 });
    if (first.type !== 'bounce' || !first.inBounds) continue;
    if (Math.sign(first.p.z) !== dir) continue;
    const flight = serveFlight(first.b, dir);
    if (flight.ok) {
      if (flight.margin > 0.05) return { velocity, spin: { ...spin } };
      if (!best) best = { velocity, spin: { ...spin }, margin: flight.margin };
    }
  }
  return best;
}

/** Where the ball will next cross the paddle plane at `planeZ`. */
export function predictPlane(b0, planeZ, { maxT = 3, dt = 1 / 200 } = {}) {
  const b = { p: { ...b0.p }, v: { ...b0.v }, w: { ...b0.w } };
  let t = 0;
  while (t < maxT) {
    const beforeZ = b.p.z;
    const beforeP = { ...b.p };
    const ev = advance(b, dt);
    t += dt;
    if (ev.net) return { t, net: true, p: { ...b.p } };
    if (ev.floor) return { t, floor: true, p: { ...b.p } };
    if ((beforeZ - planeZ) * (b.p.z - planeZ) < 0) {
      const k = (planeZ - beforeZ) / (b.p.z - beforeZ);
      return {
        t: t - dt * (1 - k),
        net: false,
        p: {
          x: beforeP.x + (b.p.x - beforeP.x) * k,
          y: beforeP.y + (b.p.y - beforeP.y) * k,
          z: planeZ,
        },
        v: { ...b.v },
        w: { ...b.w },
      };
    }
  }
  return null;
}

export { len };
