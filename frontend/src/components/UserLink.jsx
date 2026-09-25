export function userProfileHash(login) {
  return `#user/${encodeURIComponent(login)}`
}

export default function UserLink({ login, className = '', children }) {
  if (!login) return <span className={className}>{children}</span>

  return (
    <a className={`user-link ${className}`.trim()} href={userProfileHash(login)}>
      {children}
    </a>
  )
}
