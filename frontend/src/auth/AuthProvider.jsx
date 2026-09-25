import { useCallback, useEffect, useMemo, useState } from 'react'
import defaultAvatar from '../assets/ranger_green.png'
import * as api from '../utils/api'
import { AuthContext } from './AuthContext'

const DEFAULT_PROFILE = {
  name: 'Adventurer',
  charClass: 'Wizard',
  race: 'Elf',
  level: 5,
  bio: '',
  avatar: defaultAvatar,
  cursor: '',
}

export default function AuthProvider({ children }) {
  const [status, setStatus] = useState('restoring')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(DEFAULT_PROFILE)

  const acceptUser = useCallback(nextUser => {
    setUser(nextUser)
    setProfile(previous => ({ ...previous, ...nextUser }))
    setStatus('authenticated')
  }, [])

  useEffect(() => {
    let cancelled = false
    const becomeAnonymous = () => {
      if (cancelled) return
      setUser(null)
      setProfile(DEFAULT_PROFILE)
      setStatus('anonymous')
    }
    const unsubscribe = api.onUnauthorized(becomeAnonymous)

    api
      .me()
      .then(nextUser => {
        if (!cancelled) acceptUser(nextUser)
      })
      .catch(becomeAnonymous)

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [acceptUser])

  const logout = useCallback(async () => {
    await api.logout().catch(() => {})
    setUser(null)
    setProfile(DEFAULT_PROFILE)
    setStatus('anonymous')
  }, [])

  const saveProfile = useCallback(
    async input => {
      const previous = profile
      setProfile(current => ({ ...current, ...input }))
      try {
        const saved = await api.saveProfile(input)
        setProfile(current => ({ ...current, ...saved }))
        setUser(current => (current ? { ...current, ...saved } : current))
        return saved
      } catch (error) {
        setProfile(previous)
        api
          .fetchProfile()
          .then(server => setProfile(current => ({ ...current, ...server })))
          .catch(() => {})
        throw error
      }
    },
    [profile],
  )

  const value = useMemo(
    () => ({
      status,
      user,
      profile,
      acceptUser,
      logout,
      saveProfile,
    }),
    [acceptUser, logout, profile, saveProfile, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
