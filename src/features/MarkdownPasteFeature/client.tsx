'use client'

import { createClientFeature, useEditorConfigContext } from '@payloadcms/richtext-lexical/client'
import { $convertFromMarkdownString } from '@payloadcms/richtext-lexical/lexical/markdown'
import { COMMAND_PRIORITY_CRITICAL, PASTE_COMMAND } from '@payloadcms/richtext-lexical/lexical'
import { useEffect } from 'react'

type MarkdownPasteFeatureProps = {
  collection: 'blog-posts' | 'docs'
}

function looksLikeMarkdown(value: string): boolean {
  return (
    /(^|\n)(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+|```|\|.+\|\s*\n\|\s*:?-{3,}|---\s*$)/m.test(value) ||
    /\[[^\]]+\]\([^\s)]+\)|!\[[^\]]*\]\([^\s)]+\)|(^|\s)(\*\*|__|~~|`)[^\n]+/m.test(value)
  )
}

function MarkdownPastePlugin() {
  const { editor, editorConfig } = useEditorConfigContext()

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (!(event instanceof ClipboardEvent)) return false

          const markdown = event.clipboardData?.getData('text/plain')
          if (!markdown || !looksLikeMarkdown(markdown)) return false

          event.preventDefault()
          editor.update(() => {
            $convertFromMarkdownString(markdown, editorConfig.features.markdownTransformers)
          })

          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    [editor, editorConfig.features.markdownTransformers],
  )

  return null
}

export const MarkdownPasteFeatureClient = createClientFeature<MarkdownPasteFeatureProps>({
  plugins: [
    {
      Component: MarkdownPastePlugin,
      position: 'normal',
    },
  ],
})
