import { useRef, useState } from 'react'
import * as api from '../utils/api'
import { IconTrash, IconUpload, IconWarning } from './Icons'
import RichTextField from './RichTextField'
import { isSupportedImageFile, resizeImage } from '../utils/image'
import { ARTICLE_CATEGORIES } from '../data/articleCategories'

export default function ArticleEditor({ lang, authUser, initial, onClose, onSaved, isEntered }) {
  const isEn = lang === 'en'
  const editing = Boolean(initial?.id)

  const [title, setTitle] = useState(initial?.title || '')
  const [category, setCategory] = useState(initial?.category || 'lore')
  const [cover, setCover] = useState(initial?.cover || '')
  const [html, setHtml] = useState(
    initial ? (initial.format === 'html' ? initial.raw : initial.html) || '' : '',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const coverInputRef = useRef(null)

  const selectCover = async file => {
    if (!isSupportedImageFile(file)) {
      setError(isEn ? 'Select an image file.' : 'Оберіть файл зображення.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError(isEn ? 'The image is too large.' : 'Зображення завелике.')
      return
    }

    try {
      setCover(
        await resizeImage(file, {
          maxSide: 1600,
          maxLength: 280_000,
          quality: 0.84,
        }),
      )
      setError('')
    } catch {
      setError(isEn ? 'Could not prepare this image.' : 'Не вдалося підготувати це зображення.')
    }
  }

  const save = async e => {
    e.preventDefault()
    const body = html
    const plain = body.replace(/<[^>]*>/g, '').trim()

    if (!title.trim()) {
      setError(isEn ? 'Title is required.' : 'Вкажіть заголовок.')
      return
    }
    if (!plain) {
      setError(isEn ? 'Article body is empty.' : 'Текст статті порожній.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const payload = {
        title: title.trim(),
        category,
        content: body,
        format: 'html',
        cover: cover.trim(),
      }
      const saved = editing
        ? await api.updateArticle(initial.id, payload)
        : await api.createArticle(payload)
      onSaved(saved)
    } catch (err) {
      setError(
        err.code === 'offline'
          ? isEn
            ? 'Server unavailable.'
            : 'Сервер недоступний.'
          : isEn
            ? 'Failed to save. Try again.'
            : 'Не вдалося зберегти. Спробуйте ще раз.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (!authUser) return null

  return (
    <div className={`modal-backdrop ${isEntered ? 'is-entered' : ''}`}>
      <div className="modal-content editor-modal">
        <h2 className="editor-title">
          {editing
            ? isEn
              ? 'Edit article'
              : 'Редагувати статтю'
            : isEn
              ? 'New article'
              : 'Нова стаття'}
        </h2>

        <form className="editor-form" onSubmit={save}>
          <label className="auth-label">
            {isEn ? 'Title' : 'Заголовок'}
            <input
              className="auth-input"
              value={title}
              maxLength={120}
              onChange={e => setTitle(e.target.value)}
              placeholder={isEn ? 'What is this about?' : 'Про що стаття?'}
            />
          </label>

          <div className="editor-row">
            <label className="auth-label editor-col">
              {isEn ? 'Category' : 'Категорія'}
              <select
                className="auth-input"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {ARTICLE_CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>
                    {isEn ? c.en : c.ua}
                  </option>
                ))}
              </select>
            </label>

            <div className="auth-label editor-col">
              <span>{isEn ? 'Cover image' : 'Обкладинка'}</span>
              <div className="article-cover-picker">
                {cover && <img src={cover} alt="" className="article-cover-preview" />}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => coverInputRef.current?.click()}
                >
                  <IconUpload size={15} /> {isEn ? 'Upload' : 'Завантажити'}
                </button>
                {cover && (
                  <button
                    type="button"
                    className="btn btn-icon"
                    title={isEn ? 'Remove cover' : 'Видалити обкладинку'}
                    aria-label={isEn ? 'Remove cover' : 'Видалити обкладинку'}
                    onClick={() => setCover('')}
                  >
                    <IconTrash size={15} />
                  </button>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  hidden
                  onChange={event => {
                    selectCover(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>

          <RichTextField
            value={html}
            onChange={setHtml}
            lang={lang}
            onError={setError}
            placeholder={isEn ? 'Write your article…' : 'Напишіть вашу статтю…'}
          />

          {error && (
            <p className="auth-error" role="alert">
              <IconWarning size={16} /> {error}
            </p>
          )}

          <div className="editor-actions modal-command-bar">
            <button className="btn btn-action modal-primary" type="submit" disabled={busy}>
              {busy
                ? isEn
                  ? 'Saving…'
                  : 'Збереження…'
                : editing
                  ? isEn
                    ? 'Save changes'
                    : 'Зберегти зміни'
                  : isEn
                    ? 'Publish'
                    : 'Опублікувати'}
            </button>
            <button type="button" className="btn btn-outline modal-dismiss" onClick={onClose}>
              {isEn ? 'Close' : 'Закрити'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
