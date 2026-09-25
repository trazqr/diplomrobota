import { useState, useRef } from 'react'
import { IconUpload, IconWarning } from '../components/Icons'
import { CURSORS } from '../data/cursors'
import { resolveSiteImage, siteImage, siteImageValue } from '../data/images'
import { DND_CLASSES, DND_RACES } from '../data/dndTraits'
import { isSupportedImageFile, resizeImage } from '../utils/image'

const PRESET_AVATARS = [
  'ranger_green',
  'white_hair_warrior',
  'skeleton_warrior',
  'wizard_spells',
  'goblin_tavern',
  'blue_dragon',
]
function EditProfileModal({ profile, onSave, onClose, lang, t, authUser, isEntered }) {
  const isEn = lang === 'en'
  const [form, setForm] = useState({ ...profile })
  const [uploadError, setUploadError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef(null)

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const AVATAR_MAX_SIDE = 320

  const processFile = async file => {
    setUploadError('')

    if (!isSupportedImageFile(file)) {
      setUploadError(
        lang === 'ua'
          ? 'Оберіть файл зображення (PNG, JPG, GIF...)'
          : 'Please select an image file (PNG, JPG, GIF...)',
      )
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError(
        lang === 'ua' ? 'Файл занадто великий. Максимум 2 МБ.' : 'File is too large. Maximum 2 MB.',
      )
      return
    }

    try {
      handleChange(
        'avatar',
        await resizeImage(file, {
          maxSide: AVATAR_MAX_SIDE,
          maxLength: 280_000,
        }),
      )
    } catch {
      setUploadError(
        lang === 'ua'
          ? 'Не вдалося прочитати зображення. Спробуйте інший файл.'
          : 'Could not read the image. Try another file.',
      )
    }
  }

  const handleFileInput = e => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  const handleDragOver = e => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = e => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    const saved = await onSave(form)
    setIsSaving(false)
    if (saved) onClose()
  }

  return (
    <div className={`modal-overlay ${isEntered ? 'is-entered' : ''}`}>
      <div className="modal-box">
        <h2 className="modal-title">{t.editProfile}</h2>

        <div className="modal-section">
          <label className="modal-label">{t.chooseAvatar}</label>

          <div className="avatar-current-preview">
            <img
              src={resolveSiteImage(form.avatar, 'ranger_green')}
              alt="Current avatar"
              className="avatar-current-img"
            />
            <span className="avatar-current-hint">
              {lang === 'ua' ? 'Поточний аватар' : 'Current avatar'}
            </span>
          </div>

          <div
            className={`avatar-upload-zone ${isDragging ? 'dragging' : ''}`}
            onClick={() => fileInputRef.current.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span className="avatar-upload-icon">
              <IconUpload size={30} />
            </span>
            <span className="avatar-upload-text">
              {lang === 'ua' ? 'Завантажити своє фото' : 'Upload your own photo'}
            </span>
            <span className="avatar-upload-hint">
              {lang === 'ua'
                ? 'Клікніть або перетягніть файл · PNG, JPG · до 2 МБ'
                : 'Click or drag & drop · PNG, JPG · up to 2 MB'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
          </div>

          {uploadError && (
            <p className="avatar-upload-error">
              <IconWarning size={16} /> {uploadError}
            </p>
          )}

          <p className="avatar-presets-label">
            {lang === 'ua' ? 'або оберіть готовий аватар:' : 'or choose a preset:'}
          </p>
          <div className="avatar-presets">
            {PRESET_AVATARS.map(key => {
              const value = siteImageValue(key)
              return (
                <img
                  key={key}
                  src={siteImage(key)}
                  alt={'Avatar: ' + key}
                  className={'avatar-preset-img' + (form.avatar === value ? ' selected' : '')}
                  onClick={() => {
                    setUploadError('')
                    handleChange('avatar', value)
                  }}
                />
              )
            })}
          </div>
        </div>

        <div className="modal-section">
          <label className="modal-label">{t.username}</label>
          <input
            className="modal-input"
            value={form.name}
            maxLength={40}
            onChange={e => handleChange('name', e.target.value)}
          />
        </div>

        {authUser && (
          <div className="modal-section">
            <label className="modal-label">{isEn ? 'Login' : 'Логін'}</label>
            <input
              className="modal-input"
              value={form.login || ''}
              maxLength={32}
              onChange={e => handleChange('login', e.target.value)}
            />
            <span className="modal-hint">
              {isEn
                ? '3–32 characters: letters, digits, dot, dash, underscore. Must be unique.'
                : '3–32 символи: літери, цифри, крапка, дефіс, підкреслення. Має бути унікальним.'}
            </span>
          </div>
        )}

        <div className="modal-section">
          <label className="modal-label">{isEn ? 'Mouse cursor' : 'Курсор миші'}</label>
          <div className="cursor-picker">
            <button
              type="button"
              className={`cursor-option${!form.cursor ? ' selected' : ''}`}
              onClick={() => handleChange('cursor', '')}
              title={isEn ? 'Default' : 'Звичайний'}
            >
              <span className="cursor-option-preview cursor-default-mark">✦</span>
              <span className="cursor-option-label">{isEn ? 'Default' : 'Звичайний'}</span>
            </button>

            {Object.entries(CURSORS).map(([key, c]) => (
              <button
                key={key}
                type="button"
                className={`cursor-option${form.cursor === key ? ' selected' : ''}`}
                onClick={() => handleChange('cursor', key)}
                title={isEn ? c.labelEn : c.labelUa}
              >
                <img className="cursor-option-preview" src={c.src} alt="" />
                <span className="cursor-option-label">{isEn ? c.labelEn : c.labelUa}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="modal-section">
          <label className="modal-label">
            {isEn ? 'Wandering characters' : 'Мандрівні персонажі'}
          </label>
          <div className="setting-toggle">
            <button
              type="button"
              className={`btn btn-toggle${form.showWanderers !== false ? ' active' : ''}`}
              onClick={() => handleChange('showWanderers', true)}
            >
              {isEn ? 'On' : 'Увімкнено'}
            </button>
            <button
              type="button"
              className={`btn btn-toggle${form.showWanderers === false ? ' active' : ''}`}
              onClick={() => handleChange('showWanderers', false)}
            >
              {isEn ? 'Off' : 'Вимкнено'}
            </button>
          </div>
        </div>

        <div className="modal-section">
          <label className="modal-label">{isEn ? 'Flying dragon' : 'Летючий дракон'}</label>
          <div className="setting-toggle">
            <button
              type="button"
              className={`btn btn-toggle${form.showDragon !== false ? ' active' : ''}`}
              onClick={() => handleChange('showDragon', true)}
            >
              {isEn ? 'On' : 'Увімкнено'}
            </button>
            <button
              type="button"
              className={`btn btn-toggle${form.showDragon === false ? ' active' : ''}`}
              onClick={() => handleChange('showDragon', false)}
            >
              {isEn ? 'Off' : 'Вимкнено'}
            </button>
          </div>
        </div>

        <div className="modal-section">
          <label className="modal-label">{t.characterClass}</label>
          <select
            className="modal-input modal-select"
            value={form.charClass}
            onChange={e => handleChange('charClass', e.target.value)}
          >
            {DND_CLASSES.map(item => (
              <option key={item.en} value={item.en}>
                {lang === 'ua' ? item.ua : item.en}
              </option>
            ))}
          </select>
        </div>

        <div className="modal-section">
          <label className="modal-label">{t.race}</label>
          <select
            className="modal-input modal-select"
            value={form.race}
            onChange={e => handleChange('race', e.target.value)}
          >
            {DND_RACES.map(item => (
              <option key={item.en} value={item.en}>
                {lang === 'ua' ? item.ua : item.en}
              </option>
            ))}
          </select>
        </div>

        <div className="modal-section">
          <label className="modal-label">{t.level}</label>
          <input
            className="modal-input"
            type="number"
            min={1}
            max={20}
            value={form.level}
            onChange={e => handleChange('level', parseInt(e.target.value) || 1)}
          />
        </div>

        <div className="modal-section">
          <label className="modal-label">{t.bio}</label>
          <textarea
            className="modal-textarea"
            rows={4}
            maxLength={500}
            placeholder={t.bioPlaceholder}
            value={form.bio}
            onChange={e => handleChange('bio', e.target.value)}
          />
          <span className="modal-char-count">{form.bio.length}/500</span>
        </div>

        <div className="modal-actions modal-command-bar">
          <button className="btn btn-action modal-primary" onClick={handleSave} disabled={isSaving}>
            {t.save}
          </button>
          <button className="btn btn-outline modal-dismiss" onClick={onClose}>
            {isEn ? 'Close' : 'Закрити'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditProfileModal
