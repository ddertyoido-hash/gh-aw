import { Suspense, lazy, useRef } from 'react'
import {
  useInView,
  useMediaQuery,
  useOnScreen,
  usePrefersReducedMotion,
  useSectionProgress,
} from '../lib/motion'
import { immersive } from '../data/content'
import MaterialVisual from './MaterialVisual'
import Reveal from './Reveal'
import SceneBoundary from './SceneBoundary'

const ImmersiveScene = lazy(() => import('../three/ImmersiveScene'))

/** The composed 2D stand-in for the WebGL stage. */
function FallbackStage() {
  return (
    <div className="immersive__fallback">
      <MaterialVisual variant="rings" />
    </div>
  )
}

/**
 * The Perimeter — a full-bleed cinematic stage whose object is driven entirely
 * by scroll progress. Small screens and reduced-motion visitors get the same
 * composition rendered in two dimensions instead of WebGL.
 */
export default function Immersive() {
  const section = useRef<HTMLElement | null>(null)
  const progress = useSectionProgress(section)
  const near = useInView(section, '300px')
  const onScreen = useOnScreen(section)
  const reduced = usePrefersReducedMotion()
  const wide = useMediaQuery('(min-width: 900px)')

  const use3d = wide && !reduced

  return (
    <section className="immersive" id="perimeter" ref={section} aria-label="The perimeter">
      <div className="immersive__sticky">
        <div className="immersive__layers" aria-hidden="true">
          <span className="immersive__halo immersive__halo--far" />
          <span className="immersive__halo immersive__halo--near" />
          <span className="immersive__horizon" />
        </div>

        <div className="immersive__object">
          {use3d && near && (
            <SceneBoundary fallback={<FallbackStage />}>
              <Suspense fallback={null}>
                <ImmersiveScene progress={progress} active={onScreen} />
              </Suspense>
            </SceneBoundary>
          )}
          {!use3d && <FallbackStage />}
          <div className="immersive__reflection" aria-hidden="true" />
        </div>

        <div className="immersive__copy">
          <Reveal as="p" className="eyebrow" text={immersive.eyebrow} />
          <Reveal
            as="h2"
            className="immersive__title"
            text={immersive.headline}
            stagger={0.05}
            duration={1.15}
          />
          <Reveal
            as="p"
            className="immersive__caption"
            text={immersive.caption}
            stagger={0.03}
            duration={0.8}
          />
        </div>
      </div>
    </section>
  )
}
