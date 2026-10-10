import { Environment, Lightformer } from '@react-three/drei'

/**
 * A studio built entirely in-scene: no HDR file, no CDN request. Bright
 * rectangular softboxes and a ring light give the chrome its long specular
 * streaks and the glass its edge glow. Rendered once (`frames={1}`) because the
 * lights never move.
 */
export default function StudioEnv() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#0A0A0A']} />
      <Lightformer
        form="rect"
        intensity={5}
        color="#ffffff"
        position={[0, 4.5, -6]}
        scale={[12, 6, 1]}
      />
      <Lightformer
        form="rect"
        intensity={2.4}
        color="#dfe3ea"
        position={[-6, 1, 1]}
        rotation-y={Math.PI / 2}
        scale={[9, 9, 1]}
      />
      <Lightformer
        form="rect"
        intensity={2.1}
        color="#c9cdd6"
        position={[6.2, 0.5, 1.5]}
        rotation-y={-Math.PI / 2}
        scale={[9, 9, 1]}
      />
      <Lightformer
        form="ring"
        intensity={3.4}
        color="#ffffff"
        position={[0, -4.5, 3]}
        scale={5}
      />
      <Lightformer
        form="circle"
        intensity={1.5}
        color="#8E8E93"
        position={[2.6, 5, 4]}
        scale={4}
      />
    </Environment>
  )
}
