import { useCallback, useState } from 'react'
import D20, { DiceDivider } from '../components/Dice'
import campaignsHeroBg from '../assets/campaigns_hero_bg.jpg'
import campaignsNotesSketch from '../assets/campaigns_notes_sketch.jpg'
import campaignsNotesProgress from '../assets/campaigns_notes_progress.jpg'
import { IconPin, IconUsers, IconScroll, IconSwords, IconMap } from '../components/Icons'
import { siteImage } from '../data/images'
import * as api from '../utils/api'
import { useReveal } from '../hooks/useReveal'
import { useApiResource } from '../hooks/useApiResource'
import { useOverlayTransition } from '../hooks/useOverlayTransition'
import { apiErrorMessage } from '../utils/apiErrors'

function CampaignsPage({ t, lang }) {
  const [campaignSelection, setCampaignSelection] = useState(null)
  const campaignOverlay = useOverlayTransition(campaignSelection)
  const activeModalCampaign = campaignOverlay.value
  const isEn = lang === 'en'

  const load = useCallback(() => api.fetchCampaigns(lang), [lang])
  const resource = useApiResource(load)
  const campaigns = resource.data ?? []
  const list = useReveal(campaigns)

  return (
    <>
      <section
        className="campaigns-hero"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.65)), url(${campaignsHeroBg})`,
        }}
      >
        <div className="hero-content" style={{ position: 'relative', zIndex: 4 }}>
          <h1>{t.campaignsHeroTitle}</h1>
          <p className="hero-subtitle">{t.campaignsHeroSubtitle}</p>
        </div>
      </section>

      <section className="camp-feature-section">
        <div className="camp-feature-row">
          <div className="camp-feature-text">
            <h2>{t.campFeature1Title}</h2>
            <p>{t.campFeature1Desc}</p>
          </div>
          <div
            className="camp-feature-img"
            style={{ backgroundImage: `url(${campaignsNotesSketch})` }}
          ></div>
        </div>
        <div className="camp-feature-row">
          <div
            className="camp-feature-img"
            style={{ backgroundImage: `url(${campaignsNotesProgress})` }}
          ></div>
          <div className="camp-feature-text">
            <h2>{t.campFeature2Title}</h2>
            <p>{t.campFeature2Desc}</p>
          </div>
        </div>
      </section>

      <section className="camp-explore-section">
        <div className="camp-explore-overlay">
          <div className="camp-explore-inner">
            <div className="camp-explore-text">
              <h2>{t.campExploreTitle}</h2>
              <p>{t.campExploreDesc}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="camp-list-section" ref={list}>
        <h2 className="camp-list-title">{t.campaignsListTitle}</h2>
        <DiceDivider />
        {resource.status === 'loading' && !resource.data && (
          <p className="offline-banner">{isEn ? 'Loading campaigns…' : 'Завантаження кампаній…'}</p>
        )}
        {resource.status === 'error' && (
          <p className="offline-banner">
            {apiErrorMessage(
              resource.error,
              lang,
              isEn
                ? 'Could not load campaigns from the server.'
                : 'Не вдалося завантажити кампанії із сервера.',
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
        {resource.status === 'ready' && campaigns.length === 0 && (
          <p className="offline-banner">
            {isEn ? 'No campaigns have been published yet.' : 'Кампаній поки немає.'}
          </p>
        )}
        {campaigns.map(camp => (
          <div
            key={camp.id}
            className="camp-card is-clickable reveal"
            style={{ cursor: 'pointer' }}
            onClick={() => setCampaignSelection(camp)}
          >
            <div
              className="camp-card-img"
              style={{
                backgroundImage: `url(${siteImage(camp.imageKey)})`,
                backgroundPosition: camp.bgPos,
              }}
            ></div>
            <div className="camp-card-body">
              <div className="camp-card-meta">
                <span className="camp-tag">{camp.tag}</span>
              </div>
              <h3>{camp.title}</h3>
              <p>{camp.desc}</p>
              <button
                className="btn btn-action camp-btn"
                onClick={e => {
                  e.stopPropagation()
                  setCampaignSelection(camp)
                }}
              >
                {camp.btn}
              </button>
            </div>
          </div>
        ))}
      </section>

      {campaignOverlay.isMounted && (
        <div className={`modal-backdrop ${campaignOverlay.isEntered ? 'is-entered' : ''}`}>
          <div className="modal-content campaign-modal">
            <div
              className="camp-modal-header"
              style={{
                backgroundImage: `url(${siteImage(activeModalCampaign.imageKey)})`,
                backgroundPosition: activeModalCampaign.bgPos,
              }}
            >
              <div className="camp-modal-header-overlay">
                <span className="camp-tag">{activeModalCampaign.tag}</span>
                <h2>{activeModalCampaign.title}</h2>
              </div>
            </div>

            <div className="camp-modal-body">
              <div className="camp-modal-info-grid">
                <div className="info-box">
                  <span className="info-label">
                    <IconPin size={15} /> {isEn ? 'Location:' : 'Локація:'}
                  </span>
                  <span className="info-val">{activeModalCampaign.details.location}</span>
                </div>
                <div className="info-box">
                  <span className="info-label">
                    <IconUsers size={15} /> {isEn ? 'Party Size:' : 'Група:'}
                  </span>
                  <span className="info-val">{activeModalCampaign.details.partySize}</span>
                </div>
              </div>

              <h4>
                <IconScroll size={18} /> {isEn ? 'Full Adventure Lore' : 'Повний Опис Пригоди'}
              </h4>
              <p className="camp-modal-desc">{activeModalCampaign.desc}</p>

              <h4>
                <IconSwords size={18} /> {isEn ? 'Dungeon Master Notes' : 'Нотатки Майстра Грача'}
              </h4>
              <p className="camp-modal-notes">{activeModalCampaign.details.dmNotes}</p>

              <h4>
                <IconMap size={18} /> {isEn ? 'Key Campaign Highlights' : 'Основні Етапи Пригоди'}
              </h4>
              <ul className="camp-modal-highlights rules-list">
                {activeModalCampaign.details.highlights.map((item, idx) => (
                  <li key={idx}>
                    <D20 size={18} strokeWidth={4} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="camp-modal-footer modal-command-bar">
                <button
                  className="btn btn-outline modal-dismiss"
                  onClick={() => setCampaignSelection(null)}
                >
                  {isEn ? 'Close' : 'Закрити'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default CampaignsPage
