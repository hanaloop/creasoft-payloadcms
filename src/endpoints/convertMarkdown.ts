import { BlogPosts } from '@/collections/BlogPosts'
import { Docs } from '@/collections/Docs'
import { APIError, type Endpoint, type RichTextField } from 'payload'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'

function contentField(collection: typeof Docs | typeof BlogPosts): RichTextField {
  const tabs = collection.fields.find((field) => field.type === 'tabs')
  const field =
    tabs?.type === 'tabs'
      ? tabs.tabs
          .flatMap((tab) => tab.fields)
          .find((candidate) => 'name' in candidate && candidate.name === 'content')
      : undefined

  if (!field || field.type !== 'richText') throw new Error('Content field was not found.')
  return field
}

function htmlTablesToMarkdown(markdown: string): string {
  return markdown.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_table, tableContent) => {
    const rows = [...tableContent.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map(([, row]) =>
        [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(([, cell]) =>
          cell
            .replace(/<br\s*\/?\s*>/gi, '<br>')
            .replace(/<[^>]+>/g, '')
            .replace(/\|/g, '\\|')
            .trim(),
        ),
      )
      .filter((row) => row.length > 0)

    if (rows.length === 0) return ''

    const header = rows[0]
    const divider = header.map(() => '---')
    return [
      '| ' + header.join(' | ') + ' |',
      '| ' + divider.join(' | ') + ' |',
      ...rows.slice(1).map((row) => '| ' + row.join(' | ') + ' |'),
    ].join('\n')
  })
}

export const convertMarkdown: Endpoint = {
  path: '/convert-markdown',
  method: 'post',
  handler: async (req) => {
    if (!req.user) throw new APIError('Unauthorized', 401)

    const { collection, markdown } = (await req.json?.()) as {
      collection?: string
      markdown?: string
    }
    if (collection !== 'docs' && collection !== 'blog-posts')
      throw new APIError('Invalid collection.', 400)
    if (!markdown?.trim()) throw new APIError('Markdown is required.', 400)

    const field = contentField(collection === 'docs' ? Docs : BlogPosts)
    const editorConfig = editorConfigFactory.fromField({ field })

    return Response.json({
      content: convertMarkdownToLexical({
        editorConfig,
        markdown: htmlTablesToMarkdown(markdown),
      }),
    })
  },
}
