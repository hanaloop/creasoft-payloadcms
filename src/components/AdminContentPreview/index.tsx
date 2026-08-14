'use client'

import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import { useFormFields, usePayloadAPI } from '@payloadcms/ui'

import './index.scss'

type FormFieldValue = {
  value?: unknown
}

type PreviewBlockFields = {
  blockType?: string
  caption?: string
  content?: DefaultTypedEditorState
  image?:
    | { id?: number | string; url?: string; value?: { id?: number | string; url?: string } | number | string }
    | number
    | string
  legacyImageSrc?: string
  type?: 'error' | 'info' | 'success' | 'warning'
}

function isEditorState(value: unknown): value is DefaultTypedEditorState {
  return Boolean(value && typeof value === 'object' && 'root' in value)
}

function getImageURL(image: PreviewBlockFields['image']): string | undefined {
  if (image && typeof image === 'object') {
    if (image.url) return image.url
    return getImageURL(image.value)
  }
  return typeof image === 'string' && image.startsWith('http') ? image : undefined
}

function getMediaID(image: PreviewBlockFields['image']): number | string | undefined {
  if (image && typeof image === 'object') return image.id || getMediaID(image.value)
  if (typeof image === 'number') return image
  if (typeof image === 'string' && /^\d+$/.test(image)) return image
  return undefined
}

function CaptionedImagePreview({ fields }: { fields: PreviewBlockFields }) {
  const initialURL = getImageURL(fields.image) || fields.legacyImageSrc
  const mediaID = getMediaID(fields.image)
  const [{ data }] = usePayloadAPI(mediaID ? `/api/media/${mediaID}` : '', {
    initialData: initialURL ? { url: initialURL } : undefined,
  })
  const imageURL = data?.url || initialURL

  return (
    <figure className="admin-content-preview__image">
      {imageURL ? (
        <img alt={fields.caption ?? ''} src={imageURL} />
      ) : (
        <div className="admin-content-preview__image-placeholder">이미지를 선택하세요.</div>
      )}
      {fields.caption ? <figcaption>{fields.caption}</figcaption> : null}
    </figure>
  )
}

const previewConverters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  blocks: {
    Callout: ({ node }: { node: { fields: PreviewBlockFields } }) => {
      const fields = node.fields as PreviewBlockFields
      const tone = fields.type ?? 'info'

      return (
        <aside className={`admin-content-preview__callout admin-content-preview__callout--${tone}`}>
          <strong>{tone}</strong>
          {isEditorState(fields.content) ? (
            <RichText
              data={fields.content}
              converters={previewConverters}
              disableContainer
            />
          ) : null}
        </aside>
      )
    },
    CaptionedImage: ({ node }: { node: { fields: PreviewBlockFields } }) => {
      const fields = node.fields as PreviewBlockFields
      return <CaptionedImagePreview fields={fields} />
    },
  },
})

export default function AdminContentPreview() {
  const title = useFormFields(
    ([fields]) => (fields.title as FormFieldValue | undefined)?.value,
  )
  const content = useFormFields(
    ([fields]) => (fields.content as FormFieldValue | undefined)?.value,
  )

  return (
    <section className="admin-content-preview">
      <div className="admin-content-preview__toolbar">
        <div>
          <p className="admin-content-preview__eyebrow">저장 전 미리보기</p>
          <h2>{typeof title === 'string' && title ? title : '제목 없는 문서'}</h2>
        </div>
        <span>본문을 수정하면 바로 반영됩니다.</span>
      </div>

      <div className="admin-content-preview__body">
        {isEditorState(content) ? (
          <RichText data={content} converters={previewConverters} disableContainer />
        ) : (
          <p className="admin-content-preview__empty">본문을 작성하면 여기에 표시됩니다.</p>
        )}
      </div>
    </section>
  )
}
