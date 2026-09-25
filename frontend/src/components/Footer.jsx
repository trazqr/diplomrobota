function Footer({ setActiveTab, t }) {
  const navLinks = [
    { key: 'home', label: t.home },
    { key: 'rules', label: t.rules },
    { key: 'characters', label: t.characters },
    { key: 'profile', label: t.account || 'АККАУНТ' },
    { key: 'campaigns', label: t.campaigns },
    { key: 'news', label: t.news },
  ]

  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-column">
          <h3>{t.footerCompany}</h3>
          <ul>
            {navLinks.map(item => (
              <li key={item.key}>
                <a
                  href={`#${item.key}`}
                  onClick={e => {
                    e.preventDefault()
                    setActiveTab(item.key)
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-column">
          <h3>{t.footerFollow}</h3>
          <ul>
            <li>
              <a href="https://twitter.com" target="_blank" rel="noreferrer">
                Twitter
              </a>
            </li>
            <li>
              <a href="https://instagram.com" target="_blank" rel="noreferrer">
                Instagram
              </a>
            </li>
            <li>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer">
                TikTok
              </a>
            </li>
            <li>
              <a href="https://youtube.com" target="_blank" rel="noreferrer">
                YouTube
              </a>
            </li>
            <li>
              <a href="https://twitch.tv" target="_blank" rel="noreferrer">
                Twitch
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}

export default Footer
