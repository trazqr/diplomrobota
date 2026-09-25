import { useState, useCallback } from 'react'
import EditProfileModal from '../components/EditProfileModal'
import { useOverlayTransition } from '../hooks/useOverlayTransition'
import { formatDate } from '../utils/date'

import profileBgImg from '../assets/dungeon_hall.png'
import {
  IconSwords,
  IconUser,
  IconPencil,
  IconScroll,
  IconChart,
  IconClock,
  IconShield,
  IconBook,
  IconStar,
  IconComment,
  IconWarning,
} from '../components/Icons'
import * as api from '../utils/api'
import { resolveSiteImage } from '../data/images'
import { localizeClass, localizeRace } from '../data/dndTraits'
import FriendsPanel from '../components/FriendsPanel'
import IgnoredPanel from '../components/IgnoredPanel'
import { useApiResource } from '../hooks/useApiResource'

const PROFILE_BG = profileBgImg

function ProfilePage({
  profile,
  onSaveProfile,
  saveError,
  t,
  authUser,
  onRequestAuth,
  lang,
  onOpenArticle,
  onOpenNews,
}) {
  const isEn = lang === 'en'

  const [showModal, setShowModal] = useState(false)
  const profileOverlay = useOverlayTransition(showModal)

  const loadActivity = useCallback(() => api.fetchActivity(), [])
  const loadStats = useCallback(() => api.fetchProfileStats(), [])
  const activityResource = useApiResource(loadActivity, { enabled: Boolean(authUser) })
  const statsResource = useApiResource(loadStats, { enabled: Boolean(authUser) })
  const activity = activityResource.data || []
  const stats = statsResource.data

  if (!authUser) {
    return (
      <section
        className="auth-required"
        style={{
          backgroundImage: `linear-gradient(rgba(20,19,20,0.72), rgba(20,19,20,0.88)), url(${PROFILE_BG})`,
        }}
      >
        <div className="auth-required-inner">
          <h2>{isEn ? 'Sign in required' : 'Потрібен вхід'}</h2>
          <p>
            {isEn
              ? 'Your profile, articles and likes are tied to an account. Sign in or create one to continue.'
              : 'Профіль, статті та вподобання прив’язані до акаунту. Увійдіть або створіть його, щоб продовжити.'}
          </p>
          <button className="btn btn-action" onClick={onRequestAuth}>
            {isEn ? 'Sign in' : 'Увійти'}
          </button>
        </div>
      </section>
    )
  }

  const levelLabel = t.levelLabel
    ? t.levelLabel.replace('{n}', profile.level)
    : `Level ${profile.level}`

  const xpPercent = Math.min(100, ((profile.level - 1) / 19) * 100)

  return (
    <>
      {profileOverlay.isMounted && (
        <EditProfileModal
          isEntered={profileOverlay.isEntered}
          profile={profile}
          onSave={onSaveProfile}
          onClose={() => setShowModal(false)}
          lang={lang}
          t={t}
          authUser={authUser}
        />
      )}

      <section className="profile-hero" style={{ backgroundImage: `url(${PROFILE_BG})` }}>
        <div className="profile-hero-overlay">
          <div className="profile-hero-content">
            <div className="profile-avatar-wrapper">
              <img
                src={resolveSiteImage(profile.avatar, 'ranger_green')}
                alt={
                  isEn
                    ? profile.name
                      ? `Avatar: ${profile.name}`
                      : 'User avatar'
                    : profile.name
                      ? `Аватар: ${profile.name}`
                      : 'Аватар користувача'
                }
                className="profile-avatar"
              />
              <div className="profile-avatar-ring"></div>
            </div>

            <div className="profile-identity">
              <h1 className="profile-name">{profile.name}</h1>
              <p className="user-profile-login">@{profile.login}</p>
              <div className="profile-badges">
                <span className="profile-badge badge-class">
                  <IconSwords size={16} /> {localizeClass(profile.charClass, lang)}
                </span>
                <span className="profile-badge badge-race">
                  <IconUser size={16} /> {localizeRace(profile.race, lang)}
                </span>
              </div>

              <div className="profile-level-bar-wrap">
                <span className="profile-level-label">{levelLabel}</span>
                <div className="profile-level-bar">
                  <div className="profile-level-fill" style={{ width: `${xpPercent}%` }}></div>
                </div>
              </div>
            </div>

            <button className="btn btn-action profile-edit-btn" onClick={() => setShowModal(true)}>
              <IconPencil size={16} /> {t.editProfile}
            </button>
          </div>
        </div>
      </section>

      <section className="profile-body">
        {saveError && (
          <p className="auth-error profile-save-error" role="alert">
            <IconWarning size={16} /> {saveError}
          </p>
        )}

        <div className="profile-body-inner">
          <div className="profile-card profile-bio-card">
            <h2 className="profile-card-title">
              <IconScroll size={20} /> {t.bioTitle}
            </h2>
            {profile.bio ? (
              <p className="profile-bio-text">{profile.bio}</p>
            ) : (
              <p className="profile-bio-empty">{t.bioEmpty}</p>
            )}
          </div>

          <div className="profile-card profile-stats-card">
            <h2 className="profile-card-title">
              <IconChart size={20} /> {t.statsTitle}
            </h2>
            <div className="profile-stats-grid">
              <div className="profile-stat">
                <span className="stat-icon">
                  <IconShield size={22} />
                </span>
                <span className="stat-value">{profile.level}</span>
                <span className="stat-label">{t.statLevel}</span>
              </div>
              <div className="profile-stat">
                <span className="stat-icon">
                  <IconBook size={22} />
                </span>
                <span className="stat-value">{stats?.articles ?? '—'}</span>
                <span className="stat-label">{t.statArticles}</span>
              </div>
              <div className="profile-stat">
                <span className="stat-icon">
                  <IconComment size={22} />
                </span>
                <span className="stat-value">{stats?.comments ?? '—'}</span>
                <span className="stat-label">{t.statComments}</span>
              </div>
              <div className="profile-stat">
                <span className="stat-icon">
                  <IconStar size={22} />
                </span>
                <span className="stat-value">{stats?.likes ?? '—'}</span>
                <span className="stat-label">{t.statLikes}</span>
              </div>
            </div>
          </div>

          <FriendsPanel lang={lang} authUser={authUser} />

          <IgnoredPanel lang={lang} authUser={authUser} />
        </div>

        <div className="profile-recent">
          <h2 className="profile-card-title">
            <IconClock size={20} /> {t.recentTitle}
          </h2>
          {activity.length === 0 ? (
            <p className="profile-recent-empty">
              {isEn
                ? 'Nothing here yet. Write an article or join a discussion — it will show up here.'
                : 'Поки що порожньо. Напишіть статтю або долучіться до обговорення — усе з’явиться тут.'}
            </p>
          ) : (
            <div className="profile-recent-grid">
              {activity.map((item, i) => (
                <div
                  key={i}
                  className="profile-recent-card is-clickable"
                  onClick={() =>
                    item.targetType === 'article'
                      ? onOpenArticle?.(item.targetId)
                      : onOpenNews?.(item.targetId)
                  }
                >
                  {item.cover ? (
                    <div
                      className="profile-recent-img"
                      style={{ backgroundImage: `url(${item.cover})` }}
                    ></div>
                  ) : (
                    <div className="profile-recent-icon">
                      {item.kind === 'article' ? (
                        <IconScroll size={28} />
                      ) : (
                        <IconComment size={28} />
                      )}
                    </div>
                  )}
                  <div className="profile-recent-body">
                    <span className="profile-recent-type">
                      {item.kind === 'article'
                        ? isEn
                          ? 'Article'
                          : 'Стаття'
                        : isEn
                          ? 'Comment'
                          : 'Коментар'}
                      <span className="profile-recent-date">{formatDate(item.date, lang)}</span>
                    </span>
                    <p className="profile-recent-title">{item.title}</p>
                    {item.excerpt && <p className="profile-recent-excerpt">{item.excerpt}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default ProfilePage
