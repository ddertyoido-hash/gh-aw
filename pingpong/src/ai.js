// The opponent. It reads the ball's flight, walks its paddle to the intercept point
// at a speed and reaction time set by the difficulty, and then chooses a placement
// that avoids wherever your paddle currently is. Harder settings see the ball
// sooner, move faster, aim tighter and attack more often.
import { v3, clamp } from './vec3.js';
import { BALL_R, TABLE_Y, OPP_Z, predictPlane } from './physics.js';
import { opponentShot } from './shots.js';

export const DIFFICULTIES = {
  rookie: {
    name: 'Rookie',
    blurb: 'Learns on the job. Slow feet, loose aim.',
    reaction: 0.34,
    footwork: 3.2,
    error: 0.3,
    power: 0.42,
    smashChance: 0.1,
    serveDelay: 1.9,
  },
  pro: {
    name: 'Pro',
    blurb: 'Solid rallies, punishes loose balls.',
    reaction: 0.18,
    footwork: 4.6,
    error: 0.16,
    power: 0.62,
    smashChance: 0.3,
    serveDelay: 1.5,
  },
  legend: {
    name: 'Legend',
    blurb: 'World tour pace. Misses nothing.',
    reaction: 0.1,
    footwork: 6,
    error: 0.075,
    power: 0.82,
    smashChance: 0.5,
    serveDelay: 1.2,
  },
};

const REACH = 0.105;

export class Opponent {
  constructor(key = 'pro') {
    this.paddle = { x: 0, y: TABLE_Y + 0.22 };
    this.velocity = { x: 0, y: 0 };
    this.setDifficulty(key);
    this.reset();
  }

  setDifficulty(key) {
    this.key = key in DIFFICULTIES ? key : 'pro';
    this.tuning = DIFFICULTIES[this.key];
  }

  reset() {
    this.paddle = { x: 0, y: TABLE_Y + 0.22 };
    this.velocity = { x: 0, y: 0 };
    this.prediction = null;
    this.predictedAt = -1;
    this.contactAt = -1;
    this.reactedAt = -1;
    this.readyDelay = 0;
  }

  /** Called every frame while the ball is live. */
  think(ball, dt, playerPaddleX, clock) {
    const incoming = ball.v.z < 0;

    if (!incoming) {
      // Drift back to a neutral ready position between shots.
      this.moveToward(0.1, TABLE_Y + 0.22, dt);
      this.prediction = null;
      return;
    }

    // Fresh read of the flight a few times a second, not every frame.
    if (!this.prediction || clock - this.predictedAt > 0.12) {
      const read = predictPlane(ball, OPP_Z);
      this.prediction = read && !read.net && !read.floor ? read : null;
      this.predictedAt = clock;
      if (this.prediction) {
        const miss = (Math.random() - 0.5) * 2 * this.tuning.error * 0.55;
        this.prediction.aimX = clamp(this.prediction.p.x + miss, -1.02, 1.02);
        this.prediction.aimY = clamp(this.prediction.p.y, TABLE_Y - 0.06, 1.5);
      }
    }

    if (!this.prediction) return;
    // Reaction time after the ball leaves your bat.
    if (this.contactAt < 0) this.contactAt = clock;
    if (clock - this.contactAt > this.tuning.reaction) {
      this.moveToward(this.prediction.aimX, this.prediction.aimY, dt);
    }
  }

  moveToward(tx, ty, dt) {
    const k = this.tuning.footwork;
    const dx = tx - this.paddle.x;
    const dy = ty - this.paddle.y;
    const step = k * dt;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-4) {
      this.velocity = { x: 0, y: 0 };
      return;
    }
    const ux = dx / dist;
    const uy = dy / dist;
    const move = Math.min(dist, step);
    this.paddle.x += ux * move;
    this.paddle.y += uy * move;
    this.velocity = { x: (ux * move) / dt, y: (uy * move) / dt };
  }

  /** The ball is at the strike plane: can it reach? If so, where does it send it? */
  attemptReturn(ball, playerPaddleX) {
    const dist = Math.hypot(ball.p.x - this.paddle.x, ball.p.y - this.paddle.y);
    if (dist > REACH) return null;

    const offCenter = dist / REACH;
    const { error, power, smashChance } = this.tuning;
    if (offCenter > 0.86 && Math.random() < 0.45) return null; // frames it, misses

    const high = ball.p.y > TABLE_Y + 0.3;
    const smash = high && Math.random() < smashChance;

    // Play away from the player's paddle, mixing in a short or deep ball.
    const away = playerPaddleX >= 0 ? -1 : 1;
    const spread = Math.random();
    let targetX;
    if (spread < 0.55) targetX = away * (0.45 + Math.random() * 0.35);
    else if (spread < 0.8) targetX = -away * (0.1 + Math.random() * 0.3);
    else targetX = (Math.random() - 0.5) * 0.7;

    const shotPower = clamp(power + (smash ? 0.3 : 0) + (Math.random() - 0.5) * 0.15, 0.2, 1);

    const shot = opponentShot({
      from: { ...ball.p },
      targetX,
      targetZ: smash ? -1.05 : -(0.5 + Math.random() * 0.6),
      power: shotPower,
      error: error * (1 + offCenter) * 1.6,
      smash,
    });
    this.contactAt = -1;
    this.prediction = null;
    return shot;
  }
}

export { REACH as OPPONENT_REACH, BALL_R };
