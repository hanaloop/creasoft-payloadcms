import { authenticated } from '@/access/authenticated'
import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'
import { Callout } from '@/blocks/docs/Callout'
import { CaptionedImage } from '@/blocks/docs/CaptionedImage'
import { triggerPagesDeplotAfterChange, triggerPagesDeployAfterDelete } from '@/hooks/triggerPagesDeploy'
import {
  BlocksFeature,
  lexicalEditor,
  EXPERIMENTAL_TableFeature,
} from '@payloadcms/richtext-lexical'
import { type CollectionConfig } from 'payload'

export const Docs: CollectionConfig<'docs'> = {
  hooks: {
    afterChange: [triggerPagesDeplotAfterChange],
    afterDelete: [triggerPagesDeployAfterDelete]
  },
  slug: 'docs',
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
    defaultColumns: ['title', 'locale', '_status', 'updatedAt'],
  },

  versions: {
    drafts: true,
    maxPerDoc: 50,
  },

  fields: [
    {
      name: 'locale',
      type: 'select',
      required: true,
      index: true,
      options: ['ko', 'en', 'es'],
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'sourceMetadata',
      type: 'json',
      admin: {
        readOnly: true,
        description:
          '기존 MDX frontmatter를 보존합니다. 빌드 시 다시 MDX frontmatter로 내보냅니다.',
      },
    },
    {
      name: 'sourcePath',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: '기존 MDX 원본 경로. 마이그레이션 추적용 필드입니다.',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'docs',
      index: true,
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      index: true,
    },
    {
      name: 'tags',
      type: 'array',
      fields: [{ name: 'value', type: 'text', required: true }],
    },
    {
      name: 'publishedAt',
      type: 'date',
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      admin: {
        className: 'docs-content-editor',
        description:
          '문서를 작성하세요. 이미지와 안내문은 툴바의 블록 메뉴에서 추가할 수 있습니다.',
      },
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          EXPERIMENTAL_TableFeature(),
          BlocksFeature({
            blocks: [CaptionedImage, Callout],
          }),
        ],
      }),
    },
    {
      name: 'contentPreview',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/AdminContentPreview',
        },
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Fumadocs URL 및 생성 파일명에 사용하는 고유 slug입니다.',
      },
    },
  ],
}
