function normalizeInlineFormatting(markdown: string): string {
  const formats = ['\\*\\*', '__', '~~']

  return formats.reduce((result, format) => {
    const delimiter = format.replace(/\\/g, '')
    const escapedDelimiter = format

    return result
      .replace(
        new RegExp(`(${escapedDelimiter})([\\t ]+)([^\\n]*?)\\1`, 'g'),
        (_match, _marker, leadingWhitespace: string, content: string) =>
          `${leadingWhitespace}${delimiter}${content}${delimiter}`,
      )
      .replace(
        new RegExp(`(${escapedDelimiter})([^\\n]*?)([\\t ]+)\\1`, 'g'),
        (_match, _marker, content: string, trailingWhitespace: string) =>
          `${delimiter}${content}${delimiter}${trailingWhitespace}`,
      )
  }, markdown)
}

/**
 * Lexical may export a formatted text node with leading or trailing whitespace
 * inside its Markdown delimiters (for example, `**Label: **`). MDX treats that
 * as literal text, while the Payload admin preview still renders it as bold.
 * Preserve fenced and inline code verbatim, then move that whitespace outside
 * bold, underline and strikethrough delimiters in prose.
 */
export function normalizeMarkdownForMdx(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((section) => {
      if (section.startsWith('```')) return section

      return section
        .split(/(`[^`\n]*`)/g)
        .map((part) => (part.startsWith('`') ? part : normalizeInlineFormatting(part)))
        .join('')
    })
    .join('')
}
