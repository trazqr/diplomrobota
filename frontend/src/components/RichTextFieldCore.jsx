import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { IconLink } from './Icons'

const MARKS = [
  { key: 'bold', label: 'B', title: ['Жирний', 'Bold'], style: { fontWeight: 700 } },
  { key: 'italic', label: 'I', title: ['Курсив', 'Italic'], style: { fontStyle: 'italic' } },
  {
    key: 'underline',
    label: 'U',
    title: ['Підкреслений', 'Underline'],
    style: { textDecoration: 'underline' },
  },
  {
    key: 'strike',
    label: 'S',
    title: ['Закреслений', 'Strikethrough'],
    style: { textDecoration: 'line-through' },
  },
]

const BLOCKS = [
  { key: 'heading2', label: 'H2', title: ['Заголовок', 'Heading'] },
  { key: 'heading3', label: 'H3', title: ['Підзаголовок', 'Subheading'] },
  { key: 'paragraph', label: '¶', title: ['Абзац', 'Paragraph'] },
  { key: 'blockquote', label: '❝', title: ['Цитата', 'Quote'] },
  { key: 'codeBlock', label: '</>', title: ['Код', 'Code'] },
]

const EMPTY_ACTIVE = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  heading2: false,
  heading3: false,
  paragraph: false,
  blockquote: false,
  codeBlock: false,
  bulletList: false,
  orderedList: false,
  link: false,
}

function applyMark(editor, key) {
  const chain = editor.chain().focus()
  if (key === 'bold') return chain.toggleBold().run()
  if (key === 'italic') return chain.toggleItalic().run()
  if (key === 'underline') return chain.toggleUnderline().run()
  return chain.toggleStrike().run()
}

function applyBlock(editor, key) {
  const chain = editor.chain().focus()
  if (key === 'heading2') return chain.setHeading({ level: 2 }).run()
  if (key === 'heading3') return chain.setHeading({ level: 3 }).run()
  if (key === 'paragraph') return chain.setParagraph().run()
  if (key === 'blockquote') return chain.toggleBlockquote().run()
  return chain.toggleCodeBlock().run()
}

export default function RichTextField({
  value,
  onChange,
  lang,
  placeholder,
  onError,
  blocks = true,
  className = '',
}) {
  const isEn = lang === 'en'
  const onChangeRef = useRef(onChange)
  const pendingHtmlRef = useRef(null)
  const [mode, setMode] = useState('visual')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3, 4] },
          link: {
            openOnClick: false,
            autolink: false,
            linkOnPaste: false,
          },
        }),
        Placeholder.configure({ placeholder: placeholder || '' }),
      ],
      content: value || '',
      editorProps: {
        attributes: {
          class: 'editor-surface',
          'aria-label': placeholder || '',
        },
      },
      immediatelyRender: false,
      onUpdate: ({ editor: current }) => {
        const html = current.getHTML()
        pendingHtmlRef.current = html
        onChangeRef.current(html)
      },
    },
    [placeholder],
  )

  const active =
    useEditorState({
      editor,
      selector: ({ editor: current }) =>
        current && !current.isDestroyed
          ? {
              bold: current.isActive('bold'),
              italic: current.isActive('italic'),
              underline: current.isActive('underline'),
              strike: current.isActive('strike'),
              heading2: current.isActive('heading', { level: 2 }),
              heading3: current.isActive('heading', { level: 3 }),
              paragraph: current.isActive('paragraph'),
              blockquote: current.isActive('blockquote'),
              codeBlock: current.isActive('codeBlock'),
              bulletList: current.isActive('bulletList'),
              orderedList: current.isActive('orderedList'),
              link: current.isActive('link'),
            }
          : EMPTY_ACTIVE,
    }) || EMPTY_ACTIVE

  useEffect(() => {
    if (!editor || editor.isDestroyed || mode !== 'visual') return
    const nextHtml = value || ''
    if (nextHtml === pendingHtmlRef.current) {
      pendingHtmlRef.current = null
      return
    }
    if (pendingHtmlRef.current !== null) return
    if (editor.getHTML() !== nextHtml) {
      editor.commands.setContent(nextHtml, { emitUpdate: false })
    }
  }, [editor, mode, value])

  const reportError = (message = '') => onError?.(message)

  const askUrl = (pattern, message) => {
    if (!editor || editor.isDestroyed) return
    const currentUrl = editor.getAttributes('link').href || ''
    const url = window.prompt(message, currentUrl)
    if (!url) return
    if (!pattern.test(url)) {
      reportError(
        isEn
          ? 'Only http(s) and email links are allowed.'
          : 'Дозволені лише посилання http(s) та email.',
      )
      return
    }

    reportError()
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const switchMode = next => {
    if (next === 'html' && editor && !editor.isDestroyed) onChange(editor.getHTML())
    setMode(next)
  }

  const tool = (extra, isActive) => ({
    type: 'button',
    className: `btn btn-icon editor-tool${isActive ? ' active' : ''}`,
    disabled: !editor || editor.isDestroyed,
    onMouseDown: event => event.preventDefault(),
    ...(isActive === undefined ? {} : { 'aria-pressed': isActive }),
    ...extra,
  })

  return (
    <div className={`rich-field ${className}`}>
      <div className="editor-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'visual'}
          className={`btn-tabline${mode === 'visual' ? ' active' : ''}`}
          onClick={() => switchMode('visual')}
        >
          {isEn ? 'Visual' : 'Візуально'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'html'}
          className={`btn-tabline${mode === 'html' ? ' active' : ''}`}
          onClick={() => switchMode('html')}
        >
          HTML
        </button>
      </div>

      {mode === 'visual' ? (
        <>
          <div className="editor-toolbar" role="toolbar">
            {MARKS.map(mark => (
              <button
                key={mark.key}
                {...tool(
                  {
                    style: mark.style,
                    title: isEn ? mark.title[1] : mark.title[0],
                    onClick: () => {
                      reportError()
                      applyMark(editor, mark.key)
                    },
                  },
                  active[mark.key],
                )}
              >
                {mark.label}
              </button>
            ))}

            {blocks && (
              <>
                <span className="editor-sep" />
                {BLOCKS.map(block => (
                  <button
                    key={block.key}
                    {...tool(
                      {
                        title: isEn ? block.title[1] : block.title[0],
                        onClick: () => {
                          reportError()
                          applyBlock(editor, block.key)
                        },
                      },
                      active[block.key],
                    )}
                  >
                    {block.label}
                  </button>
                ))}
              </>
            )}

            <span className="editor-sep" />

            <button
              {...tool(
                {
                  title: isEn ? 'Bullet list' : 'Список',
                  onClick: () => editor.chain().focus().toggleBulletList().run(),
                },
                active.bulletList,
              )}
            >
              • —
            </button>
            <button
              {...tool(
                {
                  title: isEn ? 'Numbered list' : 'Нумерований список',
                  onClick: () => editor.chain().focus().toggleOrderedList().run(),
                },
                active.orderedList,
              )}
            >
              1.
            </button>

            <span className="editor-sep" />

            <button
              {...tool(
                {
                  title: isEn ? 'Link' : 'Посилання',
                  onClick: () =>
                    askUrl(
                      /^(https?:\/\/|mailto:)/i,
                      isEn ? 'Link URL (https://…)' : 'Посилання (https://…)',
                    ),
                },
                active.link,
              )}
            >
              <IconLink size={15} />
            </button>

            <button
              {...tool({
                title: isEn ? 'Clear formatting' : 'Прибрати форматування',
                onClick: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
              })}
            >
              ⌫
            </button>
          </div>

          <EditorContent editor={editor} />
        </>
      ) : (
        <>
          <p className="editor-hint">
            {isEn
              ? 'Advanced mode. Allowed: headings, lists, links, tables, and basic styles. Scripts, event handlers, and images are stripped by the server.'
              : 'Режим для досвідчених. Дозволено: заголовки, списки, посилання, таблиці та базові стилі. Скрипти, обробники подій і зображення сервер вирізає.'}
          </p>
          <textarea
            className="editor-html"
            value={value}
            onChange={event => onChange(event.target.value)}
            spellCheck={false}
            placeholder={lang === 'en' ? '<p>Text…</p>' : '<p>Текст…</p>'}
          />
        </>
      )}
    </div>
  )
}
