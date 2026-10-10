# gh-aw cinematic site (`web/`)

A scroll-driven, black-and-white marketing experience for **GitHub Agentic Workflows**.
It is a self-contained Vite + React app; nothing in the Go codebase or the Astro
docs site depends on it.

## Run it

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

The preview entry point is **host port 3000** (the container serves Vite on 5173).
The compose service installs dependencies from `package-lock.json` before starting
the dev server, then bind-mounts `web/` so every edit hot-reloads.

Locally, without Docker:

```bash
cd web && npm install && npm run dev
```

## Stack

| Concern | Choice |
| --- | --- |
| App shell | Vite 6 + React 19 + TypeScript |
| Scroll animation | GSAP + ScrollTrigger |
| Smooth scrolling | Lenis (wheel/trackpad eased; native touch kept) |
| 3D | three.js via `@react-three/fiber` + `@react-three/drei` |
| Display type | Inter Tight, vendored at `public/fonts` (no CDN) |

No image or HDR assets are fetched at runtime: the material studies are CSS/SVG and
the 3D studio lighting is built in-scene with drei `Lightformer`s.

## Structure

```
src/
  App.tsx                 section composition + smooth scroll bootstrap
  data/content.ts         every string and outbound link
  lib/motion.ts           gsap/ScrollTrigger setup + motion hooks
  lib/useSmoothScroll.ts  Lenis ↔ ScrollTrigger bridge
  components/             one file per section, plus shared primitives
  three/                  WebGL scenes and objects
  styles/                 tokens.css, components.css, sections.css
```

## Sandbox-only behaviour

`vite.config.ts` reads `BASE44_PREVIEW_MODE`. When it is exactly `"1"` it additionally:

- allows the rotating `.<BASE44_SANDBOX_HOST_DOMAIN>` hostname,
- points HMR at the public https proxy (`wss`, port 443),
- enables file-watch polling.

With the flag unset (or any other value) Vite keeps its stock configuration.

## Accessibility & performance notes

- Animation is gated on `(prefers-reduced-motion: no-preference)` via `gsap.matchMedia`;
  reduced-motion visitors get plain fades, native scrolling, and a 2D immersive stage.
- Headlines are split for the masked reveals, but each block keeps an `aria-label`
  with the full string, so screen readers never get letter-by-word output.
- The hero and immersive WebGL canvases mount lazily and use `frameloop="never"`
  whenever the section leaves the viewport.
- The immersive 3D stage is desktop-only; smaller screens get the composed 2D version.

## Verification

```bash
node -e "fetch('http://localhost:3000/').then(r=>r.text()).then(t=>console.log(t.includes('/src/main.tsx')))"
```

A `true` confirms the preview is serving live source from this checkout.
