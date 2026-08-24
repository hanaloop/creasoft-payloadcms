'use client'

import { useState } from 'react'
import { useField } from '@payloadcms/ui'

import './index.scss'

export default function MarkdownPaste({
  field,
}: {
  field: { custom?: { collection?: 'blog-posts' | 'docs' } }
}) {
  const collection = field.custom?.collection ?? 'docs'
  const { setValue } = useField({ path: 'content' })
  const [isImporting, setIsImporting] = useState(false)

  const importMarkdown = async () => {
    setIsImporting(true)
    try {
      const markdown = await navigator.clipboard.readText()
      const response = await fetch('/api/convert-markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, markdown }),
      })
      if (!response.ok) throw new Error('Markdown conversion failed.')
      const { content } = await response.json()
      setValue(content)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <section className="markdown-paste">
      <div className="markdown-paste__icon" aria-hidden="true">
        M↓
      </div>
      <div className="markdown-paste__copy">
        <strong>Markdown 가져오기</strong>
        <span>클립보드의 Markdown을 본문 서식으로 변환합니다.</span>
      </div>
      <button type="button" onClick={() => void importMarkdown()} disabled={isImporting}>
        {isImporting ? '변환 중…' : '클립보드 붙여넣기'}
      </button>
    </section>
  )
}
