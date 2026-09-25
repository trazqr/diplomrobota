import { useCallback, useState } from 'react'

import articlesHeroBg from '../assets/articles_hero_bg.jpg'
import {
  IconScroll,
  IconWizard,
  IconHeart,
  IconTrash,
  IconComment,
  IconWarning,
  CategoryIcon,
} from '../components/Icons'
import { ARTICLE_CATEGORY_FILTERS, getCategoryLabel } from '../data/articleCategories'
import * as api from '../utils/api'
import { formatDate } from '../utils/date'
import { useReveal } from '../hooks/useReveal'
import { useApiResource } from '../hooks/useApiResource'
import { apiErrorMessage } from '../utils/apiErrors'
import Pagination from '../components/Pagination'
import { resolveSiteImage } from '../data/images'
import UserLink from '../components/UserLink'

const ARTICLE_CATEGORY_STORAGE_KEY = 'dnd_articles_category'
const ARTICLE_SORT_STORAGE_KEY = 'dnd_articles_sort'
const CATEGORY_KEYS = new Set(ARTICLE_CATEGORY_FILTERS.map(category => category.key))
const SORT_KEYS = new Set(['date', 'likes'])

function readStoredPreference(key, allowedValues, fallback) {
  try {
    const value = localStorage.getItem(key)
    return allowedValues.has(value) ? value : fallback
  } catch {
    return fallback
  }
}

function storePreference(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

function sortArticles(items, sortBy) {
  return [...items].sort((left, right) => {
    if (sortBy === 'likes' && right.likes !== left.likes) return right.likes - left.likes

    const dateDifference = Date.parse(right.date) - Date.parse(left.date)
    if (Number.isFinite(dateDifference) && dateDifference !== 0) return dateDifference

    return right.id - left.id
  })
}

function ArticlesPage({ t, lang, authUser, onRequestAuth, onOpenArticle, onCreate }) {
  const [activeCategory, setActiveCategory] = useState(() =>
    readStoredPreference(ARTICLE_CATEGORY_STORAGE_KEY, CATEGORY_KEYS, 'all'),
  )
  const [sortBy, setArticleSort] = useState(() =>
    readStoredPreference(ARTICLE_SORT_STORAGE_KEY, SORT_KEYS, 'date'),
  )
  const [page, setPage] = useState(1)

  const selectCategory = category => {
    const nextCategory = CATEGORY_KEYS.has(category) ? category : 'all'
    setActiveCategory(nextCategory)
    storePreference(ARTICLE_CATEGORY_STORAGE_KEY, nextCategory)
    setPage(1)
  }

  const selectSort = sort => {
    const nextSort = SORT_KEYS.has(sort) ? sort : 'date'
    setArticleSort(nextSort)
    storePreference(ARTICLE_SORT_STORAGE_KEY, nextSort)
    setPage(1)
  }

  const load = useCallback(
    () => api.fetchArticles({ category: activeCategory, sort: sortBy, page }),
    [activeCategory, page, sortBy],
  )
  const resource = useApiResource(load)
  const result = resource.data
  const articles = result?.items ?? []

  const grid = useReveal(articles)

  const handleLike = id => {
    if (!authUser) {
      onRequestAuth?.()
      return
    }
    const previous = result
    resource.setData(current => ({
      ...current,
      items: sortArticles(
        current.items.map(article =>
          article.id !== id
            ? article
            : {
                ...article,
                liked: !article.liked,
                likes: article.likes + (article.liked ? -1 : 1),
              },
        ),
        sortBy,
      ),
    }))
    api
      .toggleLike(id)
      .then(server =>
        resource.setData(current => ({
          ...current,
          items: sortArticles(
            current.items.map(article => (article.id === id ? { ...article, ...server } : article)),
            sortBy,
          ),
        })),
      )
      .catch(() => resource.setData(previous))
  }

  const handleDelete = id => {
    const previous = result
    resource.setData(current => ({
      ...current,
      items: current.items.filter(article => article.id !== id),
      total: Math.max(0, current.total - 1),
    }))
    api
      .deleteArticle(id)
      .then(() => {
        if (articles.length === 1 && page > 1) setPage(value => value - 1)
        else resource.reload()
      })
      .catch(() => resource.setData(previous))
  }

  return (
    <>
      <section
        className="articles-hero"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.65)), url(${articlesHeroBg})`,
        }}
      >
        <div className="hero-content" style={{ position: 'relative', zIndex: 4 }}>
          <p className="articles-hero-eyebrow">{t.artEyebrow}</p>
          <h1>{t.artHeroTitle}</h1>
          <p className="articles-hero-subtitle">{t.artHeroSubtitle}</p>
          <button
            className="btn btn-action"
            style={{ marginTop: '10px' }}
            onClick={() => (authUser ? onCreate?.() : onRequestAuth?.())}
          >
            {t.artWriteBtn}
          </button>
        </div>
      </section>

      <section className="articles-body-section">
        {resource.status === 'error' && (
          <p className="offline-banner">
            <IconWarning size={18} />
            {apiErrorMessage(
              resource.error,
              lang,
              lang === 'en'
                ? 'Could not load articles from the server.'
                : 'Не вдалося завантажити статті із сервера.',
            )}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                api.resetServerState()
                resource.reload()
              }}
            >
              {lang === 'en' ? 'Retry' : 'Повторити'}
            </button>
          </p>
        )}

        <div className="articles-toolbar">
          <div className="articles-categories">
            {ARTICLE_CATEGORY_FILTERS.map(cat => (
              <button
                key={cat.key}
                className={`btn btn-toggle${activeCategory === cat.key ? ' active' : ''}`}
                onClick={() => selectCategory(cat.key)}
              >
                <CategoryIcon cat={cat.key} /> {getCategoryLabel(cat.key, lang)}
              </button>
            ))}
          </div>
          <div className="articles-sort">
            <span className="sort-label">{t.artSortLabel}</span>
            <button
              className={`btn btn-toggle${sortBy === 'date' ? ' active' : ''}`}
              onClick={() => selectSort('date')}
            >
              {t.artSortDate}
            </button>
            <button
              className={`btn btn-toggle${sortBy === 'likes' ? ' active' : ''}`}
              onClick={() => selectSort('likes')}
            >
              {t.artSortLikes}
            </button>
          </div>
        </div>

        {resource.status === 'loading' && !result ? (
          <div className="articles-empty">
            <p>{lang === 'en' ? 'Loading articles…' : 'Завантаження статей…'}</p>
          </div>
        ) : resource.status === 'error' && !result ? null : articles.length === 0 ? (
          <div className="articles-empty">
            <span className="articles-empty-icon">
              <IconScroll size={54} />
            </span>
            <p>{t.artEmpty}</p>
            <button
              className="btn btn-action"
              onClick={() => (authUser ? onCreate?.() : onRequestAuth?.())}
            >
              {t.artWriteBtn}
            </button>
          </div>
        ) : (
          <div className="articles-grid" ref={grid}>
            {articles.map(article => (
              <ArticleCard
                key={article.id}
                article={article}
                lang={lang}
                t={t}
                onLike={() => handleLike(article.id)}
                onDelete={() => handleDelete(article.id)}
                onClick={() => onOpenArticle?.(article.id)}
                isOwner={Boolean(article.isOwner)}
              />
            ))}
          </div>
        )}
        <Pagination
          page={result?.page ?? page}
          totalPages={result?.totalPages ?? 0}
          total={result?.total ?? 0}
          lang={lang}
          onPageChange={setPage}
        />
      </section>
    </>
  )
}

function ArticleCard({ article, lang, t, onLike, onDelete, onClick, isOwner }) {
  const source = article.excerpt ?? article.content ?? ''
  const preview = source.replace(/\*\*(.*?)\*\*/g, '$1').slice(0, 160)
  const isLiked = Boolean(article.liked)
  const coverImage = article.cover ? resolveSiteImage(article.cover) : ''

  return (
    <div className={`art-card reveal${coverImage ? ' has-cover' : ''}`}>
      {coverImage && (
        <span
          className="art-card-cover"
          style={{ backgroundImage: `url(${coverImage})` }}
          aria-hidden="true"
        />
      )}
      <div className="art-card-top">
        <span className="art-cat-tag">
          <CategoryIcon cat={article.category} /> {getCategoryLabel(article.category, lang)}
        </span>
        <span className="art-date">{formatDate(article.date, lang)}</span>
      </div>
      <h3 className="art-card-title">{article.title}</h3>
      <p className="art-card-preview">
        {preview}
        {source.length > 160 ? '…' : ''}
      </p>
      <div className="art-card-footer">
        <div className="art-card-footer-left">
          <span className="art-author-badge">
            <IconWizard size={15} />{' '}
            <UserLink login={article.authorLogin}>{article.author}</UserLink>
          </span>
          <button className="btn btn-action btn-sm art-read-btn" onClick={onClick}>
            {t.artReadBtn || 'Читати далі'} →
          </button>
        </div>
        <div className="art-card-actions">
          {article.comments > 0 && (
            <span className="art-comment-count" title={lang === 'ua' ? 'Коментарі' : 'Comments'}>
              <IconComment size={16} /> {article.comments}
            </span>
          )}
          <button
            className={`btn btn-quiet btn-like${isLiked ? ' liked' : ''}`}
            onClick={onLike}
            title={isLiked ? t.artUnlike : t.artLike}
          >
            <IconHeart size={16} filled={isLiked} /> {article.likes}
          </button>
          {isOwner && (
            <button
              className="btn btn-quiet btn-danger"
              onClick={onDelete}
              title={t.artDelete}
              aria-label={t.artDelete}
            >
              <IconTrash size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ArticlesPage
