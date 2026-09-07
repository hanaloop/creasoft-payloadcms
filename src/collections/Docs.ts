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
import { type CollectionConfig } from 'payload'

export const Docs: CollectionConfig<'docs'> = {
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        // Preserve imported URLs and deliberate edits. Only fill the slug for
        // a brand-new document whose author has not touched the advanced setting.
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
    defaultColumns: ['title', 'parent', 'order', 'locale', '_status', 'updatedAt'],
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
                custom: { collection: 'docs' },
              },
            },
            {
              name: 'description',
              type: 'textarea',
              admin: {
                description: '문서 목록과 검색 결과에 표시할 짧은 소개입니다.',
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
                    className: 'docs-content-editor',
                    description:
                      '문서를 작성하세요. 이미지와 안내문은 툴바의 블록 메뉴에서 추가할 수 있습니다.',
                    width: '50%',
                  },
                  editor: lexicalEditor({
                    features: ({ defaultFeatures }) => [
                      ...defaultFeatures.filter(({ key }) => key !== 'upload'),
                      UploadFeature({ enabledCollections: ['media'] }),
                      EXPERIMENTAL_TableFeature(),
                      BlocksFeature({ blocks: [CaptionedImage, Callout, CodeBlock()] }),
                      MarkdownPasteFeature({ collection: 'docs' }),
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
              admin: { date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'parent',
              type: 'relationship',
              relationTo: 'doc-categories',
              index: true,
              label: '카테고리 (상위 폴더)',
              filterOptions: ({ siblingData }) => {
                const locale =
                  typeof siblingData === 'object' &&
                  siblingData !== null &&
                  'locale' in siblingData &&
                  typeof siblingData.locale === 'string'
                    ? siblingData.locale
                    : undefined

                if (!locale) return false

                return {
                  locale: {
                    equals: locale,
                  },
                }
              },
              admin: {
                allowCreate: true,
                allowEdit: true,
                description:
                  '이 문서를 넣을 기존 폴더를 선택하세요. 새 카테고리(폴더)가 필요하면 선택창의 생성 버튼을 사용하세요.',
                placeholder: '카테고리를 선택하거나 새로 만드세요',
              },
            },
            {
              name: 'order',
              type: 'number',
              defaultValue: 0,
              index: true,
              admin: {
                description:
                  '같은 상위 문서 안에서 표시할 순서입니다. 숫자가 작을수록 먼저 표시됩니다.',
              },
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
              required: true,
              index: true,
              admin: {
                description:
                  'Fumadocs URL 및 생성 파일명에 사용됩니다. 비워 두면 새 문서 생성 시 제목으로 자동 생성됩니다.',
              },
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
          ],
        },
      ],
    },
  ],
}
