import { useEffect, useRef, useState } from 'react'

function pageWindow(current, last) {
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1)

  const pages = new Set([1, last, current, current - 1, current + 1])
  if (current <= 3) [2, 3, 4].forEach(value => pages.add(value))
  if (current >= last - 2) [last - 3, last - 2, last - 1].forEach(value => pages.add(value))

  const sorted = [...pages].filter(value => value >= 1 && value <= last).sort((a, b) => a - b)
  const withGaps = []
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) withGaps.push('gap')
    withGaps.push(value)
  })
  return withGaps
}

export default function PagedList({
  initial,
  total,
  initialHasMore,
  pageSize,
  isEn,
  searchable = false,
  searchPlaceholder,
  searchLabel,
  emptyText,
  localFields = person => [person.name, person.login],
  fetchPage,
  renderRow,
  header,
  listClassName,
}) {
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState('')
  const timer = useRef(null)

  useEffect(() => {
    setQuery('')
    setRemote(null)
    setFailed('')
  }, [initial])

  const paged = initialHasMore
  const dirty = remote !== null

  useEffect(() => {
    if (!paged) return undefined
    const wanted = query.trim()
    if (!wanted && !dirty) return undefined

    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setLoading(true)
      setFailed('')
      try {
        const answer = await fetchPage({ q: wanted, page: 1, pageSize })
        setRemote({ items: answer.items, total: answer.total, page: 1 })
      } catch {
        setFailed(isEn ? 'Search failed.' : 'Не вдалося виконати пошук.')
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer.current)
  }, [query, pageSize, paged, isEn, dirty, fetchPage])

  const goTo = async page => {
    setLoading(true)
    setFailed('')
    try {
      const answer = await fetchPage({ q: query.trim(), page, pageSize })
      setRemote({ items: answer.items, total: answer.total, page })
    } catch {
      setFailed(isEn ? 'Could not load the page.' : 'Не вдалося завантажити сторінку.')
    } finally {
      setLoading(false)
    }
  }

  const needle = query.trim().toLowerCase()
  const local = paged
    ? null
    : needle
      ? initial.filter(item =>
          localFields(item)
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(needle)),
        )
      : initial

  const shown = local ?? remote?.items ?? initial
  const shownTotal = local ? local.length : (remote?.total ?? total)
  const current = remote?.page ?? 1
  const lastPage = local ? 1 : Math.max(1, Math.ceil(shownTotal / pageSize))

  const counter = needle ? (isEn ? `${shownTotal} found` : `знайдено ${shownTotal}`) : null

  return (
    <>
      <div className="paged-head">
        {header?.(counter)}
        {searchable && total > 5 && (
          <input
            className="modal-input paged-search"
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            onChange={event => setQuery(event.target.value)}
          />
        )}
      </div>

      {failed && <p className="offline-banner">{failed}</p>}
      {!loading && needle && shown.length === 0 && <p className="paged-empty">{emptyText}</p>}

      {listClassName ? (
        <ul className={listClassName}>{shown.map(renderRow)}</ul>
      ) : (
        shown.map(renderRow)
      )}

      {lastPage > 1 && (
        <nav className="paged-nav" aria-label={isEn ? 'Pages' : 'Сторінки'}>
          <button
            className="btn btn-outline btn-sm paged-step"
            disabled={loading || current === 1}
            aria-label={isEn ? 'Previous page' : 'Попередня сторінка'}
            onClick={() => goTo(current - 1)}
          >
            ←
          </button>

          {pageWindow(current, lastPage).map((value, index) =>
            value === 'gap' ? (
              <span className="paged-gap" key={`gap-${index}`}>
                …
              </span>
            ) : (
              <button
                key={value}
                className={`btn btn-outline btn-sm paged-page${value === current ? ' is-current' : ''}`}
                disabled={loading || value === current}
                aria-current={value === current ? 'page' : undefined}
                onClick={() => goTo(value)}
              >
                {value}
              </button>
            ),
          )}

          <button
            className="btn btn-outline btn-sm paged-step"
            disabled={loading || current === lastPage}
            aria-label={isEn ? 'Next page' : 'Наступна сторінка'}
            onClick={() => goTo(current + 1)}
          >
            →
          </button>
        </nav>
      )}
    </>
  )
}
