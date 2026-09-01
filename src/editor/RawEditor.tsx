import Editor from '@monaco-editor/react'
import { useState } from 'react'

interface RawEditorProps {
  value: string
  onApply: (value: string) => { ok: boolean; error?: string }
}

export function RawEditor({ value, onApply }: RawEditorProps) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  const apply = () => {
    const result = onApply(draft)
    setError(result.ok ? '' : result.error ?? 'Could not apply JSON')
  }
  const format = () => {
    try { setDraft(JSON.stringify(JSON.parse(draft), null, 2)); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid JSON') }
  }
  return <section className="raw-editor">
    <div className="editor-actions"><button onClick={format}>Format</button><button className="primary" onClick={apply}>Apply JSON</button>{error && <span className="inline-error">{error}</span>}</div>
    <Editor height="100%" defaultLanguage="json" theme="vs-dark" value={draft} onChange={(next) => setDraft(next ?? '')} options={{ minimap: { enabled: true }, fontSize: 13, tabSize: 2, automaticLayout: true, scrollBeyondLastLine: false }} />
  </section>
}
