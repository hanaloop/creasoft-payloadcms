import { authenticated } from '@/access/authenticated'
import { anyone } from '@/access/anyone'
import type { CollectionConfig } from 'payload'

export const DocCategories: CollectionConfig = {
  slug: 'doc-categories',
  labels: {
    plural: 'Docs 카테고리',
    singular: 'Docs 카테고리',
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data || data.slug || originalDoc?.slug || !data.title) return data

        data.slug = String(data.title)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9가-힣]+/g, '-')
          .replace(/^-+|-+$/g, '')

        return data
      },
    ],
  },
  indexes: [
    {
      fields: ['locale', 'slug'],
      unique: true,
    },
  ],
  access: {
    create: authenticated,
    delete: authenticated,
    // Published Docs are exported without an admin session. Their category
    // hierarchy must therefore be readable to build the public navigation.
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'parent', 'locale', 'updatedAt'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'locale',
      type: 'select',
      required: true,
      index: true,
      options: ['ko', 'en', 'es'],
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'doc-categories',
      index: true,
      label: '상위 카테고리',
      admin: {
        allowCreate: true,
        allowEdit: true,
        description: '필요하면 카테고리를 여러 단계로 구성할 수 있습니다.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'URL 및 생성 경로에 사용됩니다. 비워 두면 제목에서 자동 생성됩니다.',
      },
    },
  ],
}
