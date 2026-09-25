import goblinTavern from '../assets/goblin_tavern.png'
import { DiceDivider } from '../components/Dice'
import Wordmark from '../components/Wordmark'
import { useCallback } from 'react'
import { siteImage } from '../data/images'
import * as api from '../utils/api'
import { useApiResource } from '../hooks/useApiResource'

function RulesPage({ t, lang }) {
  const loadRules = useCallback(() => api.fetchRules(lang), [lang])
  const rules = useApiResource(loadRules)
  const cards = rules.data || []
  const rulesBoxes = cards.filter(c => c.section === 'rule')
  const forbiddenCards = cards.filter(c => c.section === 'forbidden')

  return (
    <>
      <section className="rules-hero">
        <div className="hero-content">
          <h1 className="wordmark">
            <span className="wordmark-word">{t.rulesHeroLine1}</span>
            <Wordmark text={t.rulesHeroLine2} />
          </h1>
          <p className="hero-subtitle">{t.rulesHeroSubtitle}</p>
        </div>
      </section>

      <section className="rules-section">
        <div className="about-container">
          <div className="cc-image" style={{ backgroundImage: `url(${goblinTavern})` }}></div>
          <div className="about-text">
            <h2
              style={{
                color: 'var(--accent-strong)',
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--fs-2)',
                marginBottom: '20px',
              }}
            >
              {t.rulesCcTitle}
            </h2>
            <p>{t.rulesCcDesc}</p>
          </div>
        </div>
      </section>

      <section className="rules-boxes-section">
        {rules.status === 'loading' && (
          <p className="offline-banner">
            {lang === 'en' ? 'Loading rules…' : 'Завантаження правил…'}
          </p>
        )}
        {rules.status === 'error' && (
          <p className="offline-banner">
            {lang === 'en'
              ? 'Could not load rules from the server.'
              : 'Не вдалося завантажити правила із сервера.'}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                api.resetServerState()
                rules.reload()
              }}
            >
              {lang === 'en' ? 'Retry' : 'Повторити'}
            </button>
          </p>
        )}
        {rules.status === 'ready' && cards.length === 0 && (
          <p className="offline-banner">
            {lang === 'en' ? 'No rules have been published yet.' : 'Правил поки немає.'}
          </p>
        )}
        {rulesBoxes.map(box => (
          <div key={box.id} className="rules-box">
            <div className="rules-box-content">
              <h3>{box.title}</h3>
              <p>{box.desc}</p>
            </div>

            <img
              src={siteImage(box.imageKey)}
              alt={box.alt}
              className="rules-box-img"
              data-art={box.imageKey}
            />
          </div>
        ))}
      </section>

      <section className="forbidden-section">
        <h2 className="section-title">{t.forbiddenTitle}</h2>
        <DiceDivider />
        <div className="forbidden-grid">
          {forbiddenCards.map(card => (
            <div key={card.id} className="forbidden-card">
              <div className="fc-image-container">
                <img
                  src={siteImage(card.imageKey)}
                  alt={card.alt}
                  className="fc-image"
                  data-art={card.imageKey}
                />
              </div>
              <div className="fc-content">
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

export default RulesPage
