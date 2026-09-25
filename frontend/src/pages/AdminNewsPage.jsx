import { useState, useCallback } from 'react'
import * as api from '../utils/api'
import { NEWS_IMAGES, newsImage } from '../data/newsImages'
import { IconPencil, IconTrash, IconWarning } from '../components/Icons'
import { DiceDivider } from '../components/Dice'
import AdminUsers from './AdminUsers'
import RichTextField from '../components/RichTextField'
import { useApiResource } from '../hooks/useApiResource'

const EMPTY = {
  titleUa: '',
  titleEn: '',
  descUa: '',
  descEn: '',
  imageKey: 'wizard_spells',
  bgPos: 'center',
  section: 'main',
  sortOrder: 0,
}

export default function AdminNewsPage({ lang, authUser, onRequestAuth }) {
  const isEn = lang === 'en'
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [tab, setTab] = useState('news')

  const loadNews = useCallback(() => api.fetchNews(lang), [lang])
  const news = useApiResource(loadNews, { enabled: Boolean(authUser?.isAdmin) })
  const items = news.data || []

  if (!authUser) {
    return (
      <section className="auth-required">
        <div className="auth-required-inner">
          <h2>{isEn ? 'Sign in required' : 'Потрібен вхід'}</h2>
          <button className="btn btn-action" onClick={onRequestAuth}>
            {isEn ? 'Sign in' : 'Увійти'}
          </button>
        </div>
      </section>
    )
  }

  if (!authUser.isAdmin) {
    return (
      <section className="auth-required">
        <div className="auth-required-inner">
          <h2>{isEn ? 'Admins only' : 'Тільки для адміністраторів'}</h2>
          <p>
            {isEn
              ? 'This section manages the news feed and is limited to administrators.'
              : 'Цей розділ керує стрічкою новин і доступний лише адміністраторам.'}
          </p>
        </div>
      </section>
    )
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const startEdit = async item => {
    try {
      const full = await api.fetchAdminNewsItem(item.id)
      setForm({
        titleUa: full.titleUa || '',
        titleEn: full.titleEn || '',
        descUa: full.descUa || '',
        descEn: full.descEn || '',
        imageKey: full.imageKey || 'wizard_spells',
        bgPos: full.bgPos || 'center',
        section: full.section || 'main',
        sortOrder: 0,
      })
      setEditingId(item.id)
      setError('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError(isEn ? 'Failed to load the item.' : 'Не вдалося завантажити новину.')
    }
  }

  const cancel = () => {
    setForm(EMPTY)
    setEditingId(null)
    setError('')
  }

  const submit = async e => {
    e.preventDefault()
    if (!form.titleUa.trim() || !form.titleEn.trim()) {
      setError(isEn ? 'Both titles are required.' : 'Потрібні обидва заголовки.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (editingId) await api.updateNews(editingId, form)
      else await api.createNews(form)
      cancel()
      news.reload()
    } catch (err) {
      setError(
        err.code === 'offline'
          ? isEn
            ? 'Server unavailable.'
            : 'Сервер недоступний.'
          : isEn
            ? 'Failed to save.'
            : 'Не вдалося зберегти.',
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async id => {
    const prev = items
    news.setData(list => (list || []).filter(i => i.id !== id))
    try {
      await api.deleteNews(id)
      if (editingId === id) cancel()
    } catch {
      news.setData(prev)
    }
  }

  return (
    <section className="admin-page" data-od-id="admin-news">
      <h1 className="section-title">{isEn ? 'Administration' : 'Адміністрування'}</h1>
      <DiceDivider />

      <div className="admin-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'news'}
          className={`btn btn-toggle${tab === 'news' ? ' active' : ''}`}
          onClick={() => setTab('news')}
        >
          {isEn ? 'News' : 'Новини'}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'users'}
          className={`btn btn-toggle${tab === 'users' ? ' active' : ''}`}
          onClick={() => setTab('users')}
        >
          {isEn ? 'Accounts' : 'Облікові записи'}
        </button>
      </div>

      {tab === 'users' && <AdminUsers lang={lang} authUser={authUser} />}

      {tab === 'news' && (
        <>
          <form className="admin-form" onSubmit={submit}>
            <h2 className="admin-form-title">
              {editingId
                ? isEn
                  ? 'Edit item'
                  : 'Редагувати новину'
                : isEn
                  ? 'New item'
                  : 'Нова новина'}
            </h2>

            <div className="editor-row">
              <label className="auth-label editor-col">
                {isEn ? 'Title (UA)' : 'Заголовок (UA)'}
                <input
                  className="auth-input"
                  value={form.titleUa}
                  onChange={e => set('titleUa', e.target.value)}
                  maxLength={200}
                />
              </label>
              <label className="auth-label editor-col">
                {isEn ? 'Title (EN)' : 'Заголовок (EN)'}
                <input
                  className="auth-input"
                  value={form.titleEn}
                  onChange={e => set('titleEn', e.target.value)}
                  maxLength={200}
                />
              </label>
            </div>

            <div className="editor-row">
              <div className="auth-label editor-col">
                {isEn ? 'Text (UA)' : 'Текст (UA)'}
                <RichTextField
                  value={form.descUa}
                  onChange={v => set('descUa', v)}
                  lang={lang}
                  onError={setError}
                  blocks={false}
                  placeholder={isEn ? 'What happened?' : 'Що сталося?'}
                />
              </div>
              <div className="auth-label editor-col">
                {isEn ? 'Text (EN)' : 'Текст (EN)'}
                <RichTextField
                  value={form.descEn}
                  onChange={v => set('descEn', v)}
                  lang={lang}
                  onError={setError}
                  blocks={false}
                  placeholder={isEn ? 'What happened?' : 'Що сталося?'}
                />
              </div>
            </div>

            <div className="editor-row">
              <label className="auth-label editor-col">
                {isEn ? 'Image' : 'Зображення'}
                <select
                  className="auth-input"
                  value={form.imageKey}
                  onChange={e => set('imageKey', e.target.value)}
                >
                  {Object.keys(NEWS_IMAGES).map(k => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="auth-label editor-col">
                {isEn ? 'Section' : 'Розділ'}
                <select
                  className="auth-input"
                  value={form.section}
                  onChange={e => set('section', e.target.value)}
                >
                  <option value="main">{isEn ? 'Top news' : 'Головні новини'}</option>
                  <option value="community">{isEn ? 'Community' : 'Спільнота'}</option>
                </select>
              </label>
              <label className="auth-label editor-col admin-col-narrow">
                {isEn ? 'Order' : 'Порядок'}
                <input
                  className="auth-input"
                  type="number"
                  value={form.sortOrder}
                  onChange={e => set('sortOrder', Number(e.target.value) || 0)}
                />
              </label>
            </div>

            <div className="admin-preview">
              <span className="admin-preview-label">
                {isEn ? 'Preview' : 'Попередній перегляд'}
              </span>
              <div
                className="admin-preview-card"
                style={{
                  backgroundImage: `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.7)), url(${newsImage(form.imageKey)})`,
                  backgroundPosition: form.bgPos,
                }}
              >
                <h3>{(isEn ? form.titleEn : form.titleUa) || (isEn ? 'Title' : 'Заголовок')}</h3>

                <p
                  dangerouslySetInnerHTML={{
                    __html: (isEn ? form.descEn : form.descUa) || (isEn ? 'Description' : 'Опис'),
                  }}
                />
              </div>
            </div>

            {error && (
              <p className="auth-error" role="alert">
                <IconWarning size={16} /> {error}
              </p>
            )}

            <div className="editor-actions">
              {editingId && (
                <button type="button" className="btn btn-outline" onClick={cancel}>
                  {isEn ? 'Cancel' : 'Скасувати'}
                </button>
              )}
              <button className="btn btn-action" type="submit" disabled={busy}>
                {busy
                  ? isEn
                    ? 'Saving…'
                    : 'Збереження…'
                  : editingId
                    ? isEn
                      ? 'Save'
                      : 'Зберегти'
                    : isEn
                      ? 'Add news'
                      : 'Додати новину'}
              </button>
            </div>
          </form>

          <h2 className="admin-form-title admin-list-title">
            {isEn ? 'Existing items' : 'Наявні новини'}{' '}
            <span className="comments-count">{items.length}</span>
          </h2>

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

          <ul className="admin-list">
            {items.map(item => (
              <li key={item.id} className="admin-item">
                <div
                  className="admin-item-thumb"
                  style={{
                    backgroundImage: `url(${newsImage(item.imageKey)})`,
                    backgroundPosition: item.bgPos,
                  }}
                />
                <div className="admin-item-body">
                  <span className="admin-item-section">
                    {item.section === 'community'
                      ? isEn
                        ? 'Community'
                        : 'Спільнота'
                      : isEn
                        ? 'Top'
                        : 'Головні'}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
                <div className="admin-item-actions">
                  <button className="btn btn-outline" onClick={() => startEdit(item)}>
                    <IconPencil size={14} /> {isEn ? 'Edit' : 'Змінити'}
                  </button>
                  <button className="btn btn-outline btn-danger" onClick={() => remove(item.id)}>
                    <IconTrash size={14} /> {isEn ? 'Delete' : 'Видалити'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
