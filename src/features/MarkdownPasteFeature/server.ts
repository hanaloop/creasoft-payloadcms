import { createServerFeature } from '@payloadcms/richtext-lexical'

type MarkdownPasteFeatureProps = {
  collection: 'blog-posts' | 'docs'
}

export const MarkdownPasteFeature = createServerFeature<MarkdownPasteFeatureProps>({
  key: 'markdownPaste',
  feature: {
    ClientFeature: '@/features/MarkdownPasteFeature/client#MarkdownPasteFeatureClient',
  },
})
