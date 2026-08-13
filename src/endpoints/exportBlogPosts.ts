import { BlogPosts } from "@/collections/BlogPosts";
import { convertLexicalToMarkdown, editorConfigFactory } from "@payloadcms/richtext-lexical";
import { Endpoint, RichTextField } from "payload";

const tabsField = BlogPosts.fields.find((field) => field.type === 'tabs')

if (!tabsField || tabsField.type !== 'tabs') {
  throw new Error('BlogPosts tabs field was not found.')
}

const contentField = tabsField.tabs
  .flatMap((tab) => tab.fields)
  .find(
    (field): field is RichTextField =>
      'name' in field && field.name === 'content' && field.type === 'richText',
  )

if (!contentField) {
  throw new Error('BlogPosts content field was not found.')
}

export const exportBlogPosts: Endpoint = {
  path: '/blog-export',
  method: 'get',

  handler: async (req) => { 
    const locale = req.query.locale === 'ko' || req.query.locale === 'en' || req.query.locale === 'es' ? req.query.locale : undefined

    const result = await req.payload.find({
      collection: 'blog-posts',
      depth: 1,
      limit: 0,
      sort: '-publishedAt,title',
      req,
      overrideAccess: false,
      where: {
        and: [
          { _status: { equals: 'published' } },
          ...(locale ? [{ locale: {equals: locale }}] : []),
        ]
      }
    })

    const editorConfig = editorConfigFactory.fromField({
      field: contentField
    })

    return Response.json({
      posts: result.docs.map((post) => ({
        slug: post.slug,
        locale: post.locale,
        title: post.title,
        description: post.description,
        subtitle: post.subtitle,
        summary: post.summary,
        authors: post.authors?.map(({ name }) => name),
        tags: post.tags?.map(({ value }) => value),
        publishedAt: post.publishedAt,
        sourcePath: post.sourcePath,
        sourceMetadata: post.sourceMetadata,
        mdx: convertLexicalToMarkdown({
          data: post.content,
          editorConfig,
        })
      }))
    })
  }
}
