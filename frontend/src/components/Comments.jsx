import { useState, useEffect, useCallback } from 'react'
import * as api from '../utils/api'
import { formatDate } from '../utils/date'
import { apiErrorMessage } from '../utils/apiErrors'
import { useApiResource } from '../hooks/useApiResource'
import { IconTrash, IconWizard, IconPencil, IconComment } from './Icons'
import { DiceDivider } from './Dice'
import Pagination from './Pagination'
import UserLink from './UserLink'

const MAX_REPLY_DEPTH = 5

function buildTree(list) {
  const roots = []
  const byId = new Map(list.map(c => [c.id, { ...c, replies: [] }]))
  for (const c of byId.values()) {
    const parent = c.parentId ? byId.get(c.parentId) : null
    if (parent) parent.replies.push(c)
    else roots.push(c)
  }
  return roots
}

export default function Comments({ type, id, lang, authUser, onRequestAuth }) {
  const isEn = lang === 'en'
  const [page, setPage] = useState(1)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')

  const [hardDeleteTarget, setHardDeleteTarget] = useState(null)
  const isAdmin = Boolean(authUser?.isAdmin)

  const load = useCallback(() => api.fetchComments(type, id, { page }), [id, page, type])
  const resource = useApiResource(load)
  const result = resource.data
  const items = result?.items ?? []

  const submit = async e => {
    e.preventDefault()
    if (!authUser) {
      onRequestAuth?.()
      return
    }
    const body = text.trim()
    if (!body) return

    setBusy(true)
    setError('')
    try {
      const parentId = replyTo?.id ?? null
      await api.addComment(type, id, body, parentId)
      setText('')
      setReplyTo(null)
      if (parentId === null && page !== 1) setPage(1)
      else resource.reload()
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          lang,
          isEn ? 'Failed to post. Try again.' : 'Не вдалося надіслати. Спробуйте ще раз.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async commentId => {
    const previous = result
    resource.setData(current => ({
      ...current,
      items: current.items.map(comment =>
        comment.id === commentId ? { ...comment, deleted: true, body: '', author: '' } : comment,
      ),
      commentCount: Math.max(0, current.commentCount - 1),
    }))
    try {
      await api.deleteComment(commentId)
    } catch {
      resource.setData(previous)
    }
  }

  const startEdit = comment => {
    setEditingId(comment.id)
    setEditText(comment.body)
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
    setEditError('')
  }

  const saveEdit = async commentId => {
    const body = editText.trim()
    if (!body) return
    setEditBusy(true)
    setEditError('')
    try {
      await api.updateComment(commentId, body)
      cancelEdit()
      resource.reload()
    } catch (err) {
      setEditError(
        apiErrorMessage(
          err,
          lang,
          isEn ? 'Failed to save. Try again.' : 'Не вдалося зберегти. Спробуйте ще раз.',
        ),
      )
    } finally {
      setEditBusy(false)
    }
  }

  const restore = async commentId => {
    try {
      await api.restoreComment(commentId)
      resource.reload()
    } catch {}
  }

  const hardDelete = async () => {
    const target = hardDeleteTarget
    if (!target) return
    setHardDeleteTarget(null)
    try {
      await api.hardDeleteComment(target.id)
      resource.reload()
    } catch {}
  }

  useEffect(() => {
    if (!hardDeleteTarget) return
    const onKey = e => {
      if (e.key === 'Escape') setHardDeleteTarget(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hardDeleteTarget])

  const tree = buildTree(items)
  const total = result?.commentCount ?? 0

  return (
    <section className="comments" data-od-id="comments">
      <h2 className="section-title comments-title">
        {isEn ? 'Discussion' : 'Обговорення'}
        {total > 0 && <span className="comments-count">{total}</span>}
      </h2>
      <DiceDivider />

      <form className="comment-form" onSubmit={submit}>
        {replyTo && (
          <div className="comment-reply-hint">
            {isEn ? 'Replying to' : 'Відповідь для'} <strong>{replyTo.author}</strong>
            <button
              type="button"
              className="btn-text btn-text--link comment-cancel"
              onClick={() => setReplyTo(null)}
            >
              {isEn ? 'cancel' : 'скасувати'}
            </button>
          </div>
        )}
        <textarea
          className="comment-input"
          rows={replyTo ? 3 : 4}
          maxLength={4000}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={
            authUser
              ? isEn
                ? 'Share your thoughts…'
                : 'Поділіться думкою…'
              : isEn
                ? 'Sign in to join the discussion'
                : 'Увійдіть, щоб долучитися до обговорення'
          }
          onFocus={() => {
            if (!authUser) onRequestAuth?.()
          }}
        />
        {error && (
          <p className="comment-error" role="alert">
            {error}
          </p>
        )}
        <div className="comment-form-actions">
          <span className="comment-counter">{text.length}/4000</span>
          <button className="btn btn-action" type="submit" disabled={busy || !text.trim()}>
            {busy ? (isEn ? 'Sending…' : 'Надсилання…') : isEn ? 'Post' : 'Надіслати'}
          </button>
        </div>
      </form>

      {resource.status === 'error' && (
        <p className="offline-banner">
          {apiErrorMessage(
            resource.error,
            lang,
            isEn ? 'Could not load comments.' : 'Не вдалося завантажити коментарі.',
          )}
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              api.resetServerState()
              resource.reload()
            }}
          >
            {isEn ? 'Retry' : 'Повторити'}
          </button>
        </p>
      )}

      {resource.status === 'loading' && !result ? (
        <p className="comments-empty">{isEn ? 'Loading…' : 'Завантаження…'}</p>
      ) : resource.status === 'error' && !result ? null : tree.length === 0 ? (
        <p className="comments-empty">
          {isEn ? 'No comments yet. Be the first.' : 'Коментарів ще немає. Будьте першим.'}
        </p>
      ) : (
        <ul className="comment-list">
          {tree.map(c => (
            <CommentNode
              key={c.id}
              node={c}
              isEn={isEn}
              lang={lang}
              onReply={setReplyTo}
              onDelete={remove}
              canReply={Boolean(authUser)}
              isAdmin={isAdmin}
              editingId={editingId}
              editText={editText}
              editBusy={editBusy}
              editError={editError}
              onStartEdit={startEdit}
              onEditChange={setEditText}
              onEditSave={saveEdit}
              onEditCancel={cancelEdit}
              onRestore={restore}
              onHardDelete={setHardDeleteTarget}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={result?.page ?? page}
        totalPages={result?.totalPages ?? 0}
        total={result?.total ?? 0}
        lang={lang}
        onPageChange={setPage}
      />

      {hardDeleteTarget && (
        <div className="modal-overlay">
          <div
            className="modal-box confirm-box"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="hard-delete-title"
          >
            <h2 className="modal-title" id="hard-delete-title">
              {isEn ? 'Delete thread?' : 'Видалити гілку?'}
            </h2>
            <p className="confirm-text">
              {isEn
                ? 'The comment and all its replies will be deleted permanently. This cannot be undone.'
                : 'Коментар і всі відповіді на нього будуть видалені назавжди. Цю дію неможливо скасувати.'}
            </p>
            <div className="modal-actions modal-command-bar">
              <button className="btn btn-action btn-danger modal-primary" onClick={hardDelete}>
                <IconTrash size={14} /> {isEn ? 'Delete' : 'Видалити'}
              </button>
              <button
                className="btn btn-outline modal-dismiss"
                onClick={() => setHardDeleteTarget(null)}
              >
                {isEn ? 'Close' : 'Закрити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function CommentNode({
  node,
  isEn,
  lang,
  onReply,
  onDelete,
  canReply,
  isAdmin,
  depth = 0,
  editingId,
  editText,
  editBusy,
  editError,
  onStartEdit,
  onEditChange,
  onEditSave,
  onEditCancel,
  onRestore,
  onHardDelete,
}) {
  const editing = editingId === node.id
  return (
    <li
      className={`comment${node.deleted ? ' is-deleted' : ''}${node.ignored ? ' is-ignored' : ''}`}
    >
      <div className="comment-head">
        <span className="comment-author">
          <IconWizard size={15} />{' '}
          {node.deleted ? (
            isEn ? (
              'deleted'
            ) : (
              'видалено'
            )
          ) : (
            <UserLink login={node.authorLogin}>{node.author}</UserLink>
          )}
        </span>
        <span className="comment-date">{formatDate(node.date, lang, true)}</span>
      </div>

      {editing ? (
        <div className="comment-edit">
          <textarea
            className="comment-input"
            rows={3}
            maxLength={4000}
            value={editText}
            onChange={e => onEditChange(e.target.value)}
          />
          {editError && (
            <p className="comment-error" role="alert">
              {editError}
            </p>
          )}
          <div className="comment-edit-actions">
            <button
              className="btn btn-action btn-sm"
              onClick={() => onEditSave(node.id)}
              disabled={editBusy || !editText.trim()}
            >
              {editBusy ? (isEn ? 'Saving…' : 'Збереження…') : isEn ? 'Save' : 'Зберегти'}
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={onEditCancel}>
              {isEn ? 'Cancel' : 'Скасувати'}
            </button>
          </div>
        </div>
      ) : (
        <p className="comment-body">
          {node.deleted
            ? isEn
              ? 'Comment removed'
              : 'Коментар видалено'
            : node.ignored
              ? isEn
                ? 'Hidden: you ignore this player.'
                : 'Приховано: ви ігноруєте цього гравця.'
              : node.body}
        </p>
      )}

      {node.deleted && isAdmin && (
        <div className="comment-actions">
          <button className="btn-text" onClick={() => onRestore(node.id)}>
            {isEn ? 'Restore' : 'Відновити'}
          </button>
          <button className="btn-text btn-danger" onClick={() => onHardDelete(node)}>
            {isEn ? 'Delete permanently' : 'Видалити повністю'}
          </button>
        </div>
      )}

      {!node.deleted && !node.ignored && !editing && (
        <div className="comment-actions">
          {canReply && depth < MAX_REPLY_DEPTH && (
            <button className="btn-text" onClick={() => onReply(node)}>
              <IconComment size={14} /> {isEn ? 'Reply' : 'Відповісти'}
            </button>
          )}

          {node.canEdit && (
            <button className="btn-text" onClick={() => onStartEdit(node)}>
              <IconPencil size={14} /> {isEn ? 'Edit' : 'Редагувати'}
            </button>
          )}
          {node.isOwner && (
            <button
              className="btn-text btn-danger"
              onClick={() => onDelete(node.id)}
              aria-label={isEn ? 'Delete comment' : 'Видалити коментар'}
            >
              <IconTrash size={14} /> {isEn ? 'Delete' : 'Видалити'}
            </button>
          )}
        </div>
      )}

      {node.replies?.length > 0 && (
        <ul className="comment-replies">
          {node.replies.map(r => (
            <CommentNode
              key={r.id}
              node={r}
              isEn={isEn}
              depth={depth + 1}
              lang={lang}
              onReply={onReply}
              onDelete={onDelete}
              canReply={canReply}
              isAdmin={isAdmin}
              editingId={editingId}
              editText={editText}
              editBusy={editBusy}
              editError={editError}
              onStartEdit={onStartEdit}
              onEditChange={onEditChange}
              onEditSave={onEditSave}
              onEditCancel={onEditCancel}
              onRestore={onRestore}
              onHardDelete={onHardDelete}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
