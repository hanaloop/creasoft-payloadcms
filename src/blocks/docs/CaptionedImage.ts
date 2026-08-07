import type { Block } from "payload";

export const CaptionedImage: Block = {
    slug: 'CaptionedImage',
    fields: [
        {
            name: 'image',
            type: 'upload',
            relationTo: 'media',
        },
        {
            name: 'legacyImageSrc',
            type: 'text',
            admin: {
                description: '기존 MDX에서 이관한 이미지 URL입니다. Media 업로드 전까지 사용됩니다.',
            },
        },
        {
            name: 'caption',
            type: 'text'
        },
        {
            name: 'isHero',
            type: 'checkbox',
            defaultValue: false,
        }, {
            name: 'containerClassName',
            type: 'text'
        }, {
            name: 'imageClassName',
            type: 'text'
        }, {
            name: 'float',
            type: 'select',
            options: [
                { label: '없음', value: 'none' },
                { label: '오른쪽', value: 'float-right' },
                { label: '왼쪽', value: 'float-left' },
            ],
            defaultValue: 'none'
        }
    ],
    jsx: {
        export: ({ fields }) => { 
            const media = fields.image as { url?: string } | undefined
            
            const imageSrc = media?.url ?? fields.legacyImageSrc

            if (!imageSrc) {
                throw new Error('CaptionedImage requires a Media document or a legacy image URL.')
            }
            return {
                props: {
                    imageSrc,
                    caption: fields.caption ?? '',
                    isHero: fields.isHero ?? false,
                    containerClassName: fields.containerClassName ?? '',
                    imageClassName: fields.imageClassName ?? '',
                    float: fields.float === 'none' ? undefined : fields.float,
                },
            }
        },
        import: () => false
    }
}
