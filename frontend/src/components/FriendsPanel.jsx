import { useCallback, useState } from 'react'
import * as api from '../utils/api'
import { useApiResource } from '../hooks/useApiResource'
import { useOverlayTransition } from '../hooks/useOverlayTransition'
import { resolveSiteImage } from '../data/images'
import { localizeClass, localizeRace } from '../data/dndTraits'
import { apiErrorMessage } from '../utils/apiErrors'
import { IconUser } from './Icons'
import PagedList from './PagedList'
import ConfirmDialog from './ConfirmDialog'
import UserLink from './UserLink'

function FriendRow({ person, lang, isEn, actions, busy, onAction }) {
  return (
    <li className="friend-row">
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
        {actions.map(action => (
          <button
            key={action.kind}
            className={`btn ${action.primary ? 'btn-action' : 'btn-outline'} btn-sm`}
            disabled={busy}
            onClick={() => onAction(action.kind, person.id, person)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </li>
  )
}

function FriendGroup({ kind, title, data, lang, isEn, busy, onAction, actions, searchable }) {
  const fetchPage = useCallback(
    ({ q, page, pageSize }) => api.fetchFriendList({ kind, q, page, pageSize }),
    [kind],
  )

  return (
    <PagedList
      initial={data.items}
      total={data.total}
      initialHasMore={data.hasMore}
      pageSize={data.pageSize}
      isEn={isEn}
      searchable={searchable}
      searchPlaceholder={isEn ? 'Search by name or login' : 'Пошук за іменем або логіном'}
      searchLabel={isEn ? 'Search friends' : 'Пошук серед друзів'}
      emptyText={isEn ? 'Nobody found.' : 'Нікого не знайдено.'}
      fetchPage={fetchPage}
      listClassName="friend-list"
      renderRow={person => (
        <FriendRow
          key={person.id}
          person={person}
          lang={lang}
          isEn={isEn}
          busy={busy}
          onAction={onAction}
          actions={actions}
        />
      )}
      header={counter =>
        title || counter ? (
          <h3 className="friend-group">
            {title}
            {counter && (
              <span className="paged-count">
                {title ? ' ' : ''}
                {counter}
              </span>
            )}
          </h3>
        ) : null
      }
    />
  )
}

export default function FriendsPanel({ lang, authUser }) {
  const isEn = lang === 'en'
  const enabled = Boolean(authUser)
  const viewerKey = authUser?.login ?? ''
  const load = useCallback(() => api.fetchFriends(), [viewerKey])
  const friends = useApiResource(load, { enabled })

  const [login, setLogin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState(null)
  const noticeOverlay = useOverlayTransition(notice || null)

  if (!enabled) return null

  const data = friends.data || {
    friends: [],
    incoming: [],
    outgoing: [],
    friendsTotal: 0,
    incomingTotal: 0,
    outgoingTotal: 0,
    pageSize: 10,
  }

  const run = async (kind, id) => {
    setBusy(true)
    setError('')
    try {
      if (kind === 'accept') await api.acceptFriend(id)
      if (kind === 'remove') await api.removeFriend(id)
      friends.reload()
    } catch (problem) {
      setError(apiErrorMessage(problem, lang))
    } finally {
      setBusy(false)
    }
  }

  const invite = async event => {
    event.preventDefault()
    const target = login.trim()
    if (!target) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.requestFriend(target)
      setLogin('')
      setNotice(isEn ? 'Request sent.' : 'Заявку надіслано.')
      friends.reload()
    } catch (problem) {
      setError(apiErrorMessage(problem, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="profile-card friends-card">
      <h2 className="profile-card-title">
        <IconUser size={20} /> {isEn ? 'Friends' : 'Друзі'}
      </h2>

      <form className="friend-invite" onSubmit={invite}>
        <input
          className="modal-input"
          placeholder={isEn ? 'Login of the player' : 'Логін гравця'}
          value={login}
          maxLength={32}
          onChange={event => setLogin(event.target.value)}
        />
        <button className="btn btn-action btn-sm" disabled={busy || !login.trim()}>
          {isEn ? 'Add' : 'Додати'}
        </button>
      </form>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          text={confirm.text}
          confirmLabel={confirm.label}
          isEn={isEn}
          busy={busy}
          onConfirm={async () => {
            const pending = confirm
            setConfirm(null)
            await run('remove', pending.id)
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {error && <p className="offline-banner">{error}</p>}
      {noticeOverlay.isMounted && (
        <p className={`friend-notice ${noticeOverlay.isEntered ? 'is-entered' : ''}`}>
          {noticeOverlay.value}
        </p>
      )}

      {friends.status === 'loading' && (
        <p className="friend-empty">{isEn ? 'Loading…' : 'Завантаження…'}</p>
      )}

      {data.incoming.length > 0 && (
        <FriendGroup
          kind="incoming"
          title={isEn ? 'Incoming requests' : 'Вхідні заявки'}
          data={{
            items: data.incoming,
            total: data.incomingTotal,
            hasMore: data.incomingHasMore,
            pageSize: data.pageSize,
          }}
          lang={lang}
          isEn={isEn}
          busy={busy}
          onAction={run}
          actions={[
            { kind: 'accept', label: isEn ? 'Accept' : 'Прийняти', primary: true },
            { kind: 'remove', label: isEn ? 'Decline' : 'Відхилити' },
          ]}
        />
      )}

      {data.outgoing.length > 0 && (
        <FriendGroup
          kind="outgoing"
          title={isEn ? 'Sent requests' : 'Надіслані заявки'}
          data={{
            items: data.outgoing,
            total: data.outgoingTotal,
            hasMore: data.outgoingHasMore,
            pageSize: data.pageSize,
          }}
          lang={lang}
          isEn={isEn}
          busy={busy}
          onAction={run}
          actions={[{ kind: 'remove', label: isEn ? 'Cancel' : 'Скасувати' }]}
        />
      )}

      {data.friends.length === 0 ? (
        <p className="friend-empty">
          {isEn
            ? 'No friends yet. Add someone by their login.'
            : 'Друзів поки немає. Додайте когось за логіном.'}
        </p>
      ) : (
        <FriendGroup
          kind="friends"
          title={null}
          data={{
            items: data.friends,
            total: data.friendsTotal,
            hasMore: data.friendsHasMore,
            pageSize: data.pageSize,
          }}
          lang={lang}
          isEn={isEn}
          busy={busy}
          onAction={(kind, id, person) =>
            kind === 'remove'
              ? setConfirm({
                  id,
                  title: isEn ? 'Remove from friends?' : 'Прибрати з друзів?',
                  label: isEn ? 'Remove' : 'Прибрати',
                  text: isEn
                    ? `${person?.name || person?.login} will no longer be in your party. You can send a new request later.`
                    : `${person?.name || person?.login} більше не буде у вашому загоні. Згодом можна надіслати нову заявку.`,
                })
              : run(kind, id)
          }
          searchable
          actions={[{ kind: 'remove', label: isEn ? 'Remove' : 'Прибрати' }]}
        />
      )}
    </div>
  )
}
