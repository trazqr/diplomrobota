import { useState, useRef, useEffect } from 'react'
import { IconUser, IconShield, IconPencil } from './Icons'
import { resolveSiteImage } from '../data/images'
import { useOverlayTransition } from '../hooks/useOverlayTransition'

const MENU_CLOSE_MS = 160

export default function UserMenu({ lang, authUser, onOpenProfile, onOpenAdmin, onLogout }) {
  const isEn = lang === 'en'
  const [open, setOpen] = useState(false)
  const menuOverlay = useOverlayTransition(open, MENU_CLOSE_MS)
  const boxRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return

    const onDocClick = e => {
      if (!boxRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = e => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = action => {
    setOpen(false)
    action?.()
  }

  const initial = (authUser.name || authUser.login || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="user-menu" ref={boxRef}>
      <button
        ref={btnRef}
        className={`btn btn-outline user-menu-btn${open ? ' is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={authUser.login}
      >
        <span className="user-menu-avatar">
          {authUser.avatar ? (
            <img src={resolveSiteImage(authUser.avatar)} alt="" />
          ) : (
            <span className="user-menu-initial">{initial}</span>
          )}
        </span>
        <span className="user-menu-name">{authUser.name}</span>
        <svg
          className="user-menu-caret"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {menuOverlay.isMounted && (
        <div className={`user-menu-drop ${menuOverlay.isEntered ? 'is-entered' : ''}`} role="menu">
          <div className="user-menu-head">
            <span className="user-menu-head-name">{authUser.name}</span>
            <span className="user-menu-head-login">@{authUser.login}</span>
            {authUser.isAdmin && (
              <span className="user-menu-badge">{isEn ? 'Admin' : 'Адміністратор'}</span>
            )}
          </div>

          <button className="user-menu-item" role="menuitem" onClick={() => go(onOpenProfile)}>
            <IconUser size={16} /> {isEn ? 'Profile' : 'Профіль'}
          </button>

          {authUser.isAdmin && (
            <button className="user-menu-item" role="menuitem" onClick={() => go(onOpenAdmin)}>
              <IconPencil size={16} /> {isEn ? 'Admin panel' : 'Адмінка'}
            </button>
          )}

          <button
            className="user-menu-item user-menu-exit"
            role="menuitem"
            onClick={() => go(onLogout)}
          >
            <IconShield size={16} /> {isEn ? 'Sign out' : 'Вийти'}
          </button>
        </div>
      )}
    </div>
  )
}
