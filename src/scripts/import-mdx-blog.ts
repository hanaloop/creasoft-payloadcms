import { execFile as execFileCallback } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import 'dotenv/config'
import matter from 'gray-matter'
import { getPayload } from 'payload'
import type { RichTextField } from 'payload'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import { BlogPosts } from '@/collections/BlogPosts'
import type { BlogPost } from '@/payload-types'
import config from '@payload-config'

type Locale = 'en' | 'es' | 'ko'

type MdxAttribute = {
  name?: string
  type: string
  value?: string | { type: string; value?: string } | null
}

type MdxNode = {
  attributes?: MdxAttribute[]
  children?: MdxNode[]
  name?: string | null
  position?: {
    end?: { offset?: number }
    start?: { offset?: number }
  }
  type: string
}

type SourceDocument = {
  absolutePath: string
  locale: Locale
  relativePath: string
}

type LexicalNode = {
  type: string
  version: number
  [key: string]: unknown
}

const args = new Set(process.argv.slice(2))
const execFile = promisify(execFileCallback)
const write = args.has('--write')

const sourceRoot = process.env.HANALOOP_CONTENT_DIR
const selectedLocale = process.env.BLOG_IMPORT_LOCALE
const sourceGitRef = process.env.HANALOOP_GIT_REF

if (!sourceRoot) {
  throw new Error('Set HANALOOP_CONTENT_DIR to the hanaloop.net/content directory.')
}

if (selectedLocale && !['ko', 'en', 'es'].includes(selectedLocale)) {
  throw new Error('BLOG_IMPORT_LOCALE must be one of: ko, en, es.')
}

const resolvedSourceRoot = sourceRoot

async function collectMarkdownFiles(directory: string, locale: Locale): Promise<SourceDocument[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: SourceDocument[] = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(absolutePath, locale)))
      continue
    }

    if (!/\.mdx?$/.test(entry.name)) continue

    files.push({
      absolutePath,
      locale,
      relativePath: path.relative(path.join(resolvedSourceRoot, locale, 'blog'), absolutePath),
    })
  }

  return files
}

async function sourceFileContent(source: SourceDocument): Promise<string | null> {
  const current = await readFile(source.absolutePath, 'utf8')

  if (!matter(current).data.payloadGenerated) {
    return current
  }

  if (!sourceGitRef) {
    return null
  }

  const repositoryRoot = path.dirname(resolvedSourceRoot)
  const repositoryPath = path.relative(repositoryRoot, source.absolutePath).replaceAll('\\', '/')

  try {
    const { stdout } = await execFile('git', [
      '-C',
      repositoryRoot,
      'show',
      `${sourceGitRef}:${repositoryPath}`,
    ])

    return stdout
  } catch {
    // Git ref 이후에 생성된 문서는 현재 생성된 MDX를 복구 소스로 사용한다.
    return current
  }
}

function attributeValue(attribute: MdxAttribute | undefined): boolean | string | undefined {
  if (!attribute) return undefined

  if (attribute.value === null || attribute.value === undefined) {
    return true
  }

  if (typeof attribute.value === 'string') {
    return attribute.value
  }

  const expression = attribute.value.value?.trim()

  if (expression === 'true') return true
  if (expression === 'false') return false

  if (expression?.startsWith('"') || expression?.startsWith("'")) {
    return expression.slice(1, -1)
  }

  return undefined
}

function sourceForNode(source: string, node: MdxNode): string {
  const start = node.position?.start?.offset
  const end = node.position?.end?.offset

  if (start === undefined || end === undefined) {
    return ''
  }

  return source.slice(start, end)
}

function imageBlockNode(fields: Record<string, unknown>): LexicalNode {
  const imageSrc = fields.legacyImageSrc

  if (typeof imageSrc !== 'string' || !imageSrc) {
    throw new Error('Image is missing a static source URL.')
  }

  return {
    type: 'block',
    version: 2,
    fields: {
      blockType: 'CaptionedImage',
      ...fields,
    },
  }
}

function captionedImageNode(node: MdxNode): LexicalNode {
  const attributes = new Map(
    (node.attributes ?? [])
      .filter((attribute): attribute is MdxAttribute & { name: string } => Boolean(attribute.name))
      .map((attribute) => [attribute.name, attributeValue(attribute)]),
  )

  const float = String(attributes.get('float') ?? '')

  return imageBlockNode({
    legacyImageSrc: attributes.get('imageSrc'),
    caption: String(attributes.get('caption') ?? ''),
    isHero: attributes.get('isHero') === true,
    containerClassName: String(attributes.get('containerClassName') ?? ''),
    imageClassName: String(attributes.get('imageClassName') ?? ''),
    float: float.includes('float-left')
      ? 'float-left'
      : float.includes('float-right')
        ? 'float-right'
        : 'none',
  })
}

function htmlImageNode(node: MdxNode): LexicalNode {
  const attributes = new Map(
    (node.attributes ?? [])
      .filter((attribute): attribute is MdxAttribute & { name: string } => Boolean(attribute.name))
      .map((attribute) => [attribute.name, attributeValue(attribute)]),
  )

  return imageBlockNode({
    legacyImageSrc: attributes.get('src'),
    caption: String(attributes.get('alt') ?? ''),
    isHero: false,
    containerClassName: '',
    imageClassName: String(attributes.get('className') ?? attributes.get('class') ?? ''),
    float: 'none',
  })
}

function findElements(node: MdxNode, name: string): MdxNode[] {
  return [
    ...(node.name === name ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findElements(child, name)),
  ]
}

function innerSource(source: string, node: MdxNode): string {
  return sourceForNode(source, node)
    .replace(/^<[^>]+>/, '')
    .replace(/<\/[^>]+>\s*$/, '')
    .trim()
}

function tableCellMarkdown(value: string): string {
  return value
    .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
    .replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
    .replace(/<\/?(?:ol|ul)[^>]*>/gi, '')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '<br />')
    .replaceAll('|', '\\|')
    .replace(/\n+/g, '<br />')
}

function tableRowCells(row: MdxNode): MdxNode[] {
  const cells: MdxNode[] = []

  const visit = (node: MdxNode) => {
    for (const child of node.children ?? []) {
      if (child.name === 'td' || child.name === 'th') {
        cells.push(child)
      } else {
        visit(child)
      }
    }
  }

  visit(row)
  return cells
}

function htmlTableToMarkdown(source: string, table: MdxNode): string {
  const rows = findElements(table, 'tr')
    .map((row) =>
      tableRowCells(row)
        .map((cell) => tableCellMarkdown(innerSource(source, cell))),
    )
    .filter((row) => row.length > 0)

  if (rows.length === 0) {
    return ''
  }

  const columnCount = Math.max(...rows.map((row) => row.length))

  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? ''),
  )

  return [
    `| ${normalizedRows[0].join(' | ')} |`,
    `| ${normalizedRows[0].map(() => '---').join(' | ')} |`,
    ...normalizedRows.slice(1).map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function buttonToMarkdown(source: string, button: MdxNode): string {
  const anchor = sourceForNode(source, button).match(
    /<a\b[^>]*\bhref=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i,
  )

  if (!anchor) {
    throw new Error('button does not contain a static anchor link.')
  }

  const text = anchor[3]
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) {
    throw new Error('button anchor has no text.')
  }

  return `[${text}](${anchor[2]})`
}

function normalizeMarkdown(markdown: string): string {
  const tables: string[] = []
  const protectedTables = markdown.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => {
    const index = tables.push(table) - 1
    return `\n\nPAYLOAD_TABLE_PLACEHOLDER_${index}\n\n`
  })

  return protectedTables
    // Docusaurus truncation markers are HTML comments, which are invalid in
    // MDX v3. They do not carry document content.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    // Legacy CTA markup becomes an ordinary Markdown link before the MDX AST
    // is built. This also avoids treating HTML <button> as a custom component.
    .replace(
      /<button\b[^>]*>\s*<a\b[^>]*\bhref=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>\s*<\/button>/gi,
      (_match, _quote, href, label) => `[${String(label).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()}](${href})`,
    )
    .replace(
      /<a\b[^>]*\bhref=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
      (_match, _quote, href, label) => `[${String(label).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()}](${href})`,
    )
    .replace(/<hr\b[^>]*\/?>/gi, '\n\n---\n\n')
    // Legacy posts use empty 1px divs as visual separators. Preserve their
    // meaning as Markdown thematic breaks instead of dropping them.
    .replace(
      /<div\b[^>]*(?:height\s*:\s*['"]?1px|border-(?:top|bottom))[^>]*>\s*<\/div>/gi,
      '\n\n---\n\n',
    )
    .replace(/^\*\*\s*\*\*$/gm, '\n---\n')
    .replace(/<br\s*\/?\s*>/gi, '  \n')
    .replace(/<\/?(?:div|span)[^>]*>/gi, '')
    .replace(/<p\b[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/?(?:ol|ul)[^>]*>/gi, '')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/PAYLOAD_TABLE_PLACEHOLDER_(\d+)/g, (_match, index) => tables[Number(index)] ?? '')
}

function contentToLexical(
  markdown: string,
  editorConfig: ReturnType<typeof editorConfigFactory.fromField>,
): BlogPost['content'] {
  const normalizedMarkdown = normalizeMarkdown(markdown)

  const tree = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .parse(normalizedMarkdown) as unknown as {
    children: MdxNode[]
  }

  const children: LexicalNode[] = []

  for (const node of tree.children) {
    if (node.type === 'mdxjsEsm') {
      continue
    }

    if (node.type === 'mdxJsxFlowElement' && node.name === 'CaptionedImage') {
      children.push(captionedImageNode(node))
      continue
    }

    if (
      (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
      node.name === 'img'
    ) {
      children.push(htmlImageNode(node))
      continue
    }

    if (node.type === 'mdxJsxFlowElement' && node.name === 'table') {
      const state = convertMarkdownToLexical({
        markdown: htmlTableToMarkdown(normalizedMarkdown, node),
        editorConfig,
      })

      children.push(...(state.root.children as LexicalNode[]))
      continue
    }

    if (node.type === 'mdxJsxFlowElement' && node.name === 'button') {
      const state = convertMarkdownToLexical({
        markdown: buttonToMarkdown(normalizedMarkdown, node),
        editorConfig,
      })

      children.push(...(state.root.children as LexicalNode[]))
      continue
    }

    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxFlowExpression') {
      throw new Error(`Unsupported MDX element: ${node.name ?? node.type}`)
    }

    const fragment = sourceForNode(normalizedMarkdown, node)

    if (!fragment.trim()) {
      continue
    }

    const state = convertMarkdownToLexical({
      markdown: fragment,
      editorConfig,
    })

    children.push(...(state.root.children as LexicalNode[]))
  }

  return {
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as BlogPost['content']
}

function values(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String)
  }

  return typeof value === 'string' && value ? [value] : []
}

async function main() {
  const locales = (selectedLocale ? [selectedLocale] : ['ko', 'en', 'es']) as Locale[]

  const sourceDocuments = (
    await Promise.all(
      locales.map((locale) =>
        collectMarkdownFiles(path.join(resolvedSourceRoot, locale, 'blog'), locale),
      ),
    )
  ).flat()

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

  const editorConfig = editorConfigFactory.fromField({
    field: contentField,
  })

  const payload = write ? await getPayload({ config }) : null

  const report = {
    imported: 0,
    manualReview: [] as Array<{ path: string; reason: string }>,
    ready: 0,
  }

  for (const source of sourceDocuments) {
    try {
      const sourceContent = await sourceFileContent(source)

      if (!sourceContent) {
        continue
      }

      const parsed = matter(sourceContent)
      const slug = path.basename(source.relativePath).replace(/\.mdx?$/, '')

      const sourcePath = `${source.locale}/blog/${source.relativePath.replaceAll('\\', '/')}`

      const data = {
        locale: source.locale,
        _status: 'published' as const,
        title: String(parsed.data.title ?? slug),
        description: parsed.data.description ? String(parsed.data.description) : undefined,
        subtitle: parsed.data.subtitle ? String(parsed.data.subtitle) : undefined,
        summary: parsed.data.summary ? String(parsed.data.summary) : undefined,
        authors: values(parsed.data.authors).map((name) => ({ name })),
        tags: values(parsed.data.tags).map((value) => ({ value })),
        publishedAt: parsed.data.date ?? parsed.data.publishedAt,
        sourceMetadata: Object.fromEntries(
          Object.entries(parsed.data).filter(([key]) => key !== 'payloadGenerated'),
        ),
        slug,
        sourcePath,
        content: contentToLexical(parsed.content, editorConfig),
      }

      report.ready += 1

      if (!payload) {
        continue
      }

      const existing = await payload.find({
        collection: 'blog-posts',
        depth: 0,
        limit: 1,
        where: {
          or: [
            { sourcePath: { equals: sourcePath } },
            {
              and: [
                { locale: { equals: source.locale } },
                { slug: { equals: slug } },
              ],
            },
          ],
        },
      })

      if (existing.docs[0]) {
        await payload.update({
          collection: 'blog-posts',
          id: existing.docs[0].id,
          data,
          overrideAccess: true,
        })
      } else {
        await payload.create({
          collection: 'blog-posts',
          data,
          overrideAccess: true,
        })
      }

      report.imported += 1
    } catch (error) {
      report.manualReview.push({
        path: `${source.locale}/blog/${source.relativePath}`,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: write ? 'write' : 'dry-run',
        ...report,
      },
      null,
      2,
    ),
  )
}

void main()
