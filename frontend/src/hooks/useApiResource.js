import { useCallback, useEffect, useReducer, useRef } from 'react'

const INITIAL_STATE = {
  status: 'idle',
  data: null,
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'loading':
      return { ...state, status: 'loading', error: null }
    case 'ready':
      return { status: 'ready', data: action.data, error: null }
    case 'error':
      return { ...state, status: 'error', error: action.error }
    case 'set-data':
      return {
        ...state,
        data: typeof action.value === 'function' ? action.value(state.data) : action.value,
      }
    case 'reset':
      return INITIAL_STATE
    default:
      return state
  }
}

export function useApiResource(load, { enabled = true } = {}) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const [revision, reload] = useReducer(value => value + 1, 0)
  const requestId = useRef(0)

  useEffect(() => {
    if (!enabled) {
      requestId.current += 1
      dispatch({ type: 'reset' })
      return
    }

    const currentRequest = ++requestId.current
    dispatch({ type: 'loading' })

    Promise.resolve()
      .then(load)
      .then(data => {
        if (requestId.current === currentRequest) dispatch({ type: 'ready', data })
      })
      .catch(error => {
        if (requestId.current === currentRequest) dispatch({ type: 'error', error })
      })

    return () => {
      if (requestId.current === currentRequest) requestId.current += 1
    }
  }, [enabled, load, revision])

  const setData = useCallback(value => {
    dispatch({ type: 'set-data', value })
  }, [])

  return {
    ...state,
    status: enabled && state.status === 'idle' ? 'loading' : state.status,
    reload,
    setData,
  }
}
