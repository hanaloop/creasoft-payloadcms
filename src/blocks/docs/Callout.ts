import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { Block } from "payload";

export const Callout: Block = {
    slug: 'Callout',
    fields: [
        {
            name: 'type',
            type: 'select',
            required: true,
            defaultValue: 'info',
            options: ['info', 'warning', 'error', 'success'],
        }, {
            name: 'content',
            type: 'richText',
            required: true,
            editor: lexicalEditor(),
        },
    ],
    jsx: {
        export: ({ fields, lexicalToMarkdown }) => ({
            props: {
                type: fields.type,
            },
            children: lexicalToMarkdown({
                editorState: fields.content,
            }),
        }),
        import: ({ props, children, markdownToLexical }) => ({
            type: props.type ?? 'info',
            content: markdownToLexical({
                markdown: children
            })
        })
     }
}