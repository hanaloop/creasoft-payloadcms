import { authenticated } from '@/access/authenticated'
import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'
import { Callout } from '@/blocks/docs/Callout'
import { CaptionedImage } from '@/blocks/docs/CaptionedImage'
import { MarkdownPasteFeature } from '@/features/MarkdownPasteFeature/server'
import {
  triggerGitLabPagesDeployAfterChange,
  triggerGitLabPagesDeployAfterDelete,
} from '@/hooks/triggerPagesDeploy'
import {
  BlocksFeature,
  CodeBlock,
  lexicalEditor,
  EXPERIMENTAL_TableFeature,
  UploadFeature,
} from '@payloadcms/richtext-lexical'
import { CollectionConfig } from 'payload'

export const BlogPosts: CollectionConfig<'blog-posts'> = {
  slug: 'blog-posts',

  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        // Preserve imported URLs and deliberate edits. Only fill the slug for
        // a brand-new post whose author has not touched the advanced setting.
        if (!data || data.slug || originalDoc?.slug || !data.title) return data

        data.slug = String(data.title)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9가-힣]+/g, '-')
          .replace(/^-+|-+$/g, '')

        return data
      },
    ],
    afterChange: [triggerGitLabPagesDeployAfterChange],
    afterDelete: [triggerGitLabPagesDeployAfterDelete],
  },

  indexes: [
    {
      fields: ['locale', 'slug'],
      unique: true,
    },
  ],

  access: {
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'locale', 'publishedAt', '_status', 'updatedAt'],
  },

  versions: {
    drafts: true,
    maxPerDoc: 50,
  },

  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: '본문 작성',
          fields: [
            {
              name: 'markdownPaste',
              type: 'ui',
              admin: {
                components: { Field: '@/components/MarkdownPaste' },
                custom: { collection: 'blog-posts' },
              },
            },
            {
              name: 'description',
              type: 'textarea',
              admin: {
                description: '목록과 검색 결과에 표시할 짧은 소개입니다.',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'content',
                  type: 'richText',
                  required: true,
                  admin: {
                    className: 'blog-content-editor',
                    description:
                      '본문을 작성하세요. 이미지와 안내문은 툴바의 블록 메뉴에서 추가할 수 있습니다.',
                    width: '50%',
                  },
                  editor: lexicalEditor({
                    features: ({ defaultFeatures }) => [
                      ...defaultFeatures.filter(({ key }) => key !== 'upload'),
                      UploadFeature({ enabledCollections: ['media'] }),
                      EXPERIMENTAL_TableFeature(),
                      BlocksFeature({ blocks: [CaptionedImage, Callout, CodeBlock()] }),
                      MarkdownPasteFeature({ collection: 'blog-posts' }),
                    ],
                  }),
                },
                {
                  name: 'contentPreview',
                  type: 'ui',
                  admin: {
                    width: '50%',
                    components: {
                      Field: '@/components/AdminContentPreview',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          label: '발행 설정',
          fields: [
            {
              name: 'locale',
              type: 'select',
              required: true,
              index: true,
              options: ['ko', 'en', 'es'],
            },
            {
              name: 'publishedAt',
              type: 'date',
              index: true,
              admin: { date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'authors',
              type: 'array',
              fields: [{ name: 'name', type: 'text', required: true }],
            },
            {
              name: 'tags',
              type: 'array',
              fields: [{ name: 'value', type: 'text', required: true }],
            },
          ],
        },
        {
          label: '고급 설정',
          fields: [
            {
              name: 'slug',
              type: 'text',
              index: true,
              admin: {
                description: 'URL에 사용됩니다. 비워 두면 새 글 생성 시 제목으로 자동 생성됩니다.',
              },
            },
            { name: 'subtitle', type: 'text' },
            { name: 'summary', type: 'textarea' },
          ],
        },
      ],
    },
    {
      name: 'sourceMetadata',
      type: 'json',
      admin: { hidden: true },
    },
    {
      name: 'sourcePath',
      type: 'text',
      unique: true,
      admin: { hidden: true },
    },
  ],
}
