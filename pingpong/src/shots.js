// Turning a player's gesture into a real strike: pace, spin, placement and aim.
//
// The gesture is a swipe in normalised screen units per second (x right, y up),
// sampled at the instant the ball reaches the paddle. How fast you swing decides
// the pace, which way you swing decides the spin, and the spin genuinely changes
// how the ball curves and how it behaves off the bounce.
import { v3, clamp } from './vec3.js';
import { TABLE_Y, solveShot } from './physics.js';

export const SIDE_SPIN = 150;

/** +z travel for the opponent's shots, -z for yours. */
export const travelSign = (who) => (who === 'player' ? -1 : 1);

/** Backspin for a serve, spinning the way the ball travels. */
export const serveSpin = (dir, sideAmount = 0) => v3(-dir * 50, sideAmount, 0);

export function playerShot({ from, swing, incomingSpeed = 0, offCenter = 0 }) {
  const mag = Math.hypot(swing.x, swing.y);
  const power = clamp(mag / 8.5, 0, 1);
  const lateral = clamp(swing.x / 6, -1, 1);
  const vertical = clamp(swing.y / 6, -1, 1);

  const lift = Math.min(2.5, incomingSpeed * 0.09);
  const speed = clamp(6.1 + power * 12.4 + lift, 5.6, 20.5);

  // Swinging up brushes over the top of the ball (topspin), down is backspin.
  const spinMag = 55 + Math.abs(vertical) * 205;
  const spin = v3(-spinMag * vertical, -lateral * SIDE_SPIN, 0);

  // Mishits near the edge of the blade spray the ball and lose pace.
  const spray = offCenter * offCenter;
  const jitterX = (Math.random() - 0.5) * 2 * 0.22 * spray;
  const jitterZ = (Math.random() - 0.5) * 2 * 0.22 * spray;

  const aimX = clamp(lateral * 0.74 + jitterX, -1.0, 1.0);
  const depth = 0.62 + (vertical > 0 ? 0.5 : 0.05) * Math.abs(vertical) + power * 0.2;
  const aimZ = -clamp(depth + jitterZ, 0.4, 1.24);

  const target = v3(aimX, TABLE_Y, aimZ);
  const velocity = solveShot({ from, target, speed: speed * (1 - spray * 0.25), spin });
  return { velocity, spin, power, topspin: spin.x < 0 };
}

/** The opponent's reply: aimed at a gap, paced by difficulty, with human error. */
export function opponentShot({ from, targetX, targetZ, power, error, smash }) {
  // This ball travels the other way, so topspin is +x for it (and -x for yours).
  const spin = v3(smash ? 235 : 130, (Math.random() - 0.5) * 90, 0);
  const speed = clamp(6.4 + power * 11 + (smash ? 3 : 0), 5.5, 20);

  const ex = (Math.random() - 0.5) * 2 * error;
  const ez = (Math.random() - 0.5) * 2 * error;
  const target = v3(clamp(targetX + ex, -1.02, 1.02), TABLE_Y, clamp(targetZ + ez, 0.4, 1.24));

  const velocity = solveShot({ from, target, speed, spin });
  return { velocity, spin, power };
}
