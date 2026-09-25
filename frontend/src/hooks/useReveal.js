import { useEffect, useRef } from 'react'

export function useReveal(trigger, { lead = 240 } = {}) {
  const root = useRef(null)

  useEffect(() => {
    const host = root.current
    if (!host) return

    const targets = host.querySelectorAll('.reveal:not(.is-visible)')
    if (!targets.length) return

    targets.forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${Math.min(i, 4) * 60}ms`)
    })

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (still || typeof IntersectionObserver === 'undefined') {
      targets.forEach(el => el.classList.add('is-visible'))
      return
    }

    const show = el => {
      el.classList.add('is-visible')
      io.unobserve(el)
    }

    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) show(entry.target)
        }
      },
      { rootMargin: `100000px 0px ${lead}px 0px`, threshold: 0 },
    )

    targets.forEach(el => io.observe(el))

    return () => io.disconnect()
  }, [trigger, lead])

  return root
}
