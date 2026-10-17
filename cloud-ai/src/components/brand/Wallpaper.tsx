/**
 * Nature wallpapers.
 *
 * Three original illustrated scenes (mountain lake, forest, cloudscape) drawn
 * as SVG so they stay crisp at any window size and work offline. The aurora
 * layer floats above them and is disabled with reduced motion.
 */
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { WallpaperId } from '../lib/defaults'
import { cn } from '../../lib/utils'

interface WallpaperProps {
  wallpaper: WallpaperId
  dim: number
  animate: boolean
  className?: string
}

export function Wallpaper({ wallpaper, dim, animate, className }: WallpaperProps) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
      {wallpaper === 'mountain-lake' && <MountainLake />}
      {wallpaper === 'forest' && <Forest />}
      {wallpaper === 'cloudscape' && <Cloudscape />}

      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(8,15,30,${dim / 220}) 0%, rgba(8,15,30,${dim / 100}) 100%)`,
        }}
      />

      {animate && (
        <>
          <motion.div
            className="absolute -left-24 top-1/4 h-[46vh] w-[46vw] rounded-full opacity-45 blur-3xl"
            style={{
              background:
                'radial-gradient(circle at 40% 40%, color-mix(in srgb, var(--aurora-cyan) 60%, transparent), transparent 70%)',
            }}
            animate={{ x: [0, 60, -20, 0], y: [0, -30, 20, 0] }}
            transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -right-32 top-1/3 h-[52vh] w-[52vw] rounded-full opacity-40 blur-3xl"
            style={{
              background:
                'radial-gradient(circle at 60% 40%, color-mix(in srgb, var(--aurora-violet) 55%, transparent), transparent 70%)',
            }}
            animate={{ x: [0, -50, 25, 0], y: [0, 24, -18, 0] }}
            transition={{ duration: 38, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}
    </div>
  )
}

/* ------------------------------ mountain lake ------------------------------ */

function MountainLake() {
  const ridges = useMemo(
    () => [
      { points: '0,470 190,372 320,430 470,300 620,392 780,268 940,368 1120,282 1300,382 1460,330 1600,392 1600,700 0,700', fill: 'rgba(51,65,85,0.55)' },
      { points: '0,540 150,446 300,512 470,398 640,486 820,392 1000,470 1200,392 1390,478 1600,430 1600,700 0,700', fill: 'rgba(30,41,59,0.72)' },
      { points: '0,604 180,540 360,592 560,516 760,586 960,520 1180,590 1400,536 1600,592 1600,700 0,700', fill: 'rgba(15,23,42,0.86)' },
    ],
    [],
  )

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="ml-sky" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#0f2b52" />
          <stop offset="42%" stopColor="#3b6ea5" />
          <stop offset="72%" stopColor="#f0b171" />
          <stop offset="100%" stopColor="#f7d9a8" />
        </linearGradient>
        <radialGradient id="ml-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff7e2" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#ffd79a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffb96b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ml-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fb6d6" />
          <stop offset="35%" stopColor="#3f6c94" />
          <stop offset="100%" stopColor="#16304f" />
        </linearGradient>
        <linearGradient id="ml-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe6b8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffe6b8" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1600" height="800" fill="url(#ml-sky)" />
      <circle cx="1090" cy="430" r="300" fill="url(#ml-sun)" />
      <circle cx="1090" cy="430" r="46" fill="#fff3d4" opacity="0.92" />

      <g opacity="0.5">
        <ellipse cx="300" cy="210" rx="190" ry="34" fill="#ffe8c8" />
        <ellipse cx="420" cy="186" rx="120" ry="24" fill="#fff1d8" />
        <ellipse cx="1280" cy="164" rx="210" ry="30" fill="#ffdfb8" />
      </g>

      {ridges.map((ridge, index) => (
        <polygon key={index} points={ridge.points} fill={ridge.fill} />
      ))}

      <rect y="700" width="1600" height="100" fill="url(#ml-lake)" />
      <rect y="700" width="1600" height="150" fill="url(#ml-light)" opacity="0.5" />
      <g opacity="0.35" stroke="#ffe9c2" strokeWidth="2">
        <line x1="960" y1="726" x2="1230" y2="726" />
        <line x1="900" y1="752" x2="1290" y2="752" />
        <line x1="1010" y1="778" x2="1180" y2="778" />
      </g>
      <polygon points="0,700 1600,700 1600,760 0,720" fill="#0b1a2c" opacity="0.55" />
    </svg>
  )
}

/* --------------------------------- forest --------------------------------- */

function Forest() {
  const trees = useMemo(() => {
    const items: Array<{ x: number; height: number; width: number; opacity: number }> = []
    let seed = 7
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let layer = 0; layer < 3; layer += 1) {
      const count = 26 - layer * 4
      for (let index = 0; index < count; index += 1) {
        const x = (1600 / count) * index + random() * 40
        items.push({
          x,
          height: 210 + random() * 150 - layer * 40,
          width: 46 + random() * 26 - layer * 6,
          opacity: 0.35 + layer * 0.22,
        })
      }
    }
    return items
  }, [])

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="fr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c2a33" />
          <stop offset="46%" stopColor="#1f5a55" />
          <stop offset="80%" stopColor="#7fa88d" />
          <stop offset="100%" stopColor="#cfe0c6" />
        </linearGradient>
        <radialGradient id="fr-light" cx="0.62" cy="0.22" r="0.6">
          <stop offset="0%" stopColor="#f4ffe6" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#f4ffe6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1600" height="800" fill="url(#fr-sky)" />
      <rect width="1600" height="800" fill="url(#fr-light)" />

      <g opacity="0.35">
        <ellipse cx="420" cy="250" rx="420" ry="40" fill="#e6f3ea" />
        <ellipse cx="1180" cy="330" rx="360" ry="34" fill="#e6f3ea" />
      </g>

      {trees.map((tree, index) => (
        <polygon
          key={index}
          points={`${tree.x},${760 - tree.height} ${tree.x - tree.width / 2},760 ${tree.x + tree.width / 2},760`}
          fill="#08201f"
          opacity={tree.opacity}
        />
      ))}

      <rect y="740" width="1600" height="60" fill="#061a19" />
      <g opacity="0.28" fill="#e8f6ee">
        <ellipse cx="800" cy="600" rx="900" ry="40" />
        <ellipse cx="500" cy="660" rx="700" ry="30" />
      </g>
    </svg>
  )
}

/* ------------------------------- cloudscape ------------------------------- */

function Cloudscape() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="cs-sky" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#0d3b66" />
          <stop offset="38%" stopColor="#4c8fc0" />
          <stop offset="70%" stopColor="#bfe0f2" />
          <stop offset="100%" stopColor="#fdf3e3" />
        </linearGradient>
        <radialGradient id="cs-sun" cx="0.28" cy="0.2" r="0.55">
          <stop offset="0%" stopColor="#fff6e0" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#ffe3b0" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffe3b0" stopOpacity="0" />
        </radialGradient>
        <filter id="cs-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      <rect width="1600" height="800" fill="url(#cs-sky)" />
      <rect width="1600" height="800" fill="url(#cs-sun)" />

      <g fill="#ffffff" filter="url(#cs-soft)">
        <ellipse cx="330" cy="200" rx="260" ry="72" opacity="0.9" />
        <ellipse cx="520" cy="236" rx="180" ry="52" opacity="0.75" />
        <ellipse cx="1180" cy="170" rx="300" ry="70" opacity="0.72" />
        <ellipse cx="980" cy="320" rx="240" ry="56" opacity="0.6" />
        <ellipse cx="640" cy="430" rx="330" ry="68" opacity="0.55" />
        <ellipse cx="1320" cy="470" rx="280" ry="58" opacity="0.5" />
      </g>

      <g fill="#fdf6e8" opacity="0.55">
        <ellipse cx="240" cy="640" rx="420" ry="72" />
        <ellipse cx="1180" cy="680" rx="460" ry="66" />
      </g>
    </svg>
  )
}
