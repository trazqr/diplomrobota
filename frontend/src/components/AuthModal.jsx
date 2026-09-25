import { useState, useEffect } from 'react'
import * as api from '../utils/api'
import { apiErrorMessage } from '../utils/apiErrors'
import { IconWarning, IconGoogle } from './Icons'

const LOGIN_RE = /^[\p{L}\p{N}._-]{3,32}$/u

function fieldError(field, form, mode, isEn) {
  const v = (form[field] ?? '').trim()

  if (field === 'login') {
    if (!v) return isEn ? 'Enter a login.' : 'Введіть логін.'
    if (mode === 'login') return ''
    if (v.length < 3) return isEn ? 'At least 3 characters.' : 'Щонайменше 3 символи.'
    if (v.length > 32) return isEn ? 'No more than 32 characters.' : 'Не більше 32 символів.'
    if (!LOGIN_RE.test(v)) {
      return isEn
        ? 'Only letters, digits, dot, dash and underscore.'
        : 'Лише літери, цифри, крапка, дефіс і підкреслення.'
    }
    return ''
  }

  if (field === 'password') {
    const p = form.password ?? ''
    if (!p) return isEn ? 'Enter a password.' : 'Введіть пароль.'
    if (mode === 'login') return ''
    if (p.length < 8) return isEn ? 'At least 8 characters.' : 'Щонайменше 8 символів.'
    if (p.length > 128) return isEn ? 'No more than 128 characters.' : 'Не більше 128 символів.'
    return ''
  }

  if (field === 'confirm' && mode === 'register') {
    if (!form.confirm) return isEn ? 'Repeat the password.' : 'Повторіть пароль.'
    if (form.confirm !== form.password) {
      return isEn ? 'Passwords do not match.' : 'Паролі не збігаються.'
    }
  }

  if (field === 'name' && mode === 'register' && (form.name ?? '').trim().length > 40) {
    return isEn ? 'No more than 40 characters.' : 'Не більше 40 символів.'
  }

  return ''
}

export default function AuthModal({ lang, onClose, onSuccess, isEntered, initialError }) {
  const isEn = lang === 'en'

  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ login: '', password: '', confirm: '', name: '' })
  const [error, setError] = useState(
    initialError ? apiErrorMessage({ code: initialError }, lang) : '',
  )
  const [busy, setBusy] = useState(false)

  const [touched, setTouched] = useState({})

  const [serverUp, setServerUp] = useState(true)
  const [providers, setProviders] = useState({ google: false })

  useEffect(() => {
    let cancelled = false
    api
      .fetchAuthProviders()
      .then(list => {
        if (!cancelled) setProviders(list)
      })
      .catch(() => {
        if (!cancelled) setProviders({ google: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.checkServer().then(ok => {
      if (!cancelled) setServerUp(ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const blur = field => setTouched(prev => ({ ...prev, [field]: true }))

  const FIELDS =
    mode === 'register' ? ['login', 'name', 'password', 'confirm'] : ['login', 'password']

  const errorFor = field => (touched[field] ? fieldError(field, form, mode, isEn) : '')

  const formInvalid = FIELDS.some(f => fieldError(f, form, mode, isEn))

  const submit = async e => {
    e.preventDefault()
    setError('')

    if (formInvalid) {
      setTouched(Object.fromEntries(FIELDS.map(f => [f, true])))
      return
    }

    setBusy(true)
    try {
      const profile =
        mode === 'login'
          ? await api.login(form.login.trim(), form.password)
          : await api.register({
              login: form.login.trim(),
              password: form.password,
              name: form.name.trim() || form.login.trim(),
            })
      onSuccess(profile)
      onClose()
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          lang,
          isEn
            ? 'Request failed. Please try again.'
            : 'Не вдалося виконати запит. Спробуйте ще раз.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`modal-backdrop ${isEntered ? 'is-entered' : ''}`}>
      <div className="modal-content auth-modal">
        <div className="auth-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'login'}
            className={`btn-tabline${mode === 'login' ? ' active' : ''}`}
            onClick={() => {
              setMode('login')
              setError('')
              setTouched({})
            }}
          >
            {isEn ? 'Sign in' : 'Вхід'}
          </button>
          <button
            role="tab"
            aria-selected={mode === 'register'}
            className={`btn-tabline${mode === 'register' ? ' active' : ''}`}
            onClick={() => {
              setMode('register')
              setError('')
              setTouched({})
            }}
          >
            {isEn ? 'Register' : 'Реєстрація'}
          </button>
        </div>

        {!serverUp && (
          <p className="offline-banner auth-offline">
            <IconWarning size={18} />
            <span>
              {isEn
                ? 'The server is not running, so accounts cannot be created. Start the backend: '
                : 'Сервер не запущено, тому створити акаунт неможливо. Запустіть бекенд: '}
              <code>cd backend &amp;&amp; dotnet run</code>
            </span>
          </p>
        )}

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-label">
            {isEn ? 'Login' : 'Логін'}
            <input
              className={`auth-input${errorFor('login') ? ' invalid' : ''}`}
              value={form.login}
              onChange={e => set('login', e.target.value)}
              onBlur={() => blur('login')}
              autoComplete="username"
              maxLength={32}
              aria-invalid={Boolean(errorFor('login'))}
            />
            {mode === 'register' && !errorFor('login') && (
              <span className="auth-hint">
                {isEn
                  ? '3–32 characters: letters, digits, dot, dash, underscore'
                  : '3–32 символи: літери, цифри, крапка, дефіс, підкреслення'}
              </span>
            )}
            {errorFor('login') && <span className="auth-field-error">{errorFor('login')}</span>}
          </label>

          {mode === 'register' && (
            <label className="auth-label">
              {isEn ? 'Display name' : 'Ім’я на форумі'}
              <input
                className={`auth-input${errorFor('name') ? ' invalid' : ''}`}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                onBlur={() => blur('name')}
                placeholder={isEn ? 'Optional' : 'Необов’язково'}
                maxLength={40}
              />
              {errorFor('name') && <span className="auth-field-error">{errorFor('name')}</span>}
            </label>
          )}

          <label className="auth-label">
            {isEn ? 'Password' : 'Пароль'}
            <input
              className={`auth-input${errorFor('password') ? ' invalid' : ''}`}
              type="password"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              onBlur={() => blur('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              maxLength={128}
              aria-invalid={Boolean(errorFor('password'))}
            />
            {mode === 'register' && !errorFor('password') && (
              <span className="auth-hint">
                {isEn ? 'At least 8 characters' : 'Щонайменше 8 символів'}
              </span>
            )}
            {errorFor('password') && (
              <span className="auth-field-error">{errorFor('password')}</span>
            )}
          </label>

          {mode === 'register' && (
            <label className="auth-label">
              {isEn ? 'Repeat password' : 'Повторіть пароль'}
              <input
                className={`auth-input${errorFor('confirm') ? ' invalid' : ''}`}
                type="password"
                value={form.confirm}
                onChange={e => set('confirm', e.target.value)}
                onBlur={() => blur('confirm')}
                autoComplete="new-password"
                maxLength={128}
                aria-invalid={Boolean(errorFor('confirm'))}
              />
              {errorFor('confirm') && (
                <span className="auth-field-error">{errorFor('confirm')}</span>
              )}
            </label>
          )}

          {error && (
            <p className="auth-error" role="alert">
              <IconWarning size={16} /> {error}
            </p>
          )}

          <div className="auth-actions modal-command-bar">
            <button
              className="btn btn-action auth-submit modal-primary"
              type="submit"
              disabled={busy}
            >
              {busy
                ? isEn
                  ? 'Please wait…'
                  : 'Зачекайте…'
                : mode === 'login'
                  ? isEn
                    ? 'Sign in'
                    : 'Увійти'
                  : isEn
                    ? 'Create account'
                    : 'Створити акаунт'}
            </button>
            <button
              className="btn btn-outline auth-cancel modal-dismiss"
              type="button"
              onClick={onClose}
            >
              {isEn ? 'Close' : 'Закрити'}
            </button>
          </div>

          {providers.google && (
            <>
              <div className="auth-divider">
                <span>{isEn ? 'or' : 'або'}</span>
              </div>
              <button
                type="button"
                className="btn btn-outline auth-google"
                onClick={() => {
                  window.location.href = api.externalLoginUrl('google')
                }}
              >
                <IconGoogle size={18} />
                {isEn ? 'Continue with Google' : 'Увійти через Google'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
