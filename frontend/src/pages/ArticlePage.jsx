import { useState, useEffect, useCallback } from 'react'
import * as api from '../utils/api'
import { formatDate } from '../utils/date'
import Comments from '../components/Comments'
import { IconHeart, IconWizard, IconTrash, IconPencil, CategoryIcon } from '../components/Icons'
import articlesHeroBg from '../assets/articles_hero_bg.jpg'
import { useApiResource } from '../hooks/useApiResource'
import { localizeClass } from '../data/dndTraits'
import { getCategoryLabel } from '../data/articleCategories'
import UserLink from '../components/UserLink'

export default function ArticlePage({ id, lang, authUser, onRequestAuth, onBack, onEdit }) {
  const isEn = lang === 'en'
  const loadArticle = useCallback(() => api.fetchArticle(id), [id])
  const articleResource = useApiResource(loadArticle)
  const article = articleResource.data
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!confirmDelete) return
    const onKey = e => {
      if (e.key === 'Escape') setConfirmDelete(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDelete])

  const like = async () => {
    if (!authUser) {
      onRequestAuth?.()
      return
    }
    const prev = article
    articleResource.setData(a => ({ ...a, liked: !a.liked, likes: a.likes + (a.liked ? -1 : 1) }))
    try {
      const r = await api.toggleLike(id)
      articleResource.setData(a => ({ ...a, ...r }))
    } catch {
      articleResource.setData(prev)
    }
  }

  const remove = async () => {
    try {
      await api.deleteArticle(id)
      onBack()
    } catch {}
  }

  if (articleResource.status === 'loading') {
    return (
      <section className="article-page article-page-state">
        <p>{isEn ? 'Loading…' : 'Завантаження…'}</p>
      </section>
    )
  }

  if (articleResource.status === 'error' || !article) {
    return (
      <section className="article-page article-page-state">
        <h2>{isEn ? 'Article not found' : 'Статтю не знайдено'}</h2>
        <p>
          {isEn
            ? 'It may have been removed, or the server is unavailable.'
            : 'Можливо, її видалено, або сервер недоступний.'}
        </p>
        <button className="btn btn-action" onClick={onBack}>
          {isEn ? 'Back to articles' : 'До списку статей'}
        </button>
      </section>
    )
  }

  return (
    <>
      <section
        className="article-hero"
        style={{
          backgroundImage: `linear-gradient(rgba(20,19,20,0.55), rgba(20,19,20,0.88)), url(${article.cover || articlesHeroBg})`,
        }}
      >
        <div className="article-hero-inner">
          <button className="article-back" onClick={onBack}>
            ← {isEn ? 'All articles' : 'Усі статті'}
          </button>

          <span className="article-cat">
            <CategoryIcon cat={article.category} size={15} />{' '}
            {getCategoryLabel(article.category, lang)}
          </span>

          <h1 className="article-title">{article.title}</h1>

          <div className="article-meta">
            <span className="article-author">
              <IconWizard size={16} />{' '}
              <UserLink login={article.authorLogin}>{article.author}</UserLink>
              {article.charClass && (
                <span className="article-class"> · {localizeClass(article.charClass, lang)}</span>
              )}
            </span>
            <span className="article-date">
              {formatDate(article.date, lang)}
              {article.updated && article.updated !== article.date && (
                <span className="article-updated">
                  {' · '}
                  {isEn ? 'edited' : 'змінено'} {formatDate(article.updated, lang)}
                </span>
              )}
            </span>
          </div>
        </div>
      </section>

      <article className="article-page" data-od-id="article-body">
        <div className="article-content" dangerouslySetInnerHTML={{ __html: article.html }} />

        <div className="article-footer">
          <button
            className={`btn btn-quiet btn-like${article.liked ? ' liked' : ''}`}
            onClick={like}
            title={
              article.liked
                ? isEn
                  ? 'Remove like'
                  : 'Прибрати вподобання'
                : isEn
                  ? 'Like'
                  : 'Вподобати'
            }
          >
            <IconHeart size={18} filled={article.liked} /> {article.likes}
          </button>

          {article.isOwner && (
            <div className="article-owner-actions">
              <button className="btn btn-outline" onClick={() => onEdit(article)}>
                <IconPencil size={14} /> {isEn ? 'Edit' : 'Редагувати'}
              </button>
              <button className="btn btn-outline btn-danger" onClick={() => setConfirmDelete(true)}>
                <IconTrash size={14} /> {isEn ? 'Delete' : 'Видалити'}
              </button>
            </div>
          )}
        </div>

        <Comments
          type="article"
          id={id}
          lang={lang}
          authUser={authUser}
          onRequestAuth={onRequestAuth}
        />
      </article>

      {confirmDelete && (
        <div className="modal-overlay">
          <div
            className="modal-box confirm-box"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
          >
            <h2 className="modal-title" id="confirm-delete-title">
              {isEn ? 'Delete article?' : 'Видалити статтю?'}
            </h2>
            <p className="confirm-text">
              {isEn ? (
                <>«{article.title}» will be deleted permanently. This cannot be undone.</>
              ) : (
                <>«{article.title}» буде видалено назавжди. Цю дію неможливо скасувати.</>
              )}
            </p>
            <div className="modal-actions modal-command-bar">
              <button
                className="btn btn-action btn-danger modal-primary"
                onClick={async () => {
                  setConfirmDelete(false)
                  await remove()
                }}
              >
                <IconTrash size={14} /> {isEn ? 'Delete' : 'Видалити'}
              </button>
              <button
                className="btn btn-outline modal-dismiss"
                onClick={() => setConfirmDelete(false)}
              >
                {isEn ? 'Close' : 'Закрити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
