import { Component, type ErrorInfo, type ReactNode } from 'react'

type SceneBoundaryProps = {
  children: ReactNode
  fallback?: ReactNode
}

type SceneBoundaryState = { failed: boolean }

/**
 * WebGL can be unavailable (older hardware, blocklisted drivers, disabled in
 * settings). A failure inside the canvas must never take the page down with it,
 * so the 3D subtree degrades to its composed fallback instead.
 */
export default class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false }

  static getDerivedStateFromError(): SceneBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.warn('3D scene unavailable, falling back to 2D:', error.message)
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}
