import { useEffect, useState } from 'react'

const CLOSE_DURATION_MS = 200

export function useOverlayTransition(source, closeDurationMs = CLOSE_DURATION_MS) {
  const isOpen = Boolean(source)
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isEntered, setIsEntered] = useState(false)
  const [retained, setRetained] = useState(source)

  useEffect(() => {
    if (source) setRetained(source)
  }, [source])

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true)
      let inner = 0
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setIsEntered(true))
      })
      const fallback = setTimeout(() => setIsEntered(true), 60)
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
        clearTimeout(fallback)
      }
    }

    setIsEntered(false)
    const timer = setTimeout(() => setIsMounted(false), closeDurationMs)
    return () => clearTimeout(timer)
  }, [isOpen, closeDurationMs])

  return { isMounted, isEntered, value: retained }
}
