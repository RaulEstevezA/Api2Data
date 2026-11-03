import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { xml } from '@codemirror/lang-xml'
import { bracketMatching, HighlightStyle, indentOnInput, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { Compartment, EditorState, RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, EditorView, highlightActiveLine, keymap, lineNumbers, placeholder as placeholderText } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useEffect, useRef } from 'react'
import './CodeEditor.css'

// GitHub's syntax colors, from the tokens in index.css (same editor as Api2Class)
const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword, tags.definitionKeyword], color: 'var(--syntax-keyword)' },
  { tag: [tags.string, tags.special(tags.string), tags.attributeValue], color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--syntax-constant)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--syntax-property)' },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.tagName], color: 'var(--syntax-type)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--syntax-function)' },
  { tag: [tags.meta, tags.annotation, tags.processingInstruction], color: 'var(--syntax-function)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--syntax-comment)', fontStyle: 'italic' },
])

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--page-bg)', color: 'var(--text)', fontSize: 'var(--font-code)' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: 'var(--leading-code)' },
  '.cm-content': { caretColor: 'var(--accent)' },
  '.cm-gutters': { backgroundColor: 'var(--page-bg)', color: 'var(--muted)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--hover)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selection)',
  },
  '.cm-matchingBracket': { backgroundColor: 'var(--bracket)', outline: 'none' },
  '.cm-placeholder': { color: 'var(--muted)' },
  '.cm-errorLine': { backgroundColor: 'var(--error-line)' },
})

export type EditorLanguage = 'json' | 'xml' | 'javascript' | 'python' | 'shell' | null

const LANGUAGES: Record<Exclude<EditorLanguage, null>, () => Extension> = {
  json,
  xml,
  javascript,
  python,
  shell: () => StreamLanguage.define(shell),
}

function errorLineDecoration(line: number | null) {
  return EditorView.decorations.compute(['doc'], (state) => {
    const builder = new RangeSetBuilder<Decoration>()
    if (line !== null && line <= state.doc.lines) {
      builder.add(state.doc.line(line).from, state.doc.line(line).from, Decoration.line({ class: 'cm-errorLine' }))
    }
    return builder.finish()
  })
}

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language: EditorLanguage
  readOnly?: boolean
  label: string
  placeholder?: string
  /** 1-based line to highlight as wrong */
  errorLine?: number | null
}

/** CodeMirror editor. Text typed here is only kept in memory. */
export function CodeEditor({ value, onChange, language, readOnly = false, label, placeholder = '', errorLine = null }: CodeEditorProps) {
  const container = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const compartments = useRef({
    language: new Compartment(),
    readOnly: new Compartment(),
    errorLine: new Compartment(),
    texts: new Compartment(),
  })

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Created once; the props are applied below by reconfiguring it
  useEffect(() => {
    const slots = compartments.current
    const editor = new EditorView({
      parent: container.current!,
      state: EditorState.create({
        doc: '',
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          bracketMatching(),
          indentOnInput(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          syntaxHighlighting(highlight),
          theme,
          slots.language.of([]),
          slots.readOnly.of([]),
          slots.errorLine.of([]),
          slots.texts.of([]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
  }, [])

  useEffect(() => {
    view.current?.dispatch({ effects: compartments.current.language.reconfigure(language ? LANGUAGES[language]() : []) })
  }, [language])

  useEffect(() => {
    view.current?.dispatch({ effects: compartments.current.readOnly.reconfigure(EditorState.readOnly.of(readOnly)) })
  }, [readOnly])

  // Change with the interface language
  useEffect(() => {
    const texts = [EditorView.contentAttributes.of({ 'aria-label': label }), placeholderText(placeholder)]
    view.current?.dispatch({ effects: compartments.current.texts.reconfigure(texts) })
  }, [label, placeholder])

  useEffect(() => {
    view.current?.dispatch({ effects: compartments.current.errorLine.reconfigure(errorLineDecoration(errorLine)) })
  }, [errorLine])

  // Only replaces the text when it comes from outside (an example, a response), not while typing
  useEffect(() => {
    const editor = view.current
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
    }
  }, [value])

  return <div ref={container} className="code-editor" />
}
