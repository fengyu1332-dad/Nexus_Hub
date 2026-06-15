'use client'

import CustomCodeRenderer from '@/components/renderers/CustomCodeRenderer'
import CustomImageRenderer from '@/components/renderers/CustomImageRenderer'
import MathRenderer from '@/components/renderers/MathRenderer'
import { Component, FC } from 'react'
import dynamic from 'next/dynamic'
import { useDict } from '@/components/I18nProvider'

// ErrorBoundary to prevent editorjs-react-renderer crashes from breaking the page
class EditorErrorBoundary extends Component<
  { children: React.ReactNode; fallback: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: string }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return <p className='text-sm text-zinc-400 italic'>{this.props.fallback}</p>
    }
    return this.props.children
  }
}

const Output = dynamic(
  async () => (await import('editorjs-react-renderer')).default,
  { ssr: false }
)

interface EditorOutputProps {
  content: any
}

const renderers = {
  image: CustomImageRenderer,
  code: CustomCodeRenderer,
  math: MathRenderer,
}

const style = {
  paragraph: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
}

function normalizeContent(content: any, noContentText: string) {
  // Handle string content — try to parse as JSON first
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      if (parsed && Array.isArray(parsed.blocks)) return parsed
    } catch { /* not valid JSON, treat as raw text */ }
    if (content.trim()) {
      return {
        time: Date.now(),
        blocks: [{ type: 'paragraph', data: { text: content } }],
        version: '2.28.0',
      }
    }
  }
  // Already valid EditorJS block data (object with blocks array)
  if (content && Array.isArray(content.blocks)) {
    // Ensure blocks is never undefined when passed to editorjs-react-renderer
    if (content.blocks.length === 0) {
      return { time: Date.now(), blocks: [{ type: 'paragraph', data: { text: noContentText } }], version: '2.28.0' }
    }
    return content
  }
  // Fallback: empty paragraph to prevent crash
  return {
    time: Date.now(),
    blocks: [{ type: 'paragraph', data: { text: noContentText } }],
    version: '2.28.0',
  }
}

const EditorOutput: FC<EditorOutputProps> = ({ content }) => {
  const dict = useDict()
  const data = normalizeContent(content, dict.editor.noContent)
  return (
    <EditorErrorBoundary fallback={dict.editor.noContent}>
      {/* @ts-expect-error */}
      <Output
        style={style}
        className='text-sm'
        renderers={renderers}
        data={data}
      />
    </EditorErrorBoundary>
  )
}

export default EditorOutput
