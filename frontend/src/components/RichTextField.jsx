import { lazy, Suspense } from 'react'

const RichTextFieldCore = lazy(() => import('./RichTextFieldCore'))

export default function RichTextField(props) {
  const { className = '', lang } = props
  const loadingLabel = lang === 'en' ? 'Loading editor' : 'Завантаження редактора'

  return (
    <Suspense
      fallback={
        <div
          className={`rich-field ${className}`}
          role="status"
          aria-label={loadingLabel}
          aria-busy="true"
        >
          <div className="editor-loading" />
        </div>
      }
    >
      <RichTextFieldCore {...props} />
    </Suspense>
  )
}
