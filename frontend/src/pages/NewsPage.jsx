import { useCallback } from 'react'
import newsHeroBg from '../assets/news_hero_bg.png'
import bookCover from '../assets/book_cover.png'
import { DiceDivider } from '../components/Dice'
import { newsImage } from '../data/newsImages'
import * as api from '../utils/api'
import { useReveal } from '../hooks/useReveal'
import { useApiResource } from '../hooks/useApiResource'

function NewsPage({ t, lang, onOpenNews }) {
  const isEn = lang === 'en'
  const loadNews = useCallback(() => api.fetchNews(lang), [lang])
  const news = useApiResource(loadNews)
  const items = news.data || []
  const grid = useReveal(items)
  const main = items.filter(n => n.section === 'main')
  const community = items.filter(n => n.section === 'community')

  return (
    <>
      <section
        className="news-hero"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${newsHeroBg})`,
        }}
      >
        <div className="hero-content" style={{ position: 'relative', zIndex: 4 }}>
          <h1>{t.newsPageTitle}</h1>
          <p className="hero-subtitle">{t.newsHeroSubtitle}</p>
        </div>
      </section>

      <section className="main-news-section" data-od-id="news-main">
        <h2>{t.newsMainTitle}</h2>
        <DiceDivider />
        <p className="news-subtitle">{t.newsMainSubtitle}</p>

        {news.status === 'loading' && (
          <p className="offline-banner">{isEn ? 'Loading news…' : 'Завантаження новин…'}</p>
        )}
        {news.status === 'error' && (
          <p className="offline-banner">
            {isEn
              ? 'Could not load news from the server.'
              : 'Не вдалося завантажити новини із сервера.'}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                api.resetServerState()
                news.reload()
              }}
            >
              {isEn ? 'Retry' : 'Повторити'}
            </button>
          </p>
        )}
        {news.status === 'ready' && main.length === 0 && (
          <p className="offline-banner">
            {isEn ? 'No news has been published yet.' : 'Новин поки немає.'}
          </p>
        )}

        <div className="news-custom-grid">
          {main.map(card => (
            <div
              key={card.id}
              className="news-custom-card is-clickable"
              role="link"
              tabIndex={0}
              onClick={() => typeof card.id === 'number' && onOpenNews?.(card.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' && typeof card.id === 'number') onOpenNews?.(card.id)
              }}
            >
              <div className="news-custom-card-media">
                <img src={newsImage(card.imageKey)} alt="" style={{ objectPosition: card.bgPos }} />
              </div>
              <div className="news-custom-card-content">
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {community.length > 0 && (
        <section className="news-section" data-od-id="news-community">
          <h2 className="section-title">{isEn ? 'Community feed' : 'Стрічка спільноти'}</h2>
          <DiceDivider />
          <div className="news-grid" ref={grid}>
            {community.map((card, i) => (
              <div
                key={card.id}

                className={`news-card is-clickable reveal ${i < 2 ? 'large' : 'small'}`}
                role="link"
                tabIndex={0}
                onClick={() => typeof card.id === 'number' && onOpenNews?.(card.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && typeof card.id === 'number') onOpenNews?.(card.id)
                }}
                style={{
                  backgroundImage: `url(${newsImage(card.imageKey)})`,
                  backgroundPosition: card.bgPos || 'center',
                  backgroundSize: 'cover',
                }}
              >
                <div className="news-card-content">
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="expert-tools-section">
        <div className="expert-tools-container">
          <div className="expert-book-mockup">
            <img src={bookCover} alt="Expert DM Tools Book" className="expert-book-img" />
          </div>
          <div className="expert-tools-content">
            <h2>{t.expertTitle}</h2>
            <p className="expert-intro">{t.expertIntro}</p>
            <div className="expert-points">
              <div className="expert-point">
                <p>{t.expertPoint1}</p>
              </div>
              <div className="expert-point">
                <p>{t.expertPoint2}</p>
              </div>
              <div className="expert-point">
                <p>{t.expertPoint3}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default NewsPage
