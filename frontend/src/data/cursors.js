const svg = body =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${body}</svg>`,
  )}`

const OUT = 'stroke="#1a1a17" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"'

export const CURSORS = {
  sword: {
    labelUa: 'Меч',
    labelEn: 'Sword',
    hotspot: [2, 2],
    src: svg(`
      <g fill="#d8d4c6" ${OUT}>
        <path d="M3 3 L7 3 L25 21 L23 25 L19 27 L3 9 Z"/>
      </g>
      <g fill="#8a6b3a" ${OUT}>
        <path d="M18 26 L26 18 L30 22 L22 30 Z"/>
      </g>`),
  },

  fireball: {
    labelUa: 'Вогняна куля',
    labelEn: 'Fireball',
    hotspot: [16, 16],
    src: svg(`
      <g ${OUT}>
        <path fill="#e2622a" d="M16 3c4 5 9 7 9 13a9 9 0 0 1-18 0c0-6 5-8 9-13z"/>
        <path fill="#f5b53c" stroke="none" d="M16 12c2 3 4 4 4 7a4 4 0 0 1-8 0c0-3 2-4 4-7z"/>
      </g>`),
  },

  d20: {
    labelUa: 'Кубик d20',
    labelEn: 'D20 die',
    hotspot: [16, 16],
    src: svg(`
      <g fill="#7c8534" ${OUT}>
        <path d="M16 2 29 9.5v13L16 30 3 22.5v-13z"/>
      </g>
      <g fill="none" stroke="#1a1a17" stroke-width="1.6">
        <path d="M16 2 8 16l8 14 8-14z"/>
        <path d="M3 9.5 8 16 3 22.5M29 9.5 24 16l5 6.5M8 16h16"/>
      </g>`),
  },

  wand: {
    labelUa: 'Чарівна палиця',
    labelEn: 'Wand',
    hotspot: [3, 3],

    src: svg(`
      <g ${OUT}>
        <path fill="#6b4a2a" d="M5 27 22 10" stroke-width="4.2"/>
      </g>
      <g fill="#8a6b3a" ${OUT}>
        <path d="M4 24 8 28 5 31 1 27z"/>
      </g>
      <g fill="#f0d060" ${OUT}>
        <path d="M24 4 26 10 32 12 26 14 24 20 22 14 16 12 22 10z"/>
      </g>`),
  },

  arrow: {
    labelUa: 'Стріла',
    labelEn: 'Arrow',
    hotspot: [2, 2],

    src: svg(`
      <g ${OUT}>
        <path fill="#6b4a2a" d="M7 7 25 25" stroke-width="3.4"/>
      </g>
      <g fill="#d8d4c6" ${OUT}>
        <path d="M2 2 12 6 9.5 8.5 6 12z"/>
      </g>
      <g fill="#cfc9b6" ${OUT}>
        <path d="M23 23 30 21 28 28 21 30z"/>
      </g>
      <g fill="none" stroke="#8a6b3a" stroke-width="1.6" stroke-linecap="round">
        <path d="M26.5 26.5 30 30"/>
      </g>`),
  },

  claw: {
    labelUa: 'Кіготь дракона',
    labelEn: 'Dragon claw',
    hotspot: [4, 3],
    src: svg(`
      <g fill="#c9c2ae" ${OUT}>
        <path d="M4 3c6 2 10 7 12 13l-4 2C10 12 7 8 3 6z"/>
        <path d="M12 6c5 3 8 8 9 14l-4 1c-1-6-3-10-7-13z"/>
        <path d="M21 11c4 4 6 9 6 15l-4 0c0-6-1-10-4-13z"/>
      </g>`),
  },
}
