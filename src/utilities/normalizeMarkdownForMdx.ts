function normalizeInlineFormatting(markdown: string): string {
  const formats = ['\\*\\*', '__', '~~']

  return formats.reduce((result, format) => {
    const delimiter = format.replace(/\\/g, '')
    const parts = result.split(new RegExp(`(${format})`, 'g'))

    // `split` puts delimiters at odd indexes. Handle them as ordered pairs
    // instead of matching an arbitrary later delimiter, which can pair a
    // closing marker with the next formatted span on the same line.
    for (let openingIndex = 1; openingIndex + 2 < parts.length; openingIndex += 4) {
      const contentIndex = openingIndex + 1
      const closingIndex = openingIndex + 2
      const followingTextIndex = closingIndex + 1
      const content = parts[contentIndex]
      const leadingWhitespace = content.match(/^[\t ]+/)?.[0] ?? ''
      const trailingWhitespace = content.match(/[\t ]+$/)?.[0] ?? ''

      if (leadingWhitespace) {
        const precedingTextIndex = openingIndex - 1
        if (!/[\t ]$/.test(parts[precedingTextIndex])) {
          parts[precedingTextIndex] += leadingWhitespace
        }
        parts[contentIndex] = parts[contentIndex].slice(leadingWhitespace.length)
      }

      if (trailingWhitespace) {
        if (!/^[\t ]/.test(parts[followingTextIndex] ?? '')) {
          parts[followingTextIndex] = `${trailingWhitespace}${parts[followingTextIndex] ?? ''}`
        }
        parts[contentIndex] = parts[contentIndex].slice(0, -trailingWhitespace.length)
      }
    }

    return parts.join('')
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
