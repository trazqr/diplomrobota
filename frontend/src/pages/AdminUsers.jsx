import { useCallback, useState } from 'react'
import * as api from '../utils/api'
import { formatDate } from '../utils/date'
import { apiErrorMessage } from '../utils/apiErrors'
import { useApiResource } from '../hooks/useApiResource'
import { useOverlayTransition } from '../hooks/useOverlayTransition'
import {
  IconUser,
  IconShield,
  IconScroll,
  IconComment,
  IconWarning,
  IconTrash,
  IconStar,
  IconPencil,
} from '../components/Icons'
import Pagination from '../components/Pagination'
import { resolveSiteImage } from '../data/images'

export default function AdminUsers({ lang, authUser }) {
  const isEn = lang === 'en'

  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const [banning, setBanning] = useState(null)

  const [deleting, setDeleting] = useState(null)

  const [resetting, setResetting] = useState(null)

  const load = useCallback(() => api.fetchUsers({ page }), [page])
  const resource = useApiResource(load)
  const result = resource.data
  const users = result?.items ?? []

  const changeRole = async (user, role) => {
    setError('')
    setBusyId(user.id)
    try {
      const r = await api.setUserRole(user.id, role)
      resource.setData(current => ({
        ...current,
        items: current.items.map(item => (item.id === r.id ? { ...item, role: r.role } : item)),
        adminCount: current.adminCount + (role === 'admin' ? 1 : -1),
      }))
    } catch (err) {
      setError(apiErrorMessage(err, lang))
    } finally {
      setBusyId(null)
    }
  }

  const applyBan = async (user, banned, reason = '') => {
    setError('')
    setBusyId(user.id)
    try {
      const r = await api.setUserBan(user.id, banned, reason)
      resource.setData(current => ({
        ...current,
        items: current.items.map(item =>
          item.id === r.id
            ? { ...item, banned: r.banned, banReason: r.banReason, bannedAt: r.bannedAt }
            : item,
        ),
      }))
      setBanning(null)
    } catch (err) {
      setError(apiErrorMessage(err, lang))
    } finally {
      setBusyId(null)
    }
  }

  const removeUser = async user => {
    setError('')
    setBusyId(user.id)
    try {
      await api.deleteUser(user.id)
      setDeleting(null)
      if (users.length === 1 && page > 1) setPage(value => value - 1)
      else resource.reload()
    } catch (err) {
      setError(apiErrorMessage(err, lang))
    } finally {
      setBusyId(null)
    }
  }

  const applyReset = async () => {
    const { user, password } = resetting
    setError('')
    setBusyId(user.id)
    try {
      const r = await api.resetUserPassword(user.id, password.trim())
      setResetting(prev => ({ ...prev, result: r.password || '' }))
    } catch (err) {
      setError(apiErrorMessage(err, lang))
    } finally {
      setBusyId(null)
    }
  }

  const admins = result?.adminCount ?? 0
  const banOverlay = useOverlayTransition(banning)
  const deleteOverlay = useOverlayTransition(deleting)
  const resetOverlay = useOverlayTransition(resetting)

  return (
    <div className="admin-users">
      <p className="admin-users-hint">
        {isEn
          ? 'An admin can edit and delete any article, manage news and grant rights.'
          : 'Адміністратор може редагувати й видаляти будь-яку статтю, керувати новинами та надавати права.'}
      </p>

      {error && (
        <p className="auth-error" role="alert">
          <IconWarning size={16} /> {error}
        </p>
      )}

      {resource.status === 'error' && (
        <p className="offline-banner">
          {apiErrorMessage(
            resource.error,
            lang,
            isEn ? 'Could not load accounts.' : 'Не вдалося завантажити облікові записи.',
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

      {resource.status === 'loading' && !result && (
        <p className="admin-users-hint">
          {isEn ? 'Loading accounts…' : 'Завантаження облікових записів…'}
        </p>
      )}

      <ul className="admin-users-list">
        {users.map(u => {
          const isMe = u.login === authUser?.login

          const lockedAdmin = u.role === 'admin' && (isMe || admins <= 1)

          const canReset = !isMe && (authUser?.isOwner || (!u.isOwner && u.role !== 'admin'))

          const canDemote = !lockedAdmin && !u.isOwner && Boolean(authUser?.isOwner)

          return (
            <li key={u.id} className="admin-user">
              <span className="admin-user-avatar">
                {u.avatar ? (
                  <img src={resolveSiteImage(u.avatar)} alt="" />
                ) : (
                  <IconUser size={20} />
                )}
              </span>

              <div className="admin-user-body">
                <span className="admin-user-name">
                  {u.name}
                  {isMe && <span className="admin-user-you">{isEn ? 'you' : 'це ви'}</span>}
                  {u.isOwner && (
                    <span
                      className="admin-user-owner"
                      title={
                        isEn ? 'The first account of the forum' : 'Перший обліковий запис форуму'
                      }
                    >
                      <IconStar size={11} /> {isEn ? 'owner' : 'власник'}
                    </span>
                  )}
                </span>
                <span className="admin-user-login">
                  @{u.login} · {isEn ? 'since' : 'з'} {formatDate(u.createdAt, lang)}
                </span>
                <span className="admin-user-stats">
                  <IconScroll size={14} /> {u.articles}
                  <IconComment size={14} /> {u.comments}
                </span>
                {u.banned && (
                  <span className="admin-user-ban">
                    <IconWarning size={13} />
                    {isEn ? 'Blocked' : 'Заблоковано'}
                    {u.bannedAt && ` · ${formatDate(u.bannedAt, lang)}`}
                    {u.banReason && ` · ${u.banReason}`}
                  </span>
                )}
              </div>

              <span className={`admin-user-role role-${u.role}`}>
                {u.role === 'admin' ? (
                  <>
                    <IconShield size={13} /> {isEn ? 'Admin' : 'Адміністратор'}
                  </>
                ) : isEn ? (
                  'User'
                ) : (
                  'Користувач'
                )}
              </span>

              <div className="admin-user-actions">
                {u.role === 'admin' ? (
                  <button
                    className="btn btn-outline"
                    disabled={!canDemote || busyId === u.id}
                    title={
                      u.isOwner
                        ? isEn
                          ? 'The forum owner keeps their rights'
                          : 'Права власника форуму незнімні'
                        : lockedAdmin
                          ? isMe
                            ? isEn
                              ? 'You cannot demote yourself'
                              : 'Не можна зняти права з себе'
                            : isEn
                              ? 'The last admin'
                              : 'Останній адміністратор'
                          : !canDemote
                            ? isEn
                              ? 'Only the forum owner can revoke admin rights'
                              : 'Знімати права з адміністратора може лише власник'
                            : undefined
                    }
                    onClick={() => changeRole(u, 'user')}
                  >
                    {isEn ? 'Revoke rights' : 'Зняти права'}
                  </button>
                ) : (
                  <button
                    className="btn btn-outline"
                    disabled={u.banned || busyId === u.id}
                    title={u.banned ? (isEn ? 'Unblock first' : 'Спочатку розблокуйте') : undefined}
                    onClick={() => changeRole(u, 'admin')}
                  >
                    {isEn ? 'Make admin' : 'Зробити адміном'}
                  </button>
                )}

                {!u.isOwner &&
                  u.role !== 'admin' &&
                  (u.banned ? (
                    <button
                      className="btn btn-outline"
                      disabled={busyId === u.id}
                      onClick={() => applyBan(u, false)}
                    >
                      {isEn ? 'Unblock' : 'Розблокувати'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-outline btn-danger"
                      disabled={busyId === u.id}
                      onClick={() => setBanning({ user: u, reason: '' })}
                    >
                      {isEn ? 'Block' : 'Заблокувати'}
                    </button>
                  ))}

                {canReset && (
                  <button
                    className="btn btn-outline"
                    disabled={busyId === u.id}
                    title={isEn ? 'Reset password' : 'Скинути пароль'}
                    onClick={() => setResetting({ user: u, password: '', result: null })}
                  >
                    <IconPencil size={14} />
                  </button>
                )}

                {!u.isOwner && u.role !== 'admin' && (
                  <button
                    className="btn btn-outline btn-danger"
                    disabled={busyId === u.id}
                    title={isEn ? 'Delete account' : 'Видалити обліковий запис'}
                    onClick={() => setDeleting(u)}
                  >
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <Pagination
        page={result?.page ?? page}
        totalPages={result?.totalPages ?? 0}
        total={result?.total ?? 0}
        lang={lang}
        onPageChange={setPage}
      />

      {banOverlay.isMounted && (
        <div className={`modal-backdrop ${banOverlay.isEntered ? 'is-entered' : ''}`}>
          <div className="modal-content ban-modal">
            <h3 className="admin-form-title">
              {isEn ? 'Block account' : 'Заблокувати обліковий запис'}
            </h3>
            <p className="admin-users-hint">
              {isEn
                ? `${banOverlay.value.user.name} (@${banOverlay.value.user.login}) will not be able to sign in. Articles and comments stay in place.`
                : `${banOverlay.value.user.name} (@${banOverlay.value.user.login}) не зможе увійти. Статті та коментарі залишаться на місці.`}
            </p>

            <label className="auth-label">
              {isEn ? 'Reason' : 'Причина'}
              <input
                className="auth-input"
                value={banOverlay.value.reason}
                onChange={e => setBanning(b => ({ ...b, reason: e.target.value }))}
                placeholder={
                  isEn ? 'Visible to the user on sign-in' : 'Побачить користувач при спробі входу'
                }
                maxLength={300}
                autoFocus
              />
            </label>

            <div className="ban-modal-actions modal-command-bar">
              <button
                className="btn btn-action modal-primary"
                disabled={busyId === banOverlay.value.user.id}
                onClick={() => applyBan(banOverlay.value.user, true, banOverlay.value.reason)}
              >
                {isEn ? 'Block' : 'Заблокувати'}
              </button>
              <button className="btn btn-outline modal-dismiss" onClick={() => setBanning(null)}>
                {isEn ? 'Close' : 'Закрити'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOverlay.isMounted && (
        <div className={`modal-backdrop ${deleteOverlay.isEntered ? 'is-entered' : ''}`}>
          <div className="modal-content ban-modal">
            <h3 className="admin-form-title">
              {isEn ? 'Delete account' : 'Видалити обліковий запис'}
            </h3>
            <p className="admin-users-hint">
              {isEn
                ? `${deleteOverlay.value.name} (@${deleteOverlay.value.login}) will be removed permanently.`
                : `${deleteOverlay.value.name} (@${deleteOverlay.value.login}) буде видалено назавжди.`}
            </p>

            {deleteOverlay.value.articles > 0 || deleteOverlay.value.comments > 0 ? (
              <>
                <ul className="delete-summary">
                  {deleteOverlay.value.articles > 0 && (
                    <li>
                      <IconScroll size={14} /> {isEn ? 'Articles' : 'Статті'}:{' '}
                      {deleteOverlay.value.articles}
                    </li>
                  )}
                  {deleteOverlay.value.comments > 0 && (
                    <li>
                      <IconComment size={14} /> {isEn ? 'Comments' : 'Коментарі'}:{' '}
                      {deleteOverlay.value.comments}
                    </li>
                  )}
                </ul>

                <p className="delete-warning">
                  <IconWarning size={16} />
                  <span>
                    {isEn
                      ? 'These will be deleted along with the account. Comments left by others under those articles disappear too. Blocking keeps everything in place.'
                      : 'Усе це буде видалено разом з обліковим записом. Чужі коментарі під цими статтями теж зникнуть. Блокування залишає матеріали на місці.'}
                  </span>
                </p>
              </>
            ) : (
              <p className="admin-users-hint">
                {isEn
                  ? 'This account has no articles or comments.'
                  : 'У цього запису немає статей і коментарів.'}
              </p>
            )}

            <div className="ban-modal-actions modal-command-bar">
              <button
                className="btn btn-action btn-danger modal-primary"
                disabled={busyId === deleteOverlay.value.id}
                onClick={() => removeUser(deleteOverlay.value)}
              >
                {isEn ? 'Delete permanently' : 'Видалити назавжди'}
              </button>
              <button className="btn btn-outline modal-dismiss" onClick={() => setDeleting(null)}>
                {isEn ? 'Close' : 'Закрити'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetOverlay.isMounted && (
        <div className={`modal-backdrop ${resetOverlay.isEntered ? 'is-entered' : ''}`}>
          <div className="modal-content ban-modal">
            <h3 className="admin-form-title">{isEn ? 'Reset password' : 'Скинути пароль'}</h3>

            {resetOverlay.value.result === null ? (
              <>
                <p className="admin-users-hint">
                  {isEn
                    ? `A new password for ${resetOverlay.value.user.name} (@${resetOverlay.value.user.login}). All their sessions will be closed.`
                    : `Новий пароль для ${resetOverlay.value.user.name} (@${resetOverlay.value.user.login}). Усі його сеанси буде завершено.`}
                </p>

                <label className="auth-label">
                  {isEn ? 'Password' : 'Пароль'}
                  <input
                    className="auth-input"
                    value={resetOverlay.value.password}
                    onChange={e => setResetting(r => ({ ...r, password: e.target.value }))}
                    placeholder={
                      isEn ? 'Leave empty to generate' : 'Залиште порожнім — згенерується'
                    }
                    maxLength={128}
                    autoFocus
                  />
                  <span className="auth-hint">
                    {isEn ? 'At least 8 characters' : 'Щонайменше 8 символів'}
                  </span>
                </label>

                <div className="ban-modal-actions modal-command-bar">
                  <button
                    className="btn btn-action modal-primary"
                    disabled={busyId === resetOverlay.value.user.id}
                    onClick={applyReset}
                  >
                    {isEn ? 'Reset' : 'Скинути'}
                  </button>
                  <button
                    className="btn btn-outline modal-dismiss"
                    onClick={() => setResetting(null)}
                  >
                    {isEn ? 'Close' : 'Закрити'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="admin-users-hint">
                  {resetOverlay.value.result
                    ? isEn
                      ? 'Give this password to the user. It is shown once — the database keeps only a hash.'
                      : 'Передайте цей пароль користувачу. Його показано один раз — у базі лише хеш.'
                    : isEn
                      ? 'The password has been changed.'
                      : 'Пароль змінено.'}
                </p>

                {resetOverlay.value.result && (
                  <p className="reset-password">{resetOverlay.value.result}</p>
                )}

                <div className="ban-modal-actions modal-command-bar">
                  <button
                    className="btn btn-outline modal-dismiss"
                    onClick={() => setResetting(null)}
                  >
                    {isEn ? 'Close' : 'Закрити'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {resource.status === 'ready' && users.length === 0 && (
        <p className="admin-users-hint">
          {isEn ? 'No accounts yet.' : 'Облікових записів ще немає.'}
        </p>
      )}
    </div>
  )
}
