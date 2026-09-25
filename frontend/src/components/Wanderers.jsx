import { useEffect, useRef, useState } from 'react'
import { SHOT_ARROW, SHOT_FIRE, WANDER_CAST } from '../data/wanderCast'

const LEDGE_SELECTORS = [
  'header.navbar',
  'main section',
  'footer',
  '.art-card',
  '.news-card',
  '.news-custom-card',
  '.camp-card',
  '.preset-card',
  '.profile-card',
]

const SCALE = 2
const WALK_SPEED = 46
const DRIFT = 18
const GRAVITY = 1100
const MAX_FALL = 900
const LEDGE_REFRESH_MS = 220
const SNAP = 8

const ATTACK_MS = { swing: 900, shoot: 820, cast: 1000, fire: 1150 }

const FLY_SPEED = 38
const BOB_AMP = 16
const BOB_SPEED = 1.9

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

function readLedges() {
  const height = window.innerHeight
  const ledges = []

  for (const selector of LEDGE_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      const box = element.getBoundingClientRect()
      if (box.width < 90 || box.height < 30) continue
      if (box.top < 24 || box.top > height - 8) continue
      ledges.push({ left: box.left, right: box.right, top: box.top })
    }
  }

  ledges.push({ left: 0, right: window.innerWidth, top: height })
  return ledges
}

function landingLedge(ledges, actor, fromBottom, toBottom) {
  const centre = actor.x + actor.w / 2
  let best = null

  for (const ledge of ledges) {
    if (centre < ledge.left || centre > ledge.right) continue
    if (ledge.top < fromBottom - 1 || ledge.top > toBottom) continue
    if (!best || ledge.top < best.top) best = ledge
  }

  return best
}

function standingLedge(ledges, actor) {
  const centre = actor.x + actor.w / 2
  const bottom = actor.y + actor.h

  for (const ledge of ledges) {
    if (centre < ledge.left - 2 || centre > ledge.right + 2) continue
    if (Math.abs(ledge.top - bottom) <= SNAP) return ledge
  }

  return null
}

function shotStyleFor(member, scale) {
  if (member.attack === 'shoot') {
    return {
      width: `${7 * scale}px`,
      height: `${21 * scale}px`,
      backgroundImage: `url(${SHOT_ARROW})`,
    }
  }

  if (member.attack === 'fire') {
    const anchor = member.shot ?? { left: 84, bottom: 30, size: 0.5 }
    const size = Math.round(member.frame[1] * scale * anchor.size)
    return {
      width: `${size}px`,
      height: `${size}px`,
      left: `${anchor.left}%`,
      bottom: `${anchor.bottom}%`,
      backgroundImage: `url(${SHOT_FIRE})`,
    }
  }

  return { width: `${7 * scale}px`, height: `${7 * scale}px` }
}

function castFor(showWanderers, showDragon) {
  return WANDER_CAST.filter(member => (member.dragon ? showDragon : showWanderers))
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  return reduced
}

export default function Wanderers({ lang, count = 10, showWanderers = true, showDragon = true }) {
  const reduced = useReducedMotion()
  const hosts = useRef([])
  const cast = castFor(showWanderers, showDragon)
  const crew = Array.from({ length: Math.min(count, cast.length) }, (_, index) => cast[index])

  useEffect(() => {
    if (reduced) return undefined

    const roster = castFor(showWanderers, showDragon)

    const actors = hosts.current.filter(Boolean).map((el, index) => {
      const member = roster[index]
      const scale = member.scale ?? SCALE
      const fly = Boolean(member.fly)
      const baseY = randomBetween(60, Math.max(window.innerHeight * 0.45, 140))
      return {
        el,
        shot: el.querySelector('.wanderer-shot'),
        attack: member.attack,
        fly,
        baseY,
        targetY: baseY,
        phase: randomBetween(0, Math.PI * 2),
        w: member.frame[0] * scale,
        h: member.frame[1] * scale,
        x: randomBetween(0, Math.max(window.innerWidth - 80, 1)),
        y: fly ? baseY : -randomBetween(60, 700),
        vy: 0,
        dir: Math.random() < 0.5 ? 1 : -1,
        state: fly ? 'fly' : 'fall',
        busyUntil: 0,
        ledge: null,
      }
    })

    let ledges = readLedges()
    let ledgesAt = 0
    let previous = 0
    let handle = 0

    const paint = actor => {
      actor.el.dataset.state = actor.state
      actor.el.dataset.facing = actor.dir > 0 ? 'right' : 'left'
      actor.el.style.transform = `translate3d(${Math.round(actor.x)}px, ${Math.round(actor.y)}px, 0)`
    }

    const strike = (actor, now) => {
      actor.state = 'attack'
      actor.busyUntil = now + ATTACK_MS[actor.attack]

      for (const node of [actor.shot, actor.el.querySelector('.wanderer-weapon')]) {
        if (!node) continue
        node.style.animation = 'none'
        void node.offsetWidth
        node.style.animation = ''
      }
    }

    const glide = (actor, delta, now) => {
      actor.x += actor.dir * FLY_SPEED * delta
      actor.phase += delta * BOB_SPEED
      actor.baseY += (actor.targetY - actor.baseY) * Math.min(delta * 1.1, 1)
      actor.y = actor.baseY + Math.sin(actor.phase) * BOB_AMP

      if (now < actor.busyUntil) return
      if (actor.state !== 'fly') actor.state = 'fly'

      if (Math.random() < delta * 0.14) {
        strike(actor, now)
        return
      }

      if (Math.random() < delta * 0.05) actor.dir *= -1
      if (Math.random() < delta * 0.09) {
        const ceiling = Math.max(window.innerHeight * 0.5, 160)
        actor.targetY = randomBetween(50, ceiling)
      }
    }

    const walk = (actor, delta, now) => {
      if (now < actor.busyUntil) return

      if (actor.state !== 'walk') actor.state = 'walk'

      actor.x += actor.dir * WALK_SPEED * delta

      const centre = actor.x + actor.w / 2
      if (centre < actor.ledge.left || centre > actor.ledge.right) {
        actor.state = 'fall'
        actor.vy = 0
        actor.ledge = null
        return
      }

      if (Math.random() < delta * 0.18) {
        strike(actor, now)
        return
      }

      if (Math.random() < delta * 0.2) {
        actor.state = 'idle'
        actor.busyUntil = now + randomBetween(900, 3000)
        return
      }

      if (Math.random() < delta * 0.12) actor.dir *= -1
    }

    const fall = (actor, delta) => {
      const wasBottom = actor.y + actor.h
      actor.vy = Math.min(actor.vy + GRAVITY * delta, MAX_FALL)
      actor.y += actor.vy * delta
      actor.x += actor.dir * DRIFT * delta

      const found = landingLedge(ledges, actor, wasBottom, actor.y + actor.h)
      if (!found) return

      actor.y = found.top - actor.h
      actor.vy = 0
      actor.ledge = found
      actor.state = 'walk'
      actor.busyUntil = 0
      if (Math.random() < 0.4) actor.dir *= -1
    }

    const respawn = actor => {
      actor.x = randomBetween(0, Math.max(window.innerWidth - actor.w, 1))
      actor.y = -randomBetween(80, 400)
      actor.vy = 0
      actor.state = 'fall'
      actor.busyUntil = 0
      actor.ledge = null
    }

    const tick = now => {
      const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0
      previous = now

      if (now - ledgesAt > LEDGE_REFRESH_MS) {
        ledges = readLedges()
        ledgesAt = now
      }

      for (const actor of actors) {
        if (actor.fly) {
          glide(actor, delta, now)
        } else if (actor.state === 'fall') {
          fall(actor, delta)
        } else {
          const ledge = standingLedge(ledges, actor)
          if (ledge) {
            actor.ledge = ledge
            actor.y = ledge.top - actor.h
            walk(actor, delta, now)
          } else {
            actor.state = 'fall'
            actor.vy = 0
            actor.ledge = null
          }
        }

        if (!actor.fly && actor.y > window.innerHeight + 200) respawn(actor)
        if (actor.x < -actor.w) actor.x = window.innerWidth
        if (actor.x > window.innerWidth) actor.x = -actor.w

        paint(actor)
      }

      handle = window.requestAnimationFrame(tick)
    }

    handle = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(handle)
  }, [reduced, count, showWanderers, showDragon])

  if (reduced) return null

  return (
    <div className="wanderers" aria-hidden="true">
      {crew.map((member, index) => {
        const scale = member.scale ?? SCALE
        const shotStyle = shotStyleFor(member, scale)

        return (
          <span
            key={index}
            ref={node => {
              hosts.current[index] = node
            }}
            className="wanderer"
            data-state="fall"
            data-facing="right"
            data-attack={member.attack}
            data-frames={member.frames ?? 4}
          >
            <span className="wanderer-figure" title={lang === 'en' ? member.nameEn : member.nameUa}>
              <span
                className="wanderer-body"
                style={{
                  width: `${member.frame[0] * scale}px`,
                  height: `${member.frame[1] * scale}px`,
                  '--idle': `url(${member.idle})`,
                  '--run': `url(${member.run})`,
                }}
              />
              {member.weapon ? (
                <span
                  className="wanderer-weapon"
                  style={{
                    width: `${member.arm[0] * scale}px`,
                    height: `${member.arm[1] * scale}px`,
                    backgroundImage: `url(${member.weapon})`,
                    ...(member.armPos
                      ? { left: `${member.armPos.left}%`, bottom: `${member.armPos.bottom}%` }
                      : null),
                  }}
                />
              ) : null}
              <span className="wanderer-shot" style={shotStyle} />
            </span>
          </span>
        )
      })}
    </div>
  )
}
