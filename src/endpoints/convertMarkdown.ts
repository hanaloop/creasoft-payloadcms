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

    return Response.json({ content: convertMarkdownToLexical({ editorConfig, markdown }) })
  },
}
