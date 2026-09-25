function Ico({ size = 18, className = '', fill = 'none', children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill={fill}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconScroll(props) {
  return (
    <Ico {...props}>
      <path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M5 6a2 2 0 0 1 4 0v2H5z" />
      <path d="M10 10h6M10 14h6" />
    </Ico>
  )
}

export function IconWorld(props) {
  return (
    <Ico {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5S14.4 17.9 12 20.5c-2.4-2.6-3.6-5.4-3.6-8.5S9.6 6.1 12 3.5z" />
    </Ico>
  )
}

export function IconBook(props) {
  return (
    <Ico {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 18.2h15" />
      <path d="M8 7.5h7" />
    </Ico>
  )
}

export function IconSwords(props) {
  return (
    <Ico {...props}>
      <path d="M4 4h3l9.5 9.5" />
      <path d="M20 4h-3L7.5 13.5" />
      <path d="m4.5 17 2.5 2.5M6 19.5 4 21.5M19.5 17 17 19.5M18 19.5l2 2" />
    </Ico>
  )
}

export function IconWizard(props) {
  return (
    <Ico {...props}>
      <path d="M12 2.5 6.5 15h11z" />
      <path d="M4.5 15.5h15a1.5 1.5 0 0 1 0 3h-15a1.5 1.5 0 0 1 0-3z" />
      <path d="m11 8 1 1.6 1-1.6" />
    </Ico>
  )
}

export function IconBlade(props) {
  return (
    <Ico {...props}>
      <path d="M17.5 2.5 8 12l4 4 9.5-9.5V2.5z" />
      <path d="m8 12-3.5 3.5 4 4L12 16" />
      <path d="M4.5 19.5 2.5 21.5" />
    </Ico>
  )
}

export function IconShield(props) {
  return (
    <Ico {...props}>
      <path d="M12 2.8 4.5 6v6.2c0 4 3.1 7.4 7.5 9 4.4-1.6 7.5-5 7.5-9V6z" />
    </Ico>
  )
}

export function IconMap(props) {
  return (
    <Ico {...props}>
      <path d="M9 3.5 3.5 6v14.5L9 18l6 2.5 5.5-2.5V3.5L15 6z" />
      <path d="M9 3.5V18M15 6v14.5" />
    </Ico>
  )
}

export function IconChart(props) {
  return (
    <Ico {...props}>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V6M17 20v-9" />
    </Ico>
  )
}

export function IconNews(props) {
  return (
    <Ico {...props}>
      <path d="M4 5h13v14H5.5A1.5 1.5 0 0 1 4 17.5z" />
      <path d="M17 8h3v9.5a1.5 1.5 0 0 1-3 0z" />
      <path d="M7 8.5h7M7 12h7M7 15.5h4" />
    </Ico>
  )
}

export function IconUpload(props) {
  return (
    <Ico {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 17.5z" />
      <path d="M11 16.5v-5M8.5 13.5 11 11l2.5 2.5" />
    </Ico>
  )
}

export function IconWarning(props) {
  return (
    <Ico {...props}>
      <path d="M12 3.8 21 19.2H3z" />
      <path d="M12 9.5v4.2" />
      <path d="M12 16.6v.2" />
    </Ico>
  )
}

export function IconGoogle({ size = 18, className = '' }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <path
        fill="#ffc107"
        d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.9z"
      />
      <path
        fill="#ff3d00"
        d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4caf50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976d2"
        d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C36.9 39.7 44 34.5 44 24a20 20 0 0 0-.4-3.9z"
      />
    </svg>
  )
}

export function IconHeart({ filled = false, ...rest }) {
  return (
    <Ico {...rest} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20z" />
    </Ico>
  )
}

export function IconTrash(props) {
  return (
    <Ico {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.8h5v1.7" />
      <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
      <path d="M10.5 10v6.5M13.5 10v6.5" />
    </Ico>
  )
}

export function IconPin(props) {
  return (
    <Ico {...props}>
      <path d="M12 21s6.5-6.1 6.5-11a6.5 6.5 0 1 0-13 0c0 4.9 6.5 11 6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </Ico>
  )
}

export function IconUsers(props) {
  return (
    <Ico {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.9" />
      <path d="M17.5 14.9c1.9.6 3.2 2.3 3.2 4.6" />
    </Ico>
  )
}

export function IconPencil(props) {
  return (
    <Ico {...props}>
      <path d="M4 20h4L19.2 8.8a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z" />
      <path d="m14.5 6.5 3 3" />
    </Ico>
  )
}

export function IconStar(props) {
  return (
    <Ico {...props}>
      <path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z" />
    </Ico>
  )
}

export function IconClock(props) {
  return (
    <Ico {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </Ico>
  )
}

export function IconUser(props) {
  return (
    <Ico {...props}>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20c0-3.6 3.2-6.2 7.2-6.2s7.2 2.6 7.2 6.2" />
    </Ico>
  )
}

export function IconLink(props) {
  return (
    <Ico {...props}>
      <path d="M10 13.5a3.6 3.6 0 0 0 5.3.4l2.8-2.8a3.6 3.6 0 0 0-5.1-5.1l-1.6 1.6" />
      <path d="M14 10.5a3.6 3.6 0 0 0-5.3-.4l-2.8 2.8a3.6 3.6 0 0 0 5.1 5.1l1.6-1.6" />
    </Ico>
  )
}

export function IconComment(props) {
  return (
    <Ico {...props}>
      <path d="M20.5 12.2c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.5-3.6C4.2 15.7 3.5 14 3.5 12.2c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" />
    </Ico>
  )
}

export function CategoryIcon({ cat, size = 16, className = 'cat-icon' }) {
  const map = {
    all: IconScroll,
    lore: IconWorld,
    rules: IconBook,
    campaigns: IconSwords,
    characters: IconWizard,
    equipment: IconBlade,
  }
  const Pick = map[cat] || IconScroll
  return <Pick size={size} className={className} />
}
