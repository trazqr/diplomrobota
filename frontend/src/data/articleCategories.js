export const ARTICLE_CATEGORIES = [
  { key: 'lore', ua: 'Лор', en: 'Lore' },
  { key: 'rules', ua: 'Правила', en: 'Rules' },
  { key: 'campaigns', ua: 'Кампанії', en: 'Campaigns' },
  { key: 'characters', ua: 'Персонажі', en: 'Characters' },
  { key: 'equipment', ua: 'Спорядження', en: 'Equipment' },
]

export const ARTICLE_CATEGORY_FILTERS = [
  { key: 'all', ua: 'Всі', en: 'All' },
  ...ARTICLE_CATEGORIES,
]

export function getCategoryLabel(key, lang) {
  const found = ARTICLE_CATEGORY_FILTERS.find(item => item.key === key)
  if (!found) return key
  return lang === 'ua' ? found.ua : found.en
}
