import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import HeroObject from './HeroObject'
import StudioEnv from './StudioEnv'

type HeroSceneProps = {
  pointer: { current: { x: number; y: number } }
  scroll: { current: number }
  /** Rendering pauses when the hero leaves the viewport. */
  active: boolean
  lite?: boolean
}

export default function HeroScene({ pointer, scroll, active, lite = false }: HeroSceneProps) {
  return (
    <Canvas
      className="scene"
      dpr={[1, lite ? 1.4 : 1.9]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0, 6.4], fov: 34 }}
      gl={{ antialias: !lite, alpha: true, powerPreference: 'high-performance' }}
    >
      <StudioEnv />
      <ambientLight intensity={0.16} />
      <directionalLight position={[4.5, 6, 4]} intensity={1.3} color="#ffffff" />
      <HeroObject pointer={pointer} scroll={scroll} lite={lite} />
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  )
}
