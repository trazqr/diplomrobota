export default function Pagination({ page, totalPages, total, lang, onPageChange }) {
  if (totalPages <= 1) return null

  const isEn = lang === 'en'
  return (
    <nav className="pagination" aria-label={isEn ? 'Pagination' : 'Навігація сторінками'}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← {isEn ? 'Previous' : 'Назад'}
      </button>
      <span className="pagination-status">
        {isEn ? `Page ${page} of ${totalPages}` : `Сторінка ${page} з ${totalPages}`}
        <small>{isEn ? `${total} total` : `Усього: ${total}`}</small>
      </span>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {isEn ? 'Next' : 'Далі'} →
      </button>
    </nav>
  )
}
