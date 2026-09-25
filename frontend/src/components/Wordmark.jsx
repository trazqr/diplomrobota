import { useState, useRef, useLayoutEffect } from 'react'

export default function Wordmark({ text, className = '' }) {
  const boxRef = useRef(null)
  const probeRef = useRef(null)
  const [stacked, setStacked] = useState(false)

  const hasAmp = Boolean(text) && text.includes('&')
  const [before, ...rest] = hasAmp ? text.split('&') : [text]
  const head = before.trim()
  const tail = rest.join('&').trim()

  useLayoutEffect(() => {
    if (!hasAmp) return
    const box = boxRef.current
    const probe = probeRef.current
    if (!box || !probe) return

    const measure = () => {
      const available = box.parentElement?.clientWidth ?? box.clientWidth

      setStacked(probe.scrollWidth > available + 1)
    }

    measure()

    document.fonts?.ready?.then(measure).catch(() => {})

    const ro = new ResizeObserver(measure)

    if (box.parentElement) ro.observe(box.parentElement)
    return () => ro.disconnect()
  }, [text, hasAmp])

  if (!hasAmp) return <>{text}</>

  const parts = (
    <>
      <span className="wordmark-word">{head}</span>
      <span className="wordmark-amp">&amp;</span>
      <span className="wordmark-word">{tail}</span>
    </>
  )

  return (
    <>
      <span ref={boxRef} className={`wordmark-line${stacked ? ' is-stacked' : ''} ${className}`}>
        {parts}
      </span>

      <span ref={probeRef} className="wordmark-probe" aria-hidden="true">
        {parts}
      </span>
    </>
  )
}
