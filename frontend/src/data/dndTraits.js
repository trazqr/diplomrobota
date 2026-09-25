export const DND_CLASSES = [
  { en: 'Barbarian', ua: 'Варвар' },
  { en: 'Bard', ua: 'Бард' },
  { en: 'Cleric', ua: 'Клірик' },
  { en: 'Druid', ua: 'Друїд' },
  { en: 'Fighter', ua: 'Боєць' },
  { en: 'Monk', ua: 'Монах' },
  { en: 'Paladin', ua: 'Паладин' },
  { en: 'Ranger', ua: 'Слідопит' },
  { en: 'Rogue', ua: 'Пройдисвіт' },
  { en: 'Warlock', ua: 'Чаклун' },
  { en: 'Wizard', ua: 'Чарівник' },
  { en: 'Sorcerer', ua: 'Чародій' },
  { en: 'Dungeon Master', ua: 'Майстер Підземель' },
]

export const DND_RACES = [
  { en: 'Human', ua: 'Людина' },
  { en: 'Elf', ua: 'Ельф' },
  { en: 'Dwarf', ua: 'Дворф' },
  { en: 'Halfling', ua: 'Піврослик' },
  { en: 'Gnome', ua: 'Гном' },
  { en: 'Half-Orc', ua: 'Напіворк' },
  { en: 'Tiefling', ua: 'Тифлін' },
  { en: 'Dragonborn', ua: 'Драконородний' },
  { en: 'Half-Elf', ua: 'Напівельф' },
]

function localize(list, value, lang) {
  if (!value) return ''
  const match = list.find(item => item.en === value || item.ua === value)
  if (!match) return value
  return lang === 'ua' ? match.ua : match.en
}

export const localizeClass = (value, lang) => localize(DND_CLASSES, value, lang)
export const localizeRace = (value, lang) => localize(DND_RACES, value, lang)
