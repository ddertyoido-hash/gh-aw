import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

type PointerState = { x: number; y: number }

type HeroObjectProps = {
  pointer: { current: PointerState }
  /** 0 while the hero is in place, 1 once it has scrolled away. */
  scroll: { current: number }
  /** Lower-cost materials for small screens. */
  lite?: boolean
}

/**
 * The hero monolith: a polished chrome torus with a frosted glass core inside
 * it, tilting towards the pointer and drifting away with the scroll.
 */
export default function HeroObject({ pointer, scroll, lite = false }: HeroObjectProps) {
  const tilt = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    const clamped = Math.min(delta, 0.05)
    const target = pointer.current

    if (tilt.current) {
      const group = tilt.current
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, target.y * 0.34, 0.06)
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, target.x * -0.12, 0.06)
      group.position.x = THREE.MathUtils.lerp(group.position.x, target.x * 0.42, 0.05)
      group.position.y = THREE.MathUtils.lerp(
        group.position.y,
        target.y * -0.28 + scroll.current * 0.9,
        0.06,
      )
      const scale = 1 - scroll.current * 0.16
      group.scale.setScalar(
        THREE.MathUtils.lerp(group.scale.x, scale, 0.08),
      )
    }

    if (spin.current) {
      spin.current.rotation.y += clamped * 0.22
      spin.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.06
    }
  })

  return (
    <group ref={tilt}>
      <Float speed={1.15} rotationIntensity={0.25} floatIntensity={0.9}>
        <group ref={spin}>
          <mesh castShadow={false} receiveShadow={false}>
            <torusGeometry args={[1.16, 0.44, lite ? 32 : 64, lite ? 96 : 180]} />
            <meshPhysicalMaterial
              color="#e7e9ef"
              metalness={1}
              roughness={lite ? 0.12 : 0.055}
              envMapIntensity={2.5}
            />
          </mesh>

          <mesh scale={0.995}>
            <sphereGeometry args={[1.12, lite ? 32 : 64, lite ? 32 : 64]} />
            {lite ? (
              <meshPhysicalMaterial
                color="#f5f5f7"
                metalness={0.1}
                roughness={0.12}
                transparent
                opacity={0.32}
                envMapIntensity={2}
              />
            ) : (
              <meshPhysicalMaterial
                color="#ffffff"
                metalness={0}
                roughness={0.03}
                transmission={1}
                thickness={1.5}
                ior={1.48}
                clearcoat={1}
                clearcoatRoughness={0.06}
                envMapIntensity={1.6}
              />
            )}
          </mesh>

          <mesh rotation={[Math.PI / 2.6, 0, 0.6]}>
            <torusGeometry args={[1.95, 0.014, 12, 200]} />
            <meshBasicMaterial color="#8E8E93" transparent opacity={0.55} />
          </mesh>
        </group>
      </Float>
    </group>
  )
}
