import { useState, useRef, useCallback } from 'react'
import { siteImage, siteImageValue } from '../data/images'
import { DND_CLASSES, DND_RACES, localizeClass, localizeRace } from '../data/dndTraits'
import * as api from '../utils/api'
import D20, { DiceDivider } from '../components/Dice'

import charactersHeroBg from '../assets/soldiers_snow.png'
import { IconScroll, IconChart } from '../components/Icons'
import { useApiResource } from '../hooks/useApiResource'
import { useOverlayTransition } from '../hooks/useOverlayTransition'

const formatMod = val => {
  const mod = Math.floor((val - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function CharactersPage({ t, profile, onSaveProfile, lang, authUser, onRequestAuth }) {
  const isEn = lang === 'en'
  const [presetSelection, setPresetSelection] = useState(null)
  const presetOverlay = useOverlayTransition(presetSelection)
  const selectedPreset = presetOverlay.value
  const [customForm, setCustomForm] = useState({
    name: '',
    charClass: 'Wizard',
    race: 'Elf',
    level: 1,
    bio: '',
  })
  const [activeTab, setActiveTab] = useState('presets')
  const loadPresets = useCallback(() => api.fetchPresets(lang), [lang])
  const presetResource = useApiResource(loadPresets)
  const presets = presetResource.data || []
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const trackRef = useRef(null)

  const scrollTrack = dir => {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector('.preset-card')
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0
    const step = card ? card.offsetWidth + gap : track.offsetWidth * 0.8
    track.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  const showSaved = () => {
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  const handleApplyPreset = async preset => {
    if (!authUser) {
      onRequestAuth?.()
      return
    }
    if (onSaveProfile && !isSaving) {
      setIsSaving(true)
      const saved = await onSaveProfile({
        name: preset.name,
        charClass: preset.classKey ?? preset.charClass,
        race: preset.raceKey ?? preset.race,

        bio: preset.desc,
        avatar: siteImageValue(preset.avatarKey),
      })
      setIsSaving(false)
      if (saved) showSaved()
      return saved
    }
    return false
  }

  const handleCreateCustom = async e => {
    e.preventDefault()
    if (!authUser) {
      onRequestAuth?.()
      return
    }
    if (!customForm.name.trim()) return
    if (onSaveProfile && !isSaving) {
      setIsSaving(true)
      const saved = await onSaveProfile({
        ...profile,
        name: customForm.name,
        charClass: customForm.charClass,
        race: customForm.race,
        level: Number(customForm.level) || 1,
        bio: customForm.bio,
      })
      setIsSaving(false)
      if (saved) showSaved()
    }
  }

  return (
    <div className="characters-page">
      <section
        className="characters-hero"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${charactersHeroBg})`,
        }}
      >
        <div className="hero-content">
          <h1>
            {t.charPageTitle ||
              (isEn ? 'CHARACTER CREATION & PRESETS' : 'СТВОРЕННЯ ПЕРСОНАЖА ТА ПРЕСЕТИ')}
          </h1>
          <p className="hero-subtitle">
            {t.charPageSubtitle ||
              (isEn
                ? 'Choose a ready-to-play website preset or construct your own unique adventurer.'
                : 'Оберіть готовий пресет від сайту або складіть власного унікального героїчного персонажа.')}
          </p>
        </div>
      </section>

      {savedSuccess && (
        <div className="char-alert-toast">
          {isEn ? 'Character profile updated!' : 'Профіль персонажа успішно оновлено!'}
        </div>
      )}

      <section className="char-content-wrapper">
        <div className="char-nav-tabs">
          <button
            className={`btn btn-toggle btn-lg ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            {isEn ? 'Website Presets' : 'Пресети від сайту'}
          </button>
          <button
            className={`btn btn-toggle btn-lg ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            {isEn ? 'Create Custom Slot' : 'Слот створення персонажа'}
          </button>
        </div>

        {activeTab === 'presets' && (
          <div className="presets-container">
            <h2 className="section-title">
              {isEn ? 'Official D&D Character Presets' : 'Офіційні Пресети D&D Персонажів'}
            </h2>
            <p className="section-desc">
              {isEn
                ? 'Select any preset character to inspect stats or apply them directly as your active forum character.'
                : 'Клацніть на будь-який пресет персонажа, щоб переглянути характеристики або обрати його для свого акаунту.'}
            </p>
            <DiceDivider />

            {presetResource.status === 'loading' && (
              <p className="offline-banner">
                {isEn ? 'Loading presets…' : 'Завантаження пресетів…'}
              </p>
            )}
            {presetResource.status === 'error' && (
              <p className="offline-banner">
                {isEn
                  ? 'Could not load presets from the server.'
                  : 'Не вдалося завантажити пресети із сервера.'}
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    api.resetServerState()
                    presetResource.reload()
                  }}
                >
                  {isEn ? 'Retry' : 'Повторити'}
                </button>
              </p>
            )}
            {presetResource.status === 'ready' && presets.length === 0 && (
              <p className="offline-banner">
                {isEn ? 'No presets have been published yet.' : 'Пресетів поки немає.'}
              </p>
            )}

            <div className="presets-carousel">
              <button
                className="btn btn-icon carousel-arrow carousel-arrow-prev"
                onClick={() => scrollTrack(-1)}
                aria-label={isEn ? 'Previous characters' : 'Попередні персонажі'}
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 5 8 12l7 7" />
                </svg>
              </button>

              <div className="presets-track" ref={trackRef}>
                {presets.map(preset => {
                  const { name, desc } = preset
                  const charClass = localizeClass(preset.classKey ?? preset.charClass, lang)
                  const race = localizeRace(preset.raceKey ?? preset.race, lang)

                  const [topStat, topVal] = Object.entries(preset.stats).sort(
                    (a, b) => b[1] - a[1],
                  )[0]

                  return (
                    <div key={preset.id} className="preset-card">
                      <div
                        className="preset-card-avatar"
                        style={{ backgroundImage: `url(${siteImage(preset.avatarKey)})` }}
                      ></div>

                      <div className="preset-card-content">
                        <h3 className="preset-card-name">{name}</h3>
                        <div className="preset-badges">
                          <span className="badge badge-class">{charClass}</span>
                          <span className="badge badge-race">{race}</span>
                        </div>
                        <p className="preset-desc">{desc}</p>

                        <div className="preset-key-stat">
                          <span className="key-stat-label">{isEn ? 'Primary' : 'Провідна'}</span>
                          <span className="key-stat-name">{topStat}</span>
                          <span className="key-stat-val">{topVal}</span>
                          <span className="key-stat-mod">{formatMod(topVal)}</span>
                        </div>

                        <div className="preset-card-actions">
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setPresetSelection(preset)}
                          >
                            {isEn ? 'Inspect Details' : 'Переглянути'}
                          </button>
                          <button
                            className="btn btn-action btn-sm"
                            onClick={() => handleApplyPreset(preset)}
                            disabled={isSaving}
                          >
                            {isEn ? 'Select Character' : 'Обрати персонажа'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                className="btn btn-icon carousel-arrow carousel-arrow-next"
                onClick={() => scrollTrack(1)}
                aria-label={isEn ? 'Next characters' : 'Наступні персонажі'}
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="custom-slot-container">
            <h2 className="section-title">
              {isEn ? 'Character Creation Slot' : 'Слот Створення Персонажа'}
            </h2>
            <p className="section-desc">
              {isEn
                ? 'Fill in the parameters below to draft a new adventurer for your campaign sessions.'
                : 'Заповніть параметри нижче, щоб створити власного пригодника для ігрових сесій.'}
            </p>

            <form className="custom-char-form" onSubmit={handleCreateCustom}>
              <div className="form-group-row">
                <div className="form-group">
                  <label>{isEn ? 'Character Name' : 'Ім’я Персонажа'}</label>
                  <input
                    type="text"
                    required
                    placeholder={isEn ? 'e.g. Valerius Dusk' : 'наприклад: Валеріус'}
                    value={customForm.name}
                    onChange={e => setCustomForm({ ...customForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>{isEn ? 'Level (1-20)' : 'Рівень (1-20)'}</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={customForm.level}
                    onChange={e => setCustomForm({ ...customForm, level: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>{isEn ? 'Class' : 'Клас'}</label>
                  <select
                    value={customForm.charClass}
                    onChange={e => setCustomForm({ ...customForm, charClass: e.target.value })}
                  >
                    {DND_CLASSES.map(item => (
                      <option key={item.en} value={item.en}>
                        {lang === 'ua' ? item.ua : item.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{isEn ? 'Race' : 'Раса'}</label>
                  <select
                    value={customForm.race}
                    onChange={e => setCustomForm({ ...customForm, race: e.target.value })}
                  >
                    {DND_RACES.map(item => (
                      <option key={item.en} value={item.en}>
                        {lang === 'ua' ? item.ua : item.en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>{isEn ? 'Backstory / Biography' : 'Передісторія / Біографія'}</label>
                <textarea
                  rows="4"
                  placeholder={
                    isEn
                      ? "Describe your character's backstory..."
                      : 'Опишіть передісторію вашого персонажа...'
                  }
                  value={customForm.bio}
                  onChange={e => setCustomForm({ ...customForm, bio: e.target.value })}
                ></textarea>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-action" disabled={isSaving}>
                  {isEn ? 'Save Character Slot' : 'Зберегти в слот персонажа'}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {presetOverlay.isMounted && (
        <div className={`modal-backdrop ${presetOverlay.isEntered ? 'is-entered' : ''}`}>
          <div className="modal-content preset-modal">
            <div
              className="preset-detail-header"
              style={{ backgroundImage: `url(${siteImage(selectedPreset.avatarKey)})` }}
            >
              <div className="preset-detail-header-overlay">
                <h2>{selectedPreset.name}</h2>
                <div className="preset-badges">
                  <span className="badge badge-class">
                    {localizeClass(selectedPreset.classKey ?? selectedPreset.charClass, lang)}
                  </span>
                  <span className="badge badge-race">
                    {localizeRace(selectedPreset.raceKey ?? selectedPreset.race, lang)}
                  </span>
                </div>
              </div>
            </div>

            <div className="preset-detail-body">
              <h4>
                <IconScroll size={18} /> {isEn ? 'Description' : 'Опис та передісторія'}
              </h4>
              <p>{selectedPreset.desc}</p>

              <h4>
                <IconChart size={18} /> {isEn ? 'Primary Attributes' : 'Основні Характеристики'}
              </h4>
              <div className="stats-detail-grid">
                {Object.entries(selectedPreset.stats).map(([s, val]) => (
                  <div key={s} className="stat-detail-box">
                    <span className="stat-detail-name">{s}</span>
                    <span className="stat-detail-score">{val}</span>
                  </div>
                ))}
              </div>

              <h4>{isEn ? 'Key Abilities / Spells' : 'Ключові Здібності / Заклинання'}</h4>
              <ul className="preset-spells-list">
                {selectedPreset.spells.map((spell, i) => (
                  <li key={i}>
                    <D20 size={14} strokeWidth={4} /> <span>{spell}</span>
                  </li>
                ))}
              </ul>

              <div className="preset-detail-footer modal-command-bar">
                <button
                  className="btn btn-action modal-primary"
                  disabled={isSaving}
                  onClick={async () => {
                    const saved = await handleApplyPreset(selectedPreset)
                    if (saved) setPresetSelection(null)
                  }}
                >
                  {isEn ? 'Use This Preset' : 'Застосувати цей пресет'}
                </button>
                <button
                  className="btn btn-outline modal-dismiss"
                  onClick={() => setPresetSelection(null)}
                >
                  {isEn ? 'Close' : 'Закрити'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CharactersPage
