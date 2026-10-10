export type MaterialVariant = 'chrome' | 'frost' | 'rings' | 'perimeter' | 'document'

type MaterialVisualProps = {
  variant: MaterialVariant
  className?: string
}

/**
 * Art-directed monochrome material studies rendered with CSS and SVG.
 * They stand in for macro photography of chrome, frosted glass and machined
 * surfaces — sharp, cold, and free of any external asset.
 */
export default function MaterialVisual({ variant, className }: MaterialVisualProps) {
  return (
    <div
      className={`material material--${variant}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      {variant === 'chrome' && (
        <>
          <div className="material__glow" />
          <div className="material__disc" />
          <div className="material__torus" />
          <div className="material__specular" />
        </>
      )}

      {variant === 'frost' && (
        <>
          <div className="material__glow" />
          <div className="material__pane material__pane--back" />
          <div className="material__pane material__pane--mid" />
          <div className="material__pane material__pane--front">
            <span className="material__rule" />
            <span className="material__rule material__rule--short" />
            <span className="material__rule material__rule--tiny" />
          </div>
        </>
      )}

      {variant === 'rings' && (
        <>
          <div className="material__glow" />
          <svg className="material__svg" viewBox="0 0 400 400" role="presentation">
            <defs>
              <linearGradient id="ringSheen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F5F5F7" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#8E8E93" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#F5F5F7" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <g className="material__rings" fill="none">
              <circle cx="200" cy="200" r="176" stroke="url(#ringSheen)" strokeWidth="1" />
              <circle cx="200" cy="200" r="146" stroke="url(#ringSheen)" strokeWidth="2" opacity="0.8" />
              <circle cx="200" cy="200" r="120" stroke="url(#ringSheen)" strokeWidth="1" opacity="0.55" />
              <circle cx="200" cy="200" r="92" stroke="url(#ringSheen)" strokeWidth="10" opacity="0.32" />
              <circle cx="200" cy="200" r="58" stroke="url(#ringSheen)" strokeWidth="1.5" opacity="0.9" />
            </g>
            <g className="material__rings material__rings--counter" fill="none">
              <circle
                cx="200"
                cy="200"
                r="204"
                stroke="#F5F5F7"
                strokeWidth="0.75"
                strokeDasharray="2 10"
                opacity="0.5"
              />
              <circle
                cx="200"
                cy="200"
                r="72"
                stroke="#F5F5F7"
                strokeWidth="0.75"
                strokeDasharray="4 8"
                opacity="0.4"
              />
            </g>
          </svg>
          <div className="material__core" />
        </>
      )}

      {variant === 'perimeter' && (
        <>
          <div className="material__glow" />
          <div className="material__grid" />
          <div className="material__scan" />
          <div className="material__frame">
            <span className="material__tick material__tick--tl" />
            <span className="material__tick material__tick--tr" />
            <span className="material__tick material__tick--bl" />
            <span className="material__tick material__tick--br" />
          </div>
        </>
      )}

      {variant === 'document' && (
        <>
          <div className="material__glow" />
          <div className="material__sheet material__sheet--back" />
          <div className="material__sheet material__sheet--mid" />
          <div className="material__sheet material__sheet--front">
            <span className="material__rule material__rule--short" />
            <span className="material__rule" />
            <span className="material__rule material__rule--tiny" />
            <span className="material__rule" />
            <span className="material__rule material__rule--short" />
          </div>
        </>
      )}
    </div>
  )
}
