// Match rules: table tennis scoring to 11 (win by two), serve changing every two
// points, and the verdict for everything that can happen to a live ball.
export const WIN_SCORE = 11;

const other = (who) => (who === 'player' ? 'opp' : 'player');

export class Match {
  constructor(difficultyKey = 'pro') {
    this.difficulty = difficultyKey;
    this.reset();
  }

  reset(difficultyKey = this.difficulty) {
    this.difficulty = difficultyKey;
    this.scores = { player: 0, opp: 0 };
    this.server = 'player';
    this.pointsPlayed = 0;
    this.over = false;
    this.winner = null;
    this.rally = 0;
  }

  get score() {
    return `${this.scores.player}–${this.scores.opp}`;
  }

  get deuce() {
    return this.scores.player >= WIN_SCORE - 1 && this.scores.opp >= WIN_SCORE - 1;
  }

  /** Serve changes every two points, and every point once the game reaches deuce. */
  serveInterval() {
    return this.deuce ? 1 : 2;
  }

  awardPoint(who) {
    if (this.over) return { over: true, winner: this.winner };
    this.scores[who] += 1;
    this.pointsPlayed += 1;

    const a = this.scores.player;
    const b = this.scores.opp;
    const done = (a >= WIN_SCORE || b >= WIN_SCORE) && Math.abs(a - b) >= 2;

    if (this.pointsPlayed % this.serveInterval() === 0) {
      this.server = other(this.server);
    }
    if (done) {
      this.over = true;
      this.winner = a > b ? 'player' : 'opp';
    }
    return { over: this.over, winner: this.winner };
  }
}

/**
 * Rules for a single rally. Whoever struck last owns the ball until the opponent
 * returns it, so every verdict is expressed as "who wins this point".
 *
 * 'continue' means play on. Anything else is the winner of the point.
 */
export class Rally {
  constructor() {
    this.reset('player', false);
  }

  reset(hitter, isServe) {
    this.hitter = hitter;
    this.receiver = other(hitter);
    this.isServe = isServe;
    this.servePhase = isServe ? 1 : 0; // 1 = still needs to bounce on own half
    this.bounces = 0;
    this.landedOnReceiverSide = false;
  }

  hit(hitter, isServe = false) {
    this.reset(hitter, isServe);
  }

  /**
   * A bounce on the table. `side` is the half it landed on, `inBounds` false when
   * the ball came down off the table surface.
   */
  bounce(side, inBounds) {
    if (!inBounds) return this.receiver; // struck off the table: point against hitter

    if (this.isServe && this.servePhase === 1) {
      // A serve has to bounce on the server's own half first.
      if (side === this.hitter) {
        this.servePhase = 2;
        this.landedOnReceiverSide = false;
        return 'continue';
      }
      return this.receiver;
    }

    this.bounces += 1;
    if (this.bounces === 1) {
      if (side === this.hitter) return this.receiver; // bounced on your own half
      this.landedOnReceiverSide = true;
      return 'continue';
    }
    return this.hitter; // second bounce, nobody returned it
  }

  /** The ball reached the floor, or flew out of the arena. */
  lost() {
    return this.landedOnReceiverSide ? this.hitter : this.receiver;
  }

  /**
   * The ball got past a paddle. Only the receiver can be beaten by it — and only if
   * the ball had already landed on their half, otherwise the shot itself was going
   * out and the point is settled when it hits the floor.
   */
  passedReceiver(side) {
    if (side !== this.receiver) return 'continue';
    return this.landedOnReceiverSide ? this.hitter : 'continue';
  }
}

export { other as otherSide };
