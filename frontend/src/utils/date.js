const formatters = new Map()

export function formatDate(value, lang = 'ua', includeTime = false) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  const key = `${lang}:${includeTime}`
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'uk-UA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      }),
    )
  }
  return formatters.get(key).format(date)
}
