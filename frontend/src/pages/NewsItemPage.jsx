import { useCallback } from 'react'
import * as api from '../utils/api'
import { formatDate } from '../utils/date'
import Comments from '../components/Comments'
import { newsImage } from '../data/newsImages'
import { useApiResource } from '../hooks/useApiResource'

export default function NewsItemPage({ id, lang, authUser, onRequestAuth, onBack }) {
  const isEn = lang === 'en'
  const loadNewsItem = useCallback(() => api.fetchNewsItem(id, lang), [id, lang])
  const itemResource = useApiResource(loadNewsItem)
  const item = itemResource.data

  if (itemResource.status === 'loading') {
    return (
      <section className="article-page article-page-state">
        <p>{isEn ? 'Loading…' : 'Завантаження…'}</p>
      </section>
    )
  }

  if (itemResource.status === 'error' || !item) {
    return (
      <section className="article-page article-page-state">
        <h2>{isEn ? 'News not found' : 'Новину не знайдено'}</h2>
        <p>
          {isEn
            ? 'It may have been removed, or the server is unavailable.'
            : 'Можливо, її видалено, або сервер недоступний.'}
        </p>
        <button className="btn btn-action" onClick={onBack}>
          {isEn ? 'Back to news' : 'До новин'}
        </button>
      </section>
    )
  }

  return (
    <>
      <section
        className="article-hero"
        style={{
          backgroundImage: `linear-gradient(rgba(20,19,20,0.5), rgba(20,19,20,0.86)), url(${newsImage(item.imageKey)})`,
          backgroundPosition: item.bgPos || 'center',
        }}
      >
        <div className="article-hero-inner">
          <button className="article-back" onClick={onBack}>
            ← {isEn ? 'All news' : 'Усі новини'}
          </button>

          <span className="article-cat">
            {item.section === 'community'
              ? isEn
                ? 'Community'
                : 'Спільнота'
              : isEn
                ? 'Top news'
                : 'Головні новини'}
          </span>

          <h1 className="article-title">{item.title}</h1>
          <div className="article-meta">
            <span className="article-date">{formatDate(item.date, lang)}</span>
          </div>
        </div>
      </section>

      <article className="article-page" data-od-id="news-item-body">
        <div className="article-content">
          <div
            className="news-lead"
            dangerouslySetInnerHTML={{ __html: item.html || item.desc || '' }}
          />
        </div>

        <Comments
          type="news"
          id={id}
          lang={lang}
          authUser={authUser}
          onRequestAuth={onRequestAuth}
        />
      </article>
    </>
  )
}
