import { useEffect, useRef, useState } from 'react'
import { CURSORS } from '../data/cursors'

function stateFor(el) {
  if (!el || !el.closest) return 'default'

  if (el.closest('[aria-busy="true"], .is-busy')) return 'busy'
  if (el.closest('button:disabled, [aria-disabled="true"], input:disabled, select:disabled'))
    return 'disabled'
  if (
    el.closest(
      'input:not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]',
    )
  )
    return 'text'
  if (el.closest('a, button, [role="button"], [role="tab"], select, label, summary, .is-clickable'))
    return 'pointer'

  return 'default'
}

export default function ThemeCursor({ cursor }) {
  const layer = useRef(null)
  const pos = useRef({ x: -100, y: -100 })
  const frame = useRef(0)
  const [state, setState] = useState('default')
  const [pressed, setPressed] = useState(false)
  const [visible, setVisible] = useState(false)

  const visibleRef = useRef(false)

  const [fine, setFine] = useState(
    () =>
      typeof window !== 'undefined' &&
      Boolean(
        window.matchMedia?.('(pointer: fine)').matches &&
        window.matchMedia?.('(hover: hover)').matches,
      ),
  )

  useEffect(() => {
    const mq = window.matchMedia?.('(pointer: fine) and (hover: hover)')
    if (!mq) return
    const sync = () => setFine(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const enabled = Boolean(cursor && CURSORS[cursor] && fine)

  useEffect(() => {
    if (!enabled) return

    const show = on => {
      if (visibleRef.current === on) return
      visibleRef.current = on
      setVisible(on)
    }

    const draw = () => {
      frame.current = 0
      const el = layer.current
      if (el) {
        el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`
      }
    }

    const onMove = e => {
      pos.current = { x: e.clientX, y: e.clientY }
      show(true)

      if (!frame.current) frame.current = requestAnimationFrame(draw)

      const next = stateFor(e.target)
      setState(prev => (prev === next ? prev : next))
    }

    const onDown = () => setPressed(true)
    const onUp = () => setPressed(false)

    const onOut = e => {
      if (!e.relatedTarget) show(false)
    }
    const onEnter = () => show(true)

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    document.addEventListener('mouseout', onOut)
    document.addEventListener('mouseover', onEnter)

    document.documentElement.classList.add('has-theme-cursor')

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      document.removeEventListener('mouseout', onOut)
      document.removeEventListener('mouseover', onEnter)
      document.documentElement.classList.remove('has-theme-cursor')

      if (frame.current) {
        cancelAnimationFrame(frame.current)
        frame.current = 0
      }
      visibleRef.current = false
    }
  }, [enabled])

  if (!enabled) return null

  const item = CURSORS[cursor]

  return (
    <div
      ref={layer}

      className={`theme-cursor cursor-${cursor} state-${state}${pressed ? ' is-pressed' : ''}${visible ? '' : ' is-hidden'}`}
      aria-hidden="true"
    >
      <span className="theme-cursor-ring" />

      <img
        className="theme-cursor-art"
        src={item.src}
        alt=""
        style={{ marginLeft: `-${item.hotspot[0]}px`, marginTop: `-${item.hotspot[1]}px` }}
      />

      <span className="theme-cursor-spark" />

      <span className="theme-cursor-fx">
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}
