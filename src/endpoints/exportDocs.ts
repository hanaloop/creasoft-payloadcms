import { Docs } from '@/collections/Docs'
import { normalizeMarkdownForMdx } from '@/utilities/normalizeMarkdownForMdx'
import { convertLexicalToMarkdown, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { Endpoint, RichTextField } from 'payload'

const tabsField = Docs.fields.find((field) => field.type === 'tabs')

if (!tabsField || tabsField.type !== 'tabs') {
  throw new Error('Docs tabs field was not found.')
}

const contentField = tabsField.tabs
  .flatMap((tab) => tab.fields)
  .flatMap((field) => (field.type === 'row' ? field.fields : [field]))
  .find(
    (field): field is RichTextField =>
      'name' in field && field.name === 'content' && field.type === 'richText',
  )

if (!contentField) {
  throw new Error('Docs content field was not found.')
}

type CategoryHierarchyItem = {
  slug: string
  title: string
}

function categoryHierarchy(category: unknown): CategoryHierarchyItem[] {
  if (!category || typeof category !== 'object' || !('slug' in category)) return []

  const record = category as { parent?: unknown; slug?: unknown; title?: unknown }
  if (typeof record.slug !== 'string' || typeof record.title !== 'string') return []

  return [
    ...categoryHierarchy(record.parent),
    {
      slug: record.slug,
      title: record.title,
    },
  ]
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
      depth: 10,
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
    const docs = result.docs.map((doc) => {
      const hierarchy = categoryHierarchy(doc.parent)

      return {
        slug: doc.slug,
        locale: doc.locale,
        title: doc.title,
        description: doc.description,
        sourcePath: doc.sourcePath,
        sourceMetadata: doc.sourceMetadata,
        tags: doc.tags?.map(({ value }) => value),
        parent: doc.parent && typeof doc.parent === 'object' ? doc.parent.slug : null,
        parentPath: hierarchy.map(({ slug }) => slug),
        parentTitles: hierarchy.map(({ title }) => title),
        publishedAt: doc.publishedAt,
        mdx: normalizeMarkdownForMdx(
          convertLexicalToMarkdown({
            data: doc.content,
            editorConfig,
          }),
        ),
      }
    })

    return Response.json({ docs })
  },
}
