// Game shell: camera, input, the fixed-step loop, and the glue between the physics
// model, the match rules, the opponent and the arena.
import * as THREE from '../vendor/three.module.js';
import * as V from './vec3.js';
import {
  TABLE,
  PLAY_Z,
  OPP_Z,
  REACH_X,
  advance,
  makeBall,
  solveServe,
} from './physics.js';
import { createArena } from './arena.js';
import { playerShot, serveSpin } from './shots.js';
import { Match, Rally } from './match.js';
import { Opponent, DIFFICULTIES } from './ai.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';

const FIXED_DT = 1 / 240;
const PLAYER_REACH = 0.108;
const PADDLE_LOW = 0.79;
const PADDLE_HIGH = 1.42;
const READY_Y = 1.02;
const SWING_WINDOW = 0.07; // seconds of swipe history that counts as "the swing"

/* ------------------------------------------------------------------- set-up */
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.08, 90);
const CAMERA_HOME = new THREE.Vector3(0, 1.8, 3.22);
camera.position.copy(CAMERA_HOME);
const focus = new THREE.Vector3(0, 0.92, -0.45);
camera.lookAt(focus);

const arena = createArena({ scene, renderer });
const hud = new Hud(document);
const audio = new GameAudio();

const match = new Match('pro');
const rally = new Rally();
const opponent = new Opponent('pro');

const ball = makeBall({ x: 0, y: READY_Y, z: PLAY_Z - 0.12 });

const game = {
  phase: 'menu',
  difficulty: 'pro',
  clock: 0,
  pointTimer: 0,
  serveLock: 0,
  serveTimer: 0,
  rallyHits: 0,
  pendingOver: false,
  serveTap: null,
};

const input = {
  nx: 0,
  ny: 0,
  hasPointer: false,
  down: false,
  downAt: 0,
  moved: 0,
  swing: { x: 0, y: 0 },
  paddle: { x: 0, y: READY_Y },
};

/* --------------------------------------------------------------- serve logic */
const holdPoint = (who) => {
  const dir = who === 'player' ? 1 : -1;
  const x = who === 'player' ? input.paddle.x : opponent.paddle.x;
  return {
    x: V.clamp(x * 0.9, -REACH_X, REACH_X),
    y: READY_Y,
    z: dir > 0 ? PLAY_Z - 0.12 : OPP_Z + 0.12,
  };
};

function startServe(server) {
  game.phase = 'serve';
  game.serveLock = 0.35;
  game.rallyHits = 0;
  game.lastHitBy = null;
  rally.reset(server, true);
  if (server === 'opp') game.serveTimer = opponent.tuning.serveDelay;

  const hold = holdPoint(server);
  ball.p = { ...hold };
  ball.v = { x: 0, y: 0, z: 0 };
  ball.w = { x: 0, y: 0, z: 0 };

  hud.setServer(server, true);
  hud.setRally(0);
  if (server === 'player') hud.message('Your serve', 'Tap, or flick your bat up', 2.4);
  else hud.message('Rival serves', '', 1.6);
}

function executeServe(who) {
  if (game.phase !== 'serve') return;
  const dir = who === 'player' ? 1 : -1;
  const from = holdPoint(who);
  const sideSpin = who === 'player' ? input.swing.x * 12 : (Math.random() - 0.5) * 60;
  const aimX = V.clamp(from.x * 0.85 + sideSpin * 0.004, -0.88, 0.88);
  const spin = serveSpin(dir, sideSpin);

  let solved = solveServe({ from, dir, aimX, spin });
  if (!solved) {
    // Hard fallback: a soft lob that is always legal.
    solved = {
      velocity: { x: aimX * 0.25, y: 3.1, z: -dir * 0.9 },
      spin: { x: -dir * 40, y: 0, z: 0 },
    };
  }

  ball.p = { ...from };
  ball.v = { ...solved.velocity };
  ball.w = { ...solved.spin };
  rally.hit(who, true);
  game.lastHitBy = who;
  game.rallyHits = 1;
  game.phase = 'rally';
  audio.paddle(0.32);
  hud.clearMessage();
  hud.setServer(who, false);
  hud.setRally(1);
}

/* -------------------------------------------------------------------- points */
function endPoint(winner, reason) {
  if (game.phase !== 'rally') return;
  game.phase = 'point';
  game.pointTimer = 1.3;
  const res = match.awardPoint(winner);
  const youWon = winner === 'player';

  audio.cheer(youWon ? 0.55 + Math.min(0.5, game.rallyHits / 14) : 0.3);
  arena.crowd.cheer(youWon ? 0.9 : 0.4);
  hud.setScore(match.scores.player, match.scores.opp);
  arena.scoreboard.draw(match.scores.player, match.scores.opp, game.rallyHits);
  hud.setServer(match.server, false);
  hud.setRally(0);
  hud.message(youWon ? 'Your point' : 'Rival’s point', reason, 1.5);
  if (res.over) game.pendingOver = true;
}

/* ---------------------------------------------------------------- ball frame */
function stepBall(dt) {
  const prev = { x: ball.p.x, y: ball.p.y, z: ball.p.z };
  const prevSpeed = V.len(ball.v);
  const ev = advance(ball, dt);

  if (ev.net) {
    audio.net();
    arena.crowd.cheer(0.25);
  }

  if (ev.table) {
    audio.bounce(prevSpeed);
    const side = ev.table.p.z >= 0 ? 'player' : 'opp';
    const inBounds =
      Math.abs(ev.table.p.x) <= TABLE.halfW && Math.abs(ev.table.p.z) <= TABLE.halfL;
    const verdict = rally.bounce(side, inBounds);
    if (verdict !== 'continue') {
      endPoint(verdict, inBounds ? (side === 'player' ? 'It landed on your half' : 'It landed in') : 'Off the table');
      return;
    }
  }

  if (ev.floor) {
    audio.floor();
    endPoint(rally.lost(), 'Put away');
    return;
  }

  // Your bat.
  if (prev.z < PLAY_Z && ball.p.z >= PLAY_Z) {
    const k = (PLAY_Z - prev.z) / (ball.p.z - prev.z || 1e-9);
    const cx = prev.x + (ball.p.x - prev.x) * k;
    const cy = prev.y + (ball.p.y - prev.y) * k;
    const dist = Math.hypot(cx - input.paddle.x, cy - input.paddle.y);
    if (dist <= PLAYER_REACH) {
      const offCenter = dist / PLAYER_REACH;
      const shot = playerShot({
        from: { x: cx, y: cy, z: PLAY_Z },
        swing: input.swing,
        incomingSpeed: prevSpeed,
        offCenter,
      });
      if (shot.velocity) {
        ball.p = { x: cx, y: cy, z: PLAY_Z - 0.03 };
        ball.v = { ...shot.velocity };
        ball.w = { ...shot.spin };
        rally.hit('player');
        game.lastHitBy = 'player';
        game.rallyHits += 1;
        hud.setRally(game.rallyHits);
        audio.paddle(shot.power);
        arena.crowd.cheer(0.15 + shot.power * 0.3);
      }
    } else {
      const verdict = rally.passedReceiver('player');
      if (verdict !== 'continue') {
        endPoint(verdict, 'Past you');
        return;
      }
    }
  }

  // The rival's bat.
  if (prev.z > OPP_Z && ball.p.z <= OPP_Z) {
    const k = (OPP_Z - prev.z) / (ball.p.z - prev.z || -1e-9);
    const cx = prev.x + (ball.p.x - prev.x) * k;
    const cy = prev.y + (ball.p.y - prev.y) * k;
    const atPlane = { p: { x: cx, y: cy, z: OPP_Z }, v: { ...ball.v }, w: { ...ball.w } };
    const shot = opponent.attemptReturn(atPlane, input.paddle.x);
    if (shot && shot.velocity) {
      ball.p = { x: cx, y: cy, z: OPP_Z + 0.03 };
      ball.v = { ...shot.velocity };
      ball.w = { ...shot.spin };
      rally.hit('opp');
      game.lastHitBy = 'opp';
      game.rallyHits += 1;
      hud.setRally(game.rallyHits);
      audio.paddle(shot.power);
    } else {
      const verdict = rally.passedReceiver('opp');
      if (verdict !== 'continue') {
        endPoint(verdict, 'Past the rival');
        return;
      }
    }
  }

  if (Math.abs(ball.p.x) > 4.5 || ball.p.y > 6 || ball.p.y < -1) {
    endPoint(rally.lost(), 'Out of play');
  }
}

/* -------------------------------------------------------------------- input */
function pointerToNormalised(event) {
  const rect = canvas.getBoundingClientRect();
  const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = 1 - ((event.clientY - rect.top) / rect.height) * 2;
  return { nx: V.clamp(nx, -1.15, 1.15), ny: V.clamp(ny, -1.15, 1.15) };
}

canvas.addEventListener('pointermove', (event) => {
  const { nx, ny } = pointerToNormalised(event);
  if (input.hasPointer) {
    const now = performance.now() / 1000;
    const dt = Math.max(0.008, now - (input.lastTime || now));
    const svx = (nx - input.nx) / dt;
    const svy = (ny - input.ny) / dt;
    const blend = Math.min(1, dt / SWING_WINDOW);
    input.swing.x += (svx - input.swing.x) * blend;
    input.swing.y += (svy - input.swing.y) * blend;
    input.lastTime = now;
  }
  input.nx = nx;
  input.ny = ny;
  input.hasPointer = true;
  if (game.phase === 'serve' && game.serveLock <= 0 && match.server === 'player') {
    if (Math.hypot(input.swing.x, input.swing.y) > 3.4) executeServe('player');
  }
});

canvas.addEventListener('pointerdown', (event) => {
  audio.init();
  const { nx, ny } = pointerToNormalised(event);
  input.nx = nx;
  input.ny = ny;
  input.hasPointer = true;
  input.down = true;
  input.downAt = game.clock;
  if (game.phase === 'serve' && game.serveLock <= 0 && match.server === 'player') {
    // A serve is a tap (quick, barely any travel) or a flick — decided on release.
    game.serveTap = { at: game.clock, nx, ny };
  }
  canvas.setPointerCapture?.(event.pointerId);
});

canvas.addEventListener('pointerup', (event) => {
  input.down = false;
  canvas.releasePointerCapture?.(event.pointerId);
  const tap = game.serveTap;
  game.serveTap = null;
  if (!tap) return;
  const travel = Math.hypot(input.nx - tap.nx, input.ny - tap.ny);
  if (game.clock - tap.at < 0.4 && travel < 0.06) executeServe('player');
});

canvas.addEventListener('pointercancel', () => {
  input.down = false;
  game.serveTap = null;
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && game.phase === 'serve' && match.server === 'player') {
    event.preventDefault();
    executeServe('player');
  }
});

/* --------------------------------------------------------------------- menu */
function setDifficulty(key) {
  game.difficulty = key;
  match.reset(key);
  opponent.setDifficulty(key);
  hud.setScore(0, 0);
  arena.scoreboard.draw(0, 0, 0);
  document.querySelectorAll('#difficulty button').forEach((b) => {
    b.classList.toggle('active', b.dataset.diff === key);
  });
  hud.el.difficultyBlurb.textContent = DIFFICULTIES[key].blurb;
}

document.querySelectorAll('#difficulty button').forEach((button) => {
  button.addEventListener('click', () => {
    audio.init();
    audio.ui();
    setDifficulty(button.dataset.diff);
  });
});

function beginMatch() {
  audio.init();
  audio.startAmbience();
  hud.hideMenu();
  hud.hideResult();
  hud.setScore(0, 0);
  arena.scoreboard.draw(0, 0, 0);
  startServe(match.server);
}

hud.el.playButton.addEventListener('click', beginMatch);
hud.el.againButton.addEventListener('click', () => {
  match.reset(game.difficulty);
  opponent.reset();
  beginMatch();
});
hud.el.menuButton.addEventListener('click', () => {
  hud.hideResult();
  game.phase = 'menu';
  hud.showMenu();
});
hud.el.soundToggle.addEventListener('click', () => {
  audio.init();
  audio.setEnabled(!audio.enabled);
  if (audio.enabled) audio.startAmbience();
  hud.setSoundLabel(audio.enabled);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

/* --------------------------------------------------------------------- loop */
const spinAxis = new THREE.Vector3();
const spinQuat = new THREE.Quaternion();
let last = performance.now();
let accumulator = 0;

function step(dt) {
  game.clock += dt;
  if (game.serveLock > 0) game.serveLock -= dt;

  // Bat follows the pointer with a short lag; that lag is what makes a flick land.
  const targetX = V.clamp(input.nx * REACH_X, -REACH_X, REACH_X);
  const targetY = PADDLE_LOW + ((input.ny + 1) / 2) * (PADDLE_HIGH - PADDLE_LOW);
  const smoothing = 1 - Math.exp(-dt * 17);
  input.paddle.x += (targetX - input.paddle.x) * smoothing;
  input.paddle.y += (targetY - input.paddle.y) * smoothing;

  // Swings decay so an old flick does not count on the next ball.
  const decay = Math.exp(-dt / 0.11);
  input.swing.x *= decay;
  input.swing.y *= decay;

  opponent.think(ball, dt, input.paddle.x, game.clock);

  if (game.phase === 'serve') {
    const hold = holdPoint(match.server);
    ball.p = { ...hold };
    ball.v = { x: 0, y: 0, z: 0 };
    if (match.server === 'opp') {
      game.serveTimer -= dt;
      if (game.serveTimer <= 0) executeServe('opp');
    }
  } else if (game.phase === 'rally') {
    stepBall(dt);
  } else if (game.phase === 'point') {
    game.pointTimer -= dt;
    if (game.pointTimer <= 0) {
      if (match.over) {
        game.phase = 'over';
        audio.whistle();
        hud.showResult(match.winner, match.score, DIFFICULTIES[match.difficulty].name);
      } else {
        startServe(match.server);
      }
    }
  }

  // Spin the ball mesh by its real angular velocity, so the seams read the spin.
  const spinRate = V.len(ball.w);
  if (spinRate > 0.5) {
    spinAxis.set(ball.w.x, ball.w.y, ball.w.z).normalize();
    spinQuat.setFromAxisAngle(spinAxis, spinRate * dt);
    arena.ball.quaternion.premultiply(spinQuat);
  }
}

function draw(dt) {
  arena.updateBall(ball);
  arena.pushTrail();
  arena.update(dt);

  arena.paddle.position.set(input.paddle.x, input.paddle.y, PLAY_Z - 0.07);
  arena.paddle.rotation.set(
    V.clamp(-input.swing.y * 0.05, -0.5, 0.5),
    0,
    V.clamp(-input.swing.x * 0.06, -0.6, 0.6)
  );

  arena.oppPaddle.position.set(opponent.paddle.x, opponent.paddle.y, OPP_Z + 0.07);
  arena.oppPaddle.rotation.set(
    0,
    Math.PI,
    V.clamp(-opponent.velocity.x * 0.04, -0.5, 0.5)
  );

  // Broadcast-style camera: holds its post, drifting only slightly toward the ball.
  const desired = new THREE.Vector3(ball.p.x * 0.3, 0.92 + (ball.p.y - 0.92) * 0.28, -0.45 + ball.p.z * 0.08);
  focus.lerp(desired, 1 - Math.exp(-dt * 2.2));
  camera.position.x += (CAMERA_HOME.x + ball.p.x * 0.12 - camera.position.x) * (1 - Math.exp(-dt * 1.6));
  camera.position.y += (CAMERA_HOME.y - camera.position.y) * (1 - Math.exp(-dt * 1.6));
  camera.lookAt(focus);

  hud.update(dt);
  hud.setPower(Math.min(1, Math.hypot(input.swing.x, input.swing.y) / 8.5));

  renderer.render(scene, camera);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  accumulator += dt;
  let guard = 0;
  while (accumulator >= FIXED_DT && guard < 12) {
    step(FIXED_DT);
    accumulator -= FIXED_DT;
    guard += 1;
  }
  draw(dt);
  requestAnimationFrame(frame);
}

setDifficulty('pro');
hud.setSoundLabel(true);
hud.hideLoader();
requestAnimationFrame(frame);
