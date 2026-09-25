import { useCallback, useState } from 'react'

import * as api from '../utils/api'
import { useApiResource } from '../hooks/useApiResource'
import { resolveSiteImage } from '../data/images'
import { localizeClass, localizeRace } from '../data/dndTraits'
import { formatDate } from '../utils/date'
import { apiErrorMessage } from '../utils/apiErrors'
import { DiceDivider } from '../components/Dice'
import {
  IconComment,
  IconNews,
  IconShield,
  IconStar,
  IconSwords,
  IconUser,
  IconUsers,
} from '../components/Icons'
import profileBgImg from '../assets/dungeon_hall.png'

const PROFILE_BG = profileBgImg

const ROLE_LABELS = {
  owner: ['Власник', 'Owner'],
  officer: ['Офіцер', 'Officer'],
  member: ['Учасник', 'Member'],
}

export default function UserProfilePage({ login, lang, authUser, onRequestAuth, onBack }) {
  const isEn = lang === 'en'
  const viewerKey = authUser?.login ?? ''
  const load = useCallback(() => api.fetchUserProfile(login), [login, viewerKey])
  const profile = useApiResource(load, { enabled: Boolean(login) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const data = profile.data

  async function run(kind) {
    if (!authUser) {
      onRequestAuth?.()
      return
    }

    setBusy(true)
    setError('')
    try {
      if (kind === 'request') await api.requestFriend(data.login)
      if (kind === 'accept') await api.acceptFriend(data.friendshipId)
      if (kind === 'remove') await api.removeFriend(data.friendshipId)
      if (kind === 'ignore') await api.addIgnore(data.login)
      if (kind === 'unignore') await api.removeIgnore(data.userId)
      profile.reload()
    } catch (err) {
      setError(apiErrorMessage(err, lang, isEn ? 'Action failed.' : 'Не вдалося виконати дію.'))
    } finally {
      setBusy(false)
    }
  }

  if (profile.status === 'loading' || profile.status === 'idle') {
    return (
      <section className="clans-section">
        <p className="offline-banner">{isEn ? 'Loading profile…' : 'Завантаження профілю…'}</p>
      </section>
    )
  }

  if (profile.status === 'error' || !data) {
    return (
      <section className="clans-section">
        <button className="article-back" onClick={onBack}>
          ← {isEn ? 'Back' : 'Назад'}
        </button>
        <p className="offline-banner">
          {isEn ? 'This adventurer was not found.' : 'Такого шукача пригод не знайдено.'}
        </p>
      </section>
    )
  }

  const clanRole = data.clan ? ROLE_LABELS[data.clan.role] : null

  const levelLabel = isEn ? `Level ${data.level}` : `Рівень ${data.level}`
  const xpPercent = Math.min(100, ((data.level - 1) / 19) * 100)

  return (
    <>
      <section className="profile-hero user-hero" style={{ backgroundImage: `url(${PROFILE_BG})` }}>
        <div className="profile-hero-overlay">
          <div className="user-hero-top">
            <button
              className="hero-back"
              onClick={onBack}
              aria-label={isEn ? 'Back to the previous page' : 'Назад на попередню сторінку'}
            >
              <span aria-hidden="true">←</span> {isEn ? 'Back' : 'Назад'}
            </button>
          </div>

          <div className="profile-hero-content">
            <div className="profile-avatar-wrapper">
              <img
                src={resolveSiteImage(data.avatar, 'ranger_green')}
                alt={
                  isEn ? `Avatar: ${data.name || data.login}` : `Аватар: ${data.name || data.login}`
                }
                className="profile-avatar"
              />
              <div className="profile-avatar-ring"></div>
            </div>

            <div className="profile-identity">
              <h1 className="profile-name">{data.name || data.login}</h1>
              <p className="user-profile-login">@{data.login}</p>
              <div className="profile-badges">
                <span className="profile-badge badge-class">
                  <IconSwords size={16} /> {localizeClass(data.charClass, lang)}
                </span>
                <span className="profile-badge badge-race">
                  <IconUser size={16} /> {localizeRace(data.race, lang)}
                </span>
              </div>

              <div className="profile-level-bar-wrap">
                <span className="profile-level-label">{levelLabel}</span>
                <div className="profile-level-bar">
                  <div className="profile-level-fill" style={{ width: `${xpPercent}%` }}></div>
                </div>
              </div>
            </div>

            {!data.isMe && (
              <div className="user-profile-actions">
                {data.ignored ? (
                  <button
                    className="btn btn-action"
                    disabled={busy}
                    onClick={() => run('unignore')}
                  >
                    <IconShield size={16} /> {isEn ? 'Stop ignoring' : 'Припинити ігнорування'}
                  </button>
                ) : (
                  <button className="btn btn-action" disabled={busy} onClick={() => run('ignore')}>
                    <IconShield size={16} /> {isEn ? 'Ignore' : 'Ігнорувати'}
                  </button>
                )}
                {!data.ignored && data.friendship === 'none' && (
                  <button className="btn btn-action" disabled={busy} onClick={() => run('request')}>
                    <IconUsers size={16} /> {isEn ? 'Add to friends' : 'Додати в друзі'}
                  </button>
                )}
                {!data.ignored && data.friendship === 'outgoing' && (
                  <button className="btn btn-action" disabled={busy} onClick={() => run('remove')}>
                    <IconUsers size={16} /> {isEn ? 'Cancel request' : 'Скасувати заявку'}
                  </button>
                )}
                {!data.ignored && data.friendship === 'incoming' && (
                  <>
                    <button
                      className="btn btn-action"
                      disabled={busy}
                      onClick={() => run('accept')}
                    >
                      <IconUsers size={16} /> {isEn ? 'Accept' : 'Прийняти'}
                    </button>
                    <button
                      className="btn btn-action"
                      disabled={busy}
                      onClick={() => run('remove')}
                    >
                      <IconUsers size={16} /> {isEn ? 'Decline' : 'Відхилити'}
                    </button>
                  </>
                )}
                {!data.ignored && data.friendship === 'accepted' && (
                  <button className="btn btn-action" disabled={busy} onClick={() => run('remove')}>
                    <IconUsers size={16} /> {isEn ? 'Remove friend' : 'Прибрати з друзів'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="clans-section user-profile">
        <p className="user-profile-since">
          {isEn ? 'With us since' : 'З нами від'} {formatDate(data.createdAt, lang)}
        </p>

        {error && <p className="offline-banner">{error}</p>}

        {data.bio && <p className="user-profile-bio">{data.bio}</p>}

        <ul className="user-profile-stats">
          <li className="profile-stat">
            <span className="stat-icon">
              <IconNews size={22} />
            </span>
            <span className="stat-value">{data.stats.articles}</span>
            <span className="stat-label">{isEn ? 'Articles' : 'Статей'}</span>
          </li>
          <li className="profile-stat">
            <span className="stat-icon">
              <IconComment size={22} />
            </span>
            <span className="stat-value">{data.stats.comments}</span>
            <span className="stat-label">{isEn ? 'Comments' : 'Коментарів'}</span>
          </li>
          <li className="profile-stat">
            <span className="stat-icon">
              <IconStar size={22} />
            </span>
            <span className="stat-value">{data.stats.likes}</span>
            <span className="stat-label">{isEn ? 'Likes earned' : 'Вподобань'}</span>
          </li>
          <li className="profile-stat">
            <span className="stat-icon">
              <IconUsers size={22} />
            </span>
            <span className="stat-value">{data.friendCount}</span>
            <span className="stat-label">{isEn ? 'Friends' : 'Друзів'}</span>
          </li>
        </ul>

        <DiceDivider />

        <h3 className="clan-section-title">{isEn ? 'Clan' : 'Клан'}</h3>
        {data.clan ? (
          <a className="user-profile-clan" href={`#clans/${data.clan.id}`}>
            {data.clan.emblem && (
              <img className="clan-card-emblem" src={resolveSiteImage(data.clan.emblem)} alt="" />
            )}
            <span className="clan-card-name">
              {data.clan.name} <span className="clan-tag">[{data.clan.tag}]</span>
            </span>
            <span className="clan-card-meta">
              {clanRole ? (isEn ? clanRole[1] : clanRole[0]) : data.clan.role}
              {data.clan.since
                ? ` · ${isEn ? 'since' : 'з'} ${formatDate(data.clan.since, lang)}`
                : ''}
            </span>
          </a>
        ) : (
          <p className="clan-empty">
            {isEn ? 'Not a member of any clan yet.' : 'Поки не належить до жодного клану.'}
          </p>
        )}
      </section>
    </>
  )
}
