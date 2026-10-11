// The on-screen layer: score bug, serve prompt, rally counter, power meter, the
// start menu and the result card. It only reads and writes DOM nodes from
// index.html — no game state lives here.
export class Hud {
  constructor(root = document) {
    this.el = {
      scoreYou: root.getElementById('score-you'),
      scoreRival: root.getElementById('score-rival'),
      serveYou: root.getElementById('serve-you'),
      serveRival: root.getElementById('serve-rival'),
      rally: root.getElementById('rally'),
      message: root.getElementById('message'),
      messageText: root.getElementById('message-text'),
      submessage: root.getElementById('submessage'),
      powerFill: root.getElementById('power-fill'),
      menu: root.getElementById('menu'),
      result: root.getElementById('result'),
      resultTitle: root.getElementById('result-title'),
      resultScore: root.getElementById('result-score'),
      difficulty: root.getElementById('difficulty'),
      difficultyBlurb: root.getElementById('difficulty-blurb'),
      playButton: root.getElementById('play'),
      againButton: root.getElementById('again'),
      menuButton: root.getElementById('to-menu'),
      soundToggle: root.getElementById('sound'),
      loader: root.getElementById('loader'),
      controls: root.getElementById('controls'),
    };
    this.messageTimer = 0;
  }

  setScore(you, rival) {
    this.el.scoreYou.textContent = String(you);
    this.el.scoreRival.textContent = String(rival);
  }

  setServer(server, isServeState) {
    this.el.serveYou.classList.toggle('active', isServeState && server === 'player');
    this.el.serveRival.classList.toggle('active', isServeState && server === 'opp');
  }

  setRally(n) {
    this.el.rally.textContent = n > 0 ? `RALLY ${n}` : '';
  }

  setPower(power) {
    this.el.powerFill.style.transform = `scaleX(${Math.max(0, Math.min(1, power))})`;
  }

  message(text, sub = '', hold = 1.4) {
    this.el.messageText.textContent = text;
    this.el.submessage.textContent = sub;
    this.el.message.classList.add('show');
    this.messageTimer = hold;
  }

  clearMessage() {
    this.el.message.classList.remove('show');
    this.messageTimer = 0;
  }

  update(dt) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.el.message.classList.remove('show');
    }
  }

  showMenu() {
    this.el.menu.classList.add('show');
    this.el.result.classList.remove('show');
  }

  hideMenu() {
    this.el.menu.classList.remove('show');
  }

  showResult(winner, score, difficultyName) {
    this.el.resultTitle.textContent = winner === 'player' ? 'You win' : 'Defeat';
    this.el.resultTitle.className = winner === 'player' ? 'win' : 'lose';
    this.el.resultScore.textContent = `${score} · ${difficultyName}`;
    this.el.result.classList.add('show');
  }

  hideResult() {
    this.el.result.classList.remove('show');
  }

  hideLoader() {
    this.el.loader.classList.add('hidden');
  }

  setSoundLabel(on) {
    this.el.soundToggle.textContent = on ? 'Sound on' : 'Sound off';
    this.el.soundToggle.setAttribute('aria-pressed', String(on));
  }
}
