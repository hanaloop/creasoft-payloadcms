import { Docs } from '@/collections/Docs'
import { convertLexicalToMarkdown, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { Endpoint, RichTextField } from 'payload'

const tabsField = Docs.fields.find((field) => field.type === 'tabs')

if (!tabsField || tabsField.type !== 'tabs') {
  throw new Error('Docs tabs field was not found.')
}

const contentField = tabsField.tabs
  .flatMap((tab) => tab.fields)
  .find(
    (field): field is RichTextField =>
      'name' in field && field.name === 'content' && field.type === 'richText',
  )

if (!contentField) {
  throw new Error('Docs content field was not found.')
}

export const exportDocs: Endpoint = {
  path: '/docs-export',
  method: 'get',

  handler: async (req) => {
    const localeValue = req.query.locale
    const locale =
      localeValue === 'ko' || localeValue === 'en' || localeValue === 'es' ? localeValue : undefined

    const result = await req.payload.find({
      collection: 'docs',
      depth: 1,
      limit: 0,
      sort: 'parent,order,title',
      req,
      overrideAccess: false,
      where: {
        and: [
          { _status: { equals: 'published' } },
          ...(locale ? [{ locale: { equals: locale } }] : []),
        ],
      },
    })

    const editorConfig = editorConfigFactory.fromField({
      field: contentField,
    })
    const docs = result.docs.map((doc) => ({
      slug: doc.slug,
      locale: doc.locale,
      title: doc.title,
      description: doc.description,
      sourcePath: doc.sourcePath,
      sourceMetadata: doc.sourceMetadata,
      tags: doc.tags?.map(({ value }) => value),
      parent: doc.parent && typeof doc.parent === 'object' ? doc.parent.slug : null,
      mdx: convertLexicalToMarkdown({
        data: doc.content,
        editorConfig,
      }),
    }))

    return Response.json({ docs })
  },
}
