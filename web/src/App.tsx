import { useEffect } from 'react'
import { ScrollTrigger, usePrefersReducedMotion } from './lib/motion'
import { useSmoothScroll } from './lib/useSmoothScroll'
import Nav from './components/Nav'
import Grain from './components/Grain'
import ScrollProgress from './components/ScrollProgress'
import Hero from './components/Hero'
import Transversal from './components/Transversal'
import Features from './components/Features'
import Showcase from './components/Showcase'
import Immersive from './components/Immersive'
import Story from './components/Story'
import Closing from './components/Closing'
import Footer from './components/Footer'

export default function App() {
  const reduced = usePrefersReducedMotion()

  // Native scrolling stays in charge for reduced-motion visitors.
  useSmoothScroll(!reduced)

  useEffect(() => {
    // Web fonts and the 3D scenes change the layout height; re-measure once.
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 500)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="page">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <ScrollProgress />
      <Nav />
      <Grain />

      <main className="page__main" id="main">
        <Hero />
        <Transversal />
        <Features />
        <Showcase />
        <Immersive />
        <Story />
        <Closing />
      </main>

      <Footer />
    </div>
  )
}
