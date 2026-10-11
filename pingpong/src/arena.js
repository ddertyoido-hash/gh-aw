// The stadium: table, net, bats, ball, crowd, banners and lighting.
// Every texture is drawn procedurally into a canvas, so the game ships as a handful
// of source files with nothing to download.
import * as THREE from '../vendor/three.module.js';
import { BALL_R, TABLE, NET } from './physics.js';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const asTexture = (c, { repeat = [1, 1], srgb = true } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
};

/* ------------------------------------------------------------------ textures */
function tableTopTexture() {
  const c = canvas(512, 920);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 920);
  grad.addColorStop(0, '#1a4a94');
  grad.addColorStop(0.5, '#17418a');
  grad.addColorStop(1, '#123a7d');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 920);

  // Faint mottling so the surface is not a flat colour under the spotlights.
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.02})`;
    g.fillRect(Math.random() * 512, Math.random() * 920, 6, 6);
  }

  g.strokeStyle = '#f2f6ff';
  g.lineJoin = 'miter';
  // 20 mm white border, inset 20 mm from the edge on a 1525 x 2740 mm top.
  g.lineWidth = (20 / 1525) * 512;
  const inset = g.lineWidth / 2 + (12 / 1525) * 512;
  g.strokeRect(inset, inset, 512 - inset * 2, 920 - inset * 2);

  // Centre line, 3 mm wide.
  g.fillStyle = '#f2f6ff';
  g.fillRect(512 / 2 - (1.5 / 1525) * 512, 0, (3 / 1525) * 512, 920);

  // Slight sheen across the middle, where the lights reflect.
  const sheen = g.createLinearGradient(0, 0, 512, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(0.65, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, 512, 920);
  return asTexture(c);
}

function floorTexture() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#12161d';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const a = Math.random() * 0.05;
    g.fillStyle = `rgba(${140 + Math.random() * 60},${150 + Math.random() * 60},180,${a})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // Tile seams.
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 3;
  for (const p of [0, 256, 512]) {
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, 512);
    g.moveTo(0, p);
    g.lineTo(512, p);
    g.stroke();
  }
  return asTexture(c, { repeat: [10, 10] });
}

function netTexture() {
  const c = canvas(512, 96);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 96);
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 1.5;
  for (let x = 0; x <= 512; x += 9) {
    g.beginPath();
    g.moveTo(x, 8);
    g.lineTo(x, 96);
    g.stroke();
  }
  for (let y = 8; y <= 96; y += 9) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  // The white cord along the top of the net.
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 7);
  return asTexture(c);
}

function ballTexture() {
  const c = canvas(512, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, '#f4f6fa');
  grad.addColorStop(1, '#e8ecf3');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);

  // Meridian seams: without them a spinning ball looks like a still ball.
  g.strokeStyle = 'rgba(150,158,172,0.5)';
  g.lineWidth = 2;
  for (const x of [0, 170, 341]) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  g.strokeStyle = 'rgba(150,158,172,0.45)';
  g.beginPath();
  g.moveTo(0, 128);
  g.lineTo(512, 128);
  g.stroke();
  // A couple of marks to read the rotation by.
  g.fillStyle = 'rgba(214,110,40,0.85)';
  g.beginPath();
  g.arc(85, 96, 13, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(426, 160, 13, 0, Math.PI * 2);
  g.fill();
  return asTexture(c);
}

function bannerTexture(text, bg, fg = '#ffffff') {
  const c = canvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.fillRect(0, 0, 512, 14);
  g.fillStyle = fg;
  g.font = 'bold 54px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  return asTexture(c);
}

function gradientEnvTexture() {
  const c = canvas(256, 128);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#9fb4e0');
  grad.addColorStop(0.42, '#39415c');
  grad.addColorStop(0.5, '#1b2030');
  grad.addColorStop(1, '#0a0c12');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  // Two soft light pools overhead.
  for (const x of [70, 190]) {
    const radial = g.createRadialGradient(x, 26, 2, x, 26, 56);
    radial.addColorStop(0, 'rgba(255,255,255,0.95)');
    radial.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = radial;
    g.fillRect(x - 60, 0, 120, 90);
  }
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadowBlobTexture() {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const radial = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  radial.addColorStop(0, 'rgba(0,0,0,0.5)');
  radial.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  radial.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = radial;
  g.fillRect(0, 0, 128, 128);
  return asTexture(c, { srgb: false });
}

function dotTexture() {
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  const radial = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  radial.addColorStop(0, 'rgba(255,255,255,1)');
  radial.addColorStop(0.4, 'rgba(255,240,210,0.55)');
  radial.addColorStop(1, 'rgba(255,230,190,0)');
  g.fillStyle = radial;
  g.fillRect(0, 0, 64, 64);
  return asTexture(c, { srgb: false });
}

/* -------------------------------------------------------------------- pieces */
function makePaddle(rubber = 0xd8382f) {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.078, 0.008, 32),
    [
      new THREE.MeshStandardMaterial({ color: 0xd9c39a, roughness: 0.75 }),
      new THREE.MeshStandardMaterial({ color: rubber, roughness: 0.62 }),
      new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.66 }),
    ]
  );
  blade.rotation.x = Math.PI / 2;
  blade.castShadow = true;
  group.add(blade);

  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.098, 0.014),
    new THREE.MeshStandardMaterial({ color: 0x8a6236, roughness: 0.7 })
  );
  handle.position.y = -0.115;
  handle.castShadow = true;
  group.add(handle);
  return group;
}

function makeTable() {
  const group = new THREE.Group();
  const topMat = new THREE.MeshStandardMaterial({
    map: tableTopTexture(),
    roughness: 0.34,
    metalness: 0.02,
    envMapIntensity: 0.5,
  });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x0b1c38, roughness: 0.6 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE.halfW * 2, TABLE.thick, TABLE.halfL * 2), [
    sideMat,
    sideMat,
    topMat,
    sideMat,
    sideMat,
    sideMat,
  ]);
  top.position.y = TABLE.top - TABLE.thick / 2;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const metal = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.35, metalness: 0.85 });
  const legGeo = new THREE.CylinderGeometry(0.022, 0.028, TABLE.top - TABLE.thick, 12);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, metal);
      leg.position.set(sx * (TABLE.halfW - 0.16), (TABLE.top - TABLE.thick) / 2, sz * (TABLE.halfL - 0.3));
      leg.castShadow = true;
      group.add(leg);
    }
  }
  const railGeo = new THREE.BoxGeometry(0.05, 0.04, TABLE.halfL * 2 - 0.6);
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, metal);
    rail.position.set(sx * (TABLE.halfW - 0.16), TABLE.top - TABLE.thick - 0.06, 0);
    rail.castShadow = true;
    group.add(rail);
  }
  return group;
}

function makeNet() {
  const group = new THREE.Group();
  const width = TABLE.halfW * 2 + NET.over * 2;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, NET.h, 1, 1),
    new THREE.MeshStandardMaterial({
      map: netTexture(),
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0,
    })
  );
  mesh.position.y = TABLE.top + NET.h / 2;
  group.add(mesh);

  const postMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.45, metalness: 0.4 });
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, NET.h + 0.03, 10), postMat);
    post.position.set(sx * (TABLE.halfW + NET.over), TABLE.top + (NET.h + 0.03) / 2, 0);
    post.castShadow = true;
    group.add(post);
  }
  return group;
}

function makeScoreboard() {
  const c = canvas(768, 256);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 1.4),
    new THREE.MeshStandardMaterial({
      map: texture,
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: 0.55,
      roughness: 0.6,
    })
  );
  let last = '';
  const draw = (you, rival, rally) => {
    const key = `${you}|${rival}|${rally}`;
    if (key === last) return;
    last = key;
    const g = c.getContext('2d');
    g.fillStyle = '#05070c';
    g.fillRect(0, 0, 768, 256);
    g.fillStyle = '#0d1526';
    g.fillRect(8, 8, 752, 240);
    g.font = 'bold 34px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#7fb2ff';
    g.fillText('YOU', 150, 62);
    g.fillStyle = '#ff8f6b';
    g.fillText('RIVAL', 618, 62);
    g.font = 'bold 116px system-ui, sans-serif';
    g.fillStyle = '#ffffff';
    g.fillText(String(you), 150, 158);
    g.fillText(String(rival), 618, 158);
    g.font = 'bold 46px system-ui, sans-serif';
    g.fillStyle = '#33405c';
    g.fillText('–', 384, 150);
    g.font = 'bold 30px system-ui, sans-serif';
    g.fillStyle = '#8fa2c4';
    g.fillText(`RALLY ${rally}`, 384, 214);
    texture.needsUpdate = true;
  };
  draw(0, 0, 0);
  return { panel, draw };
}

function makeCrowd() {
  const group = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.9 });
  const peopleGeo = new THREE.BoxGeometry(0.22, 0.5, 0.24);
  peopleGeo.translate(0, 0.25, 0);
  const headGeo = new THREE.SphereGeometry(0.1, 8, 6);
  headGeo.translate(0, 0.6, 0);

  const spots = [];
  const tiers = 4;
  const shirts = [0x2f6fbf, 0xd94f4f, 0xe0c15a, 0x4bbf8a, 0xb07fd8, 0xd8d8e0, 0x3a4152];

  const addStand = (axis, sign, spanFrom, spanTo) => {
    for (let tier = 0; tier < tiers; tier++) {
      const base = 1.1 + tier * 0.78;
      const offset = 4.6 + tier * 1.05;
      const step = new THREE.Mesh(
        axis === 'x'
          ? new THREE.BoxGeometry(1.2, 0.78, Math.abs(spanTo - spanFrom))
          : new THREE.BoxGeometry(Math.abs(spanTo - spanFrom), 0.78, 1.2),
        seatMat
      );
      const mid = (spanFrom + spanTo) / 2;
      if (axis === 'x') step.position.set(sign * offset, base, mid);
      else step.position.set(mid, base, sign * offset);
      group.add(step);

      // Two rows of spectators standing on each step.
      const rows = 2;
      for (let r = 0; r < rows; r++) {
        const per = Math.round(Math.abs(spanTo - spanFrom) / 0.42);
        for (let i = 0; i < per; i++) {
          const t = spanFrom + (i + 0.5) * ((spanTo - spanFrom) / per);
          const across = offset - 0.18 + r * 0.34;
          const px = axis === 'x' ? sign * across : t;
          const pz = axis === 'x' ? t : sign * across;
          spots.push({ x: px, y: base + 0.39, z: pz });
        }
      }
    }
  };
  addStand('x', -1, -7, 7);
  addStand('x', 1, -7, 7);
  addStand('z', -1, -6.5, 6.5);
  addStand('z', 1, -5, 5);

  const bodies = new THREE.InstancedMesh(peopleGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), spots.length);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), spots.length);
  const color = new THREE.Color();
  spots.forEach((s, i) => {
    bodies.setColorAt(i, color.setHex(shirts[i % shirts.length]));
    heads.setColorAt(i, color.setHex(0xe8c9a8).offsetHSL(0, 0, (Math.random() - 0.5) * 0.18));
  });
  bodies.instanceColor.needsUpdate = true;
  heads.instanceColor.needsUpdate = true;
  group.add(bodies);
  group.add(heads);

  const dummy = new THREE.Object3D();
  let excite = 0;
  const update = (dt) => {
    excite = Math.max(0, excite - dt * 1.2);
    const t = performance.now() / 1000;
    spots.forEach((s, i) => {
      const bob =
        Math.sin(t * 2.1 + i * 0.7) * 0.012 +
        excite * Math.abs(Math.sin(t * 7 + i)) * 0.34;
      const x = s.x;
      const z = s.z;
      dummy.position.set(x, s.y + bob, z);
      dummy.rotation.set(0, Math.sin(t * 0.3 + i) * 0.06, 0);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, s.y + bob + 0.52, z);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    });
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { group, update, cheer: (s = 1) => (excite = Math.min(1.6, excite + s)) };
}

/* --------------------------------------------------------------------- arena */
export function createArena({ scene, renderer }) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = gradientEnvTexture();
  scene.environment = pmrem.fromEquirectangular(envTexture).texture;
  envTexture.dispose();
  pmrem.dispose();

  scene.fog = new THREE.FogExp2(0x05070d, 0.026);

  // Floor + walls.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshStandardMaterial({
      map: floorTexture(),
      roughness: 0.42,
      metalness: 0.08,
      envMapIntensity: 0.35,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b0f18, roughness: 0.95 });
  const farWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), wallMat);
  farWall.position.set(0, 6, -13);
  scene.add(farWall);
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(34, 12), wallMat);
    wall.position.set(sx * 12, 6, 0);
    wall.rotation.y = (sx * Math.PI) / 2;
    scene.add(wall);
  }
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshStandardMaterial({ color: 0x080a10, roughness: 1 })
  );
  ceiling.position.set(0, 9.4, 0);
  ceiling.rotation.x = Math.PI / 2;
  scene.add(ceiling);

  // Table, net, ball.
  const table = makeTable();
  scene.add(table);
  scene.add(makeNet());

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 40, 28),
    new THREE.MeshStandardMaterial({
      map: ballTexture(),
      roughness: 0.42,
      metalness: 0,
      envMapIntensity: 0.7,
    })
  );
  ball.castShadow = true;
  scene.add(ball);

  const ballShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: shadowBlobTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    })
  );
  ballShadow.rotation.x = -Math.PI / 2;
  scene.add(ballShadow);

  // Comet trail so a 20 m/s ball stays readable.
  const trailCount = 26;
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(trailCount * 3);
  const trailCol = new Float32Array(trailCount * 4);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 4));
  const trail = new THREE.Points(
    trailGeo,
    new THREE.PointsMaterial({
      size: 0.055,
      map: dotTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    })
  );
  trail.frustumCulled = false;
  scene.add(trail);
  const trailHistory = Array.from({ length: trailCount }, () => ({ x: 0, y: -10, z: 0 }));

  const paddle = makePaddle();
  scene.add(paddle);
  const oppPaddle = makePaddle(0xd8382f);
  scene.add(oppPaddle);

  // Banners around the court.
  const bannerData = [
    ['FURY CUP', '#12305e'],
    ['TABLE TENNIS', '#5a1230'],
    ['SPIN CITY', '#0f3f34'],
    ['GRAND SLAM', '#3a2a0e'],
  ];
  bannerData.forEach(([text, bg], i) => {
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 0.9),
      new THREE.MeshStandardMaterial({
        map: bannerTexture(text, bg),
        emissive: 0xffffff,
        emissiveMap: bannerTexture(text, bg),
        emissiveIntensity: 0.22,
        roughness: 0.8,
      })
    );
    const side = i < 2 ? -1 : 1;
    banner.position.set(side * 3.9, 0.78, i % 2 === 0 ? -1.6 : 1.6);
    banner.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(banner);
  });
  const backBanner = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.1),
    new THREE.MeshStandardMaterial({
      map: bannerTexture('WORLD TOUR', '#1d1140'),
      emissive: 0xffffff,
      emissiveMap: bannerTexture('WORLD TOUR', '#1d1140'),
      emissiveIntensity: 0.3,
      roughness: 0.8,
    })
  );
  backBanner.position.set(0, 1.4, -12.4);
  scene.add(backBanner);

  const scoreboard = makeScoreboard();
  scoreboard.panel.position.set(0, 5.6, -12.4);
  scene.add(scoreboard.panel);

  const crowd = makeCrowd();
  scene.add(crowd.group);

  // Lights: ambient wash, two table spots, and a cool rim from the stands.
  scene.add(new THREE.HemisphereLight(0x93a8d8, 0x0a0d14, 0.5));
  const key = new THREE.SpotLight(0xfff3e0, 42, 16, 0.72, 0.45, 2);
  key.position.set(0.6, 4.6, 1.4);
  key.target.position.set(0, TABLE.top, -0.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0012;
  scene.add(key, key.target);

  const fill = new THREE.SpotLight(0xdce8ff, 30, 16, 0.75, 0.5, 2);
  fill.position.set(-0.8, 4.4, -1.6);
  fill.target.position.set(0, TABLE.top, 0.3);
  scene.add(fill, fill.target);

  const rim = new THREE.DirectionalLight(0x4f7fd8, 0.35);
  rim.position.set(-3, 4, -6);
  scene.add(rim);

  // Ceiling fixtures, purely for looks.
  for (const [x, z] of [
    [0.6, 1.4],
    [-0.8, -1.6],
    [4.5, 3],
    [-4.5, 3],
    [4.5, -5],
    [-4.5, -5],
  ]) {
    const panelLight = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.12, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x11141c, emissive: 0xfff6e2, emissiveIntensity: 1.4 })
    );
    panelLight.position.set(x, 8.9, z);
    scene.add(panelLight);
  }

  const updateBall = (ballState) => {
    ball.position.set(ballState.p.x, ballState.p.y, ballState.p.z);
    const overTable =
      Math.abs(ballState.p.x) <= TABLE.halfW + 0.05 && Math.abs(ballState.p.z) <= TABLE.halfL + 0.05;
    const surface = overTable ? TABLE.top : 0;
    const height = Math.max(0, ballState.p.y - BALL_R - surface);
    const scale = 0.28 + height * 0.34;
    ballShadow.position.set(ballState.p.x, surface + 0.003, ballState.p.z);
    ballShadow.scale.setScalar(scale);
    ballShadow.material.opacity = Math.max(0, 0.72 - height * 0.32);
  };

  const pushTrail = () => {
    for (let i = trailCount - 1; i > 0; i--) {
      trailHistory[i].x = trailHistory[i - 1].x;
      trailHistory[i].y = trailHistory[i - 1].y;
      trailHistory[i].z = trailHistory[i - 1].z;
    }
    trailHistory[0] = { x: ball.position.x, y: ball.position.y, z: ball.position.z };
    for (let i = 0; i < trailCount; i++) {
      trailPos[i * 3] = trailHistory[i].x;
      trailPos[i * 3 + 1] = trailHistory[i].y;
      trailPos[i * 3 + 2] = trailHistory[i].z;
      // Alpha is stored in the colour attribute's fourth slot.
      trailCol[i * 4] = 1;
      trailCol[i * 4 + 1] = 0.93;
      trailCol[i * 4 + 2] = 0.8;
      trailCol[i * 4 + 3] = Math.max(0, 1 - i / trailCount) ** 2;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
  };

  return {
    ball,
    ballShadow,
    trail,
    paddle,
    oppPaddle,
    scoreboard,
    crowd,
    lights: { key, fill, rim },
    updateBall,
    pushTrail,
    update: (dt) => crowd.update(dt),
  };
}

export { TABLE_Y };
