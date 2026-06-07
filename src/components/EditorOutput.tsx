'use client'

import CustomCodeRenderer from '@/components/renderers/CustomCodeRenderer'
import CustomImageRenderer from '@/components/renderers/CustomImageRenderer'
import MathRenderer from '@/components/renderers/MathRenderer'
import { FC } from 'react'
import dynamic from 'next/dynamic'

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

function normalizeContent(content: any) {
  // Already valid EditorJS block data
  if (content && Array.isArray(content.blocks)) {
    return content
  }
  // Raw string → wrap as paragraph block
  if (typeof content === 'string' && content.trim()) {
    return {
      time: Date.now(),
      blocks: [{ type: 'paragraph', data: { text: content } }],
      version: '2.28.0',
    }
  }
  // Fallback: empty paragraph to prevent crash
  return {
    time: Date.now(),
    blocks: [{ type: 'paragraph', data: { text: '(暂无内容)' } }],
    version: '2.28.0',
  }
}

const EditorOutput: FC<EditorOutputProps> = ({ content }) => {
  const data = normalizeContent(content)
  return (
    // @ts-expect-error
    <Output
      style={style}
      className='text-sm'
      renderers={renderers}
      data={data}
    />
  )
}

export default EditorOutput
