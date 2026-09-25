const HEX = '50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5'
const FACE = '50,27 80,71 20,71'

const EDGES = [
  [50, 27, 50, 3],
  [50, 27, 9, 26.5],
  [50, 27, 91, 26.5],
  [80, 71, 91, 73.5],
  [80, 71, 50, 97],
  [20, 71, 9, 73.5],
  [20, 71, 50, 97],
]

export function D20({ size = 24, className = '', strokeWidth = 3.4 }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points={HEX} />
      <polygon points={FACE} />
      {EDGES.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </svg>
  )
}

export function DiceDivider({ className = '' }) {
  return (
    <div className={`dice-divider ${className}`} role="presentation">
      <span className="dice-divider-rule"></span>
      <D20 size={22} className="dice-divider-mark" strokeWidth={4} />
      <span className="dice-divider-rule"></span>
    </div>
  )
}

export default D20
