import { useCallback, useState } from 'react'
import * as api from '../utils/api'
import { useApiResource } from '../hooks/useApiResource'
import { resolveSiteImage } from '../data/images'
import { localizeClass, localizeRace } from '../data/dndTraits'
import { apiErrorMessage } from '../utils/apiErrors'
import { IconShield } from './Icons'
import PagedList from './PagedList'
import ConfirmDialog from './ConfirmDialog'
import UserLink from './UserLink'

export default function IgnoredPanel({ lang, authUser }) {
  const isEn = lang === 'en'
  const enabled = Boolean(authUser)
  const viewerKey = authUser?.login ?? ''
  const load = useCallback(() => api.fetchIgnored(), [viewerKey])
  const ignored = useApiResource(load, { enabled })

  const [login, setLogin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)

  const fetchPage = useCallback(
    ({ q, page, pageSize }) => api.fetchIgnored({ q, page, pageSize }),
    [],
  )

  if (!enabled) return null

  const data = ignored.data || { items: [], total: 0, hasMore: false, pageSize: 10 }

  const add = async event => {
    event.preventDefault()
    const target = login.trim()
    if (!target) return
    setBusy(true)
    setError('')
    try {
      await api.addIgnore(target)
      setLogin('')
      ignored.reload()
    } catch (problem) {
      setError(apiErrorMessage(problem, lang))
    } finally {
      setBusy(false)
    }
  }

  const drop = async userId => {
    setBusy(true)
    setError('')
    try {
      await api.removeIgnore(userId)
      ignored.reload()
    } catch (problem) {
      setError(apiErrorMessage(problem, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="profile-card friends-card">
      <h2 className="profile-card-title">
        <IconShield size={20} /> {isEn ? 'Ignored players' : 'Ігноровані гравці'}
      </h2>

      <form className="friend-invite" onSubmit={add}>
        <input
          className="modal-input"
          placeholder={isEn ? 'Login of the player' : 'Логін гравця'}
          value={login}
          maxLength={32}
          onChange={event => setLogin(event.target.value)}
        />
        <button className="btn btn-outline btn-sm" disabled={busy || !login.trim()}>
          {isEn ? 'Ignore' : 'Ігнорувати'}
        </button>
      </form>

      {confirm && (
        <ConfirmDialog
          title={isEn ? 'Stop ignoring?' : 'Припинити ігнорування?'}
          text={
            isEn
              ? `You will see comments from ${confirm.name} again.`
              : `Ви знову бачитимете коментарі гравця ${confirm.name}.`
          }
          confirmLabel={isEn ? 'Stop' : 'Припинити'}
          isEn={isEn}
          busy={busy}
          onConfirm={async () => {
            const pending = confirm
            setConfirm(null)
            await drop(pending.userId)
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {error && <p className="offline-banner">{error}</p>}

      {ignored.status === 'loading' && (
        <p className="friend-empty">{isEn ? 'Loading…' : 'Завантаження…'}</p>
      )}

      {data.items.length === 0 ? (
        <p className="friend-empty">
          {isEn
            ? 'Nobody is ignored. Their comments stay hidden and they cannot add you as a friend.'
            : 'Список порожній. Коментарі ігнорованих приховані, і вони не можуть додати вас у друзі.'}
        </p>
      ) : (
        <PagedList
          initial={data.items}
          total={data.total}
          initialHasMore={data.hasMore}
          pageSize={data.pageSize}
          isEn={isEn}
          searchable
          searchPlaceholder={isEn ? 'Search by name or login' : 'Пошук за іменем або логіном'}
          searchLabel={isEn ? 'Search ignored players' : 'Пошук серед ігнорованих'}
          emptyText={isEn ? 'Nobody found.' : 'Нікого не знайдено.'}
          fetchPage={fetchPage}
          listClassName="friend-list"
          renderRow={person => (
            <li className="friend-row" key={person.userId}>
              <img className="friend-avatar" src={resolveSiteImage(person.avatar)} alt="" />
              <div className="friend-main">
                <UserLink login={person.login} className="friend-name">
                  {person.name || person.login}
                </UserLink>
                <span className="friend-meta">
                  {localizeClass(person.charClass, lang)} · {localizeRace(person.race, lang)} ·{' '}
                  {isEn ? 'level' : 'рівень'} {person.level}
                </span>
              </div>
              <div className="friend-actions">
                <button
                  className="btn btn-outline btn-sm"
                  disabled={busy}
                  onClick={() =>
                    setConfirm({ userId: person.userId, name: person.name || person.login })
                  }
                >
                  {isEn ? 'Stop ignoring' : 'Припинити'}
                </button>
              </div>
            </li>
          )}
          header={counter =>
            counter ? (
              <h3 className="friend-group">
                <span className="paged-count">{counter}</span>
              </h3>
            ) : null
          }
        />
      )}
    </div>
  )
}
