import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { AdaptiveDpr, Float } from '@react-three/drei'
import * as THREE from 'three'
import StudioEnv from './StudioEnv'

type Shard = { angle: number; radius: number; size: number; tilt: number; speed: number }

const SHARDS: Shard[] = [
  { angle: 0.2, radius: 2.5, size: 0.34, tilt: 0.6, speed: 0.5 },
  { angle: 1.25, radius: 2.9, size: 0.24, tilt: -0.4, speed: -0.35 },
  { angle: 2.4, radius: 2.3, size: 0.42, tilt: 0.9, speed: 0.42 },
  { angle: 3.5, radius: 3.05, size: 0.2, tilt: -0.8, speed: -0.5 },
  { angle: 4.6, radius: 2.6, size: 0.3, tilt: 0.3, speed: 0.36 },
  { angle: 5.5, radius: 2.35, size: 0.38, tilt: -0.55, speed: -0.44 },
]

/** Rotation, position and scale are driven by the section's scroll progress. */
function Perimeter({ progress }: { progress: { current: number } }) {
  const group = useRef<THREE.Group>(null)
  const core = useRef<THREE.Mesh>(null)
  const shell = useRef<THREE.Mesh>(null)

  useFrame((state, delta) => {
    const p = THREE.MathUtils.clamp(progress.current, 0, 1)
    const time = state.clock.elapsedTime
    const group3 = group.current
    if (!group3) return

    group3.rotation.y = p * Math.PI * 1.5 + time * 0.05
    group3.rotation.x = (p - 0.5) * 0.85
    group3.position.y = (0.5 - p) * 1.1
    group3.scale.setScalar(0.82 + p * 0.34)

    if (core.current) {
      core.current.rotation.z += Math.min(delta, 0.05) * 0.3
      core.current.rotation.x = p * 0.7
    }
    if (shell.current) {
      shell.current.rotation.y -= Math.min(delta, 0.05) * 0.16
    }
  })

  return (
    <group ref={group}>
      <Float speed={1} rotationIntensity={0.2} floatIntensity={0.6}>
        <mesh ref={core}>
          <icosahedronGeometry args={[1.28, 0]} />
          <meshPhysicalMaterial
            color="#e9ebf1"
            metalness={1}
            roughness={0.08}
            envMapIntensity={2.4}
            flatShading
          />
        </mesh>

        <mesh ref={shell} scale={1.42}>
          <icosahedronGeometry args={[1.28, 1]} />
          <meshBasicMaterial color="#8E8E93" wireframe transparent opacity={0.28} />
        </mesh>

        {SHARDS.map((shard, index) => (
          <mesh
            key={index}
            position={[
              Math.cos(shard.angle) * shard.radius,
              Math.sin(shard.angle * 1.7) * 0.9,
              Math.sin(shard.angle) * shard.radius,
            ]}
            rotation={[shard.tilt, shard.angle, shard.tilt * 0.5]}
          >
            <boxGeometry args={[shard.size, shard.size * 2.6, shard.size * 0.6]} />
            <meshPhysicalMaterial
              color="#dfe2e9"
              metalness={1}
              roughness={0.14}
              envMapIntensity={2.1}
            />
          </mesh>
        ))}
      </Float>
    </group>
  )
}

type ImmersiveSceneProps = {
  progress: { current: number }
  active: boolean
}

export default function ImmersiveScene({ progress, active }: ImmersiveSceneProps) {
  return (
    <Canvas
      className="scene"
      dpr={[1, 1.6]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0, 7.2], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <StudioEnv />
      <ambientLight intensity={0.18} />
      <directionalLight position={[-4, 5, 5]} intensity={1.1} color="#ffffff" />
      <Perimeter progress={progress} />
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  )
}
