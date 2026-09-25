import { useState, useEffect } from 'react'
import UserMenu from './UserMenu'
import { D20 } from './Dice'

function Navbar({ lang, setLang, activeTab, setActiveTab, t, authUser, onRequestAuth, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = [
    { key: 'home', label: t.home },
    { key: 'rules', label: t.rules },
    { key: 'characters', label: t.characters },
    { key: 'campaigns', label: t.campaigns },
    { key: 'news', label: t.news },
    { key: 'articles', label: t.articles },
    { key: 'clans', label: t.clans },
  ]

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const go = key => {
    setActiveTab(key)
    setMenuOpen(false)
  }

  return (
    <header className={`navbar ${menuOpen ? 'menu-open' : ''}`}>
      <button
        className="nav-burger"
        onClick={() => setMenuOpen(o => !o)}
        aria-label={
          lang === 'en'
            ? menuOpen
              ? 'Close menu'
              : 'Open menu'
            : menuOpen
              ? 'Закрити меню'
              : 'Відкрити меню'
        }
        aria-expanded={menuOpen}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <nav className={menuOpen ? 'is-open' : ''}>
        <ul>
          <li className="nav-mobile-actions nav-mobile-lead">
            {authUser ? (
              <UserMenu
                lang={lang}
                authUser={authUser}
                onOpenProfile={() => go('profile')}
                onOpenAdmin={() => go('admin')}
                onLogout={() => {
                  setMenuOpen(false)
                  onLogout?.()
                }}
              />
            ) : (
              <button
                className="btn btn-outline"
                onClick={() => {
                  setMenuOpen(false)
                  onRequestAuth?.()
                }}
              >
                {lang === 'en' ? 'Sign in' : 'Увійти'}
              </button>
            )}
            <button className="btn btn-action" onClick={() => go('profile')}>
              {t.playNow}
            </button>
          </li>

          {navItems.map(item => (
            <li key={item.key}>
              <a
                href={`#${item.key}`}
                className={activeTab === item.key ? 'active-lang' : ''}
                onClick={e => {
                  e.preventDefault()
                  go(item.key)
                }}
              >
                {item.label}
              </a>
            </li>
          ))}

          <li className="nav-mobile-actions">
            <span className="nav-divider nav-divider-h" aria-hidden="true">
              <i />
              <D20 size={13} strokeWidth={5} />
              <i />
            </span>
            <LangSwitch lang={lang} setLang={setLang} className="lang-switch-wide" />
          </li>
        </ul>
      </nav>

      <div className="nav-auth nav-cta">
        {authUser ? (
          <UserMenu
            lang={lang}
            authUser={authUser}
            onOpenProfile={() => setActiveTab('profile')}
            onOpenAdmin={() => setActiveTab('admin')}
            onLogout={onLogout}
          />
        ) : (
          <button className="btn btn-outline" onClick={onRequestAuth}>
            {lang === 'en' ? 'Sign in' : 'Увійти'}
          </button>
        )}
        <button className="btn btn-action" onClick={() => setActiveTab('profile')}>
          {t.playNow}
        </button>

        <span className="nav-divider" aria-hidden="true">
          <i />
          <D20 size={13} strokeWidth={5} />
          <i />
        </span>

        <LangSwitch lang={lang} setLang={setLang} />
      </div>
    </header>
  )
}

const LANGS = [
  { key: 'ua', label: 'УКР', title: 'Українська' },
  { key: 'en', label: 'ENG', title: 'English' },
]

export function LangSwitch({ lang, setLang, className = '' }) {
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label="Мова / Language">
      {LANGS.map(l => (
        <button
          key={l.key}
          type="button"
          className={`btn btn-toggle lang-btn${lang === l.key ? ' active' : ''}`}
          onClick={() => setLang(l.key)}
          title={l.title}
          aria-label={l.title}
          aria-pressed={lang === l.key}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

export default Navbar
