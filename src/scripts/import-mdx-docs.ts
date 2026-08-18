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
import ts from 'typescript'
import { unified } from 'unified'

import { Docs } from '@/collections/Docs'
import type { Doc } from '@/payload-types'
import config from '@payload-config'

type MdxAttribute = {
  name?: string
  type: string
  value?: string | { type: string; value?: string } | null
}

type MdxNode = {
  attributes?: MdxAttribute[]
  children?: MdxNode[]
  name?: string | null
  position?: { end?: { offset?: number }; start?: { offset?: number } }
  type: string
}

type SourceDocument = {
  absolutePath: string
  locale: 'en' | 'es' | 'ko'
  relativePath: string
}

type GlossaryTerm = {
  description: string
  source?: string
  sourceUrl?: string
  title: string
}

const args = new Set(process.argv.slice(2))
const execFile = promisify(execFileCallback)
const write = args.has('--write')
const sourceRoot = process.env.HANALOOP_CONTENT_DIR
const selectedLocale = process.env.DOCS_IMPORT_LOCALE
const sourceGitRef = process.env.HANALOOP_GIT_REF

if (!sourceRoot) {
  throw new Error('Set HANALOOP_CONTENT_DIR to the hanaloop.net/content directory.')
}

const resolvedSourceRoot = sourceRoot

if (selectedLocale && !['en', 'es', 'ko'].includes(selectedLocale)) {
  throw new Error('DOCS_IMPORT_LOCALE must be one of: ko, en, es.')
}

async function collectMarkdownFiles(directory: string, locale: SourceDocument['locale']): Promise<SourceDocument[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: SourceDocument[] = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(absolutePath, locale)))
      continue
    }

    if (!/\.mdx?$/.test(entry.name) || entry.name.endsWith('.data.mdx')) continue

    files.push({
      absolutePath,
      locale,
      relativePath: path.relative(path.join(resolvedSourceRoot, locale, 'docs'), absolutePath),
    })
  }

  return files
}

async function sourceFileContent(source: SourceDocument): Promise<string | null> {
  const current = await readFile(source.absolutePath, 'utf8')
  if (!matter(current).data.payloadGenerated) return current
  if (!sourceGitRef) return null

  const repositoryRoot = path.dirname(resolvedSourceRoot)
  const repositoryPath = path.relative(repositoryRoot, source.absolutePath).replaceAll('\\', '/')
  try {
    const { stdout } = await execFile('git', ['-C', repositoryRoot, 'show', `${sourceGitRef}:${repositoryPath}`])
    return stdout
  } catch {
    // Documents created after the selected Git ref have no historical source
    // file. Their generated MDX is still a valid recovery source.
    return current
  }
}

function attributeValue(attribute: MdxAttribute | undefined): boolean | string | undefined {
  if (!attribute) return undefined
  if (attribute.value === null || attribute.value === undefined) return true
  if (typeof attribute.value === 'string') return attribute.value

  const expression = attribute.value.value?.trim()
  if (expression === 'true') return true
  if (expression === 'false') return false
  if (expression?.startsWith('"') || expression?.startsWith("'")) {
    return expression.slice(1, -1)
  }

  return undefined
}

function imageBlockNode({
  caption = '',
  containerClassName = '',
  float = 'none',
  imageClassName = '',
  imageSrc,
  isHero = false,
}: {
  caption?: string
  containerClassName?: string
  float?: string
  imageClassName?: string
  imageSrc: string
  isHero?: boolean
}): { type: string; version: number; [key: string]: unknown } {
  if (!imageSrc) throw new Error('Image is missing a static source URL.')

  return {
    type: 'block',
    version: 2,
    fields: {
      blockType: 'CaptionedImage',
      legacyImageSrc: imageSrc,
      caption,
      isHero,
      containerClassName,
      imageClassName,
      float: float.includes('float-left') ? 'float-left' : float.includes('float-right') ? 'float-right' : 'none',
    },
  }
}

function captionedImageNode(node: MdxNode): { type: string; version: number; [key: string]: unknown } {
  const attributes = new Map(
    (node.attributes ?? [])
      .filter((attribute): attribute is MdxAttribute & { name: string } => Boolean(attribute.name))
      .map((attribute) => [attribute.name, attributeValue(attribute)]),
  )
  const legacyImageSrc = attributes.get('imageSrc')

  if (typeof legacyImageSrc !== 'string' || !legacyImageSrc) {
    throw new Error('CaptionedImage is missing a static imageSrc.')
  }

  return imageBlockNode({
    imageSrc: legacyImageSrc,
    caption: String(attributes.get('caption') ?? ''),
    isHero: attributes.get('isHero') === true,
    containerClassName: String(attributes.get('containerClassName') ?? ''),
    imageClassName: String(attributes.get('imageClassName') ?? ''),
    float: String(attributes.get('float') ?? ''),
  })
}

function htmlImageNode(node: MdxNode): { type: string; version: number; [key: string]: unknown } {
  const attributes = new Map(
    (node.attributes ?? [])
      .filter((attribute): attribute is MdxAttribute & { name: string } => Boolean(attribute.name))
      .map((attribute) => [attribute.name, attributeValue(attribute)]),
  )
  const imageSrc = attributes.get('src')

  if (typeof imageSrc !== 'string') throw new Error('img is missing a static src attribute.')

  return imageBlockNode({
    imageSrc,
    caption: String(attributes.get('alt') ?? ''),
    imageClassName: String(attributes.get('className') ?? attributes.get('class') ?? ''),
  })
}

function buttonToMarkdown(source: string, button: MdxNode): string {
  const anchor = sourceForNode(source, button).match(/<a\b[^>]*\bhref=(['\"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i)
  if (!anchor) throw new Error('button does not contain a static anchor link.')

  const text = anchor[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  if (!text) throw new Error('button anchor has no text.')

  return `[${text}](${anchor[2]})`
}

function stringLiteralValue(node: ts.Expression | undefined): string | undefined {
  if (!node) return undefined
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return undefined
}

function glossaryTerms(dataSource: string, variableName: string): GlossaryTerm[] {
  const sourceFile = ts.createSourceFile('glossary.data.tsx', dataSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === variableName)

  if (!declaration?.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) {
    throw new Error(`Glossary data array ${variableName} was not found.`)
  }

  return declaration.initializer.elements.map((element) => {
    if (!ts.isObjectLiteralExpression(element)) throw new Error(`Glossary ${variableName} contains a non-object value.`)

    const fields = new Map<string, string>()
    for (const property of element.properties) {
      if (!ts.isPropertyAssignment(property)) continue
      const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : undefined
      const value = stringLiteralValue(property.initializer)
      if (key && value !== undefined) fields.set(key, value)
    }

    const title = fields.get('title')
    const description = fields.get('description')
    if (!title || !description) throw new Error(`Glossary ${variableName} contains an incomplete term.`)

    return {
      title,
      description,
      ...(fields.get('source') ? { source: fields.get('source') } : {}),
      ...(fields.get('sourceUrl') ? { sourceUrl: fields.get('sourceUrl') } : {}),
    }
  })
}

function tableCell(value: string): string {
  return value.replaceAll('|', '\\|').replace(/\r?\n/g, '<br />')
}

function glossaryTable(terms: GlossaryTerm[]): string {
  const rows = terms
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((term) => {
      const source = term.sourceUrl
        ? `[${term.source ?? 'Source'}](${term.sourceUrl})`
        : term.source ?? ''
      return `| ${tableCell(term.title)} | ${tableCell(term.description)}${source ? `<br />${source}` : ''} |`
    })

  return ['| 용어 | 설명 |', '| --- | --- |', ...rows].join('\n')
}

async function glossaryToMarkdown(source: SourceDocument): Promise<string> {
  const dataPath = source.absolutePath.replace(/\.mdx?$/, '.data.tsx')
  let dataSource: string

  try {
    dataSource = await readFile(dataPath, 'utf8')
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT' || !sourceGitRef) throw error

    const repositoryRoot = path.dirname(resolvedSourceRoot)
    const repositoryPath = path
      .relative(repositoryRoot, dataPath)
      .replaceAll('\\', '/')
    const result = await execFile('git', ['-C', repositoryRoot, 'show', `${sourceGitRef}:${repositoryPath}`])
    dataSource = result.stdout
  }

  return ['## 환경 용어', '', '### 한국어', '', glossaryTable(glossaryTerms(dataSource, 'termsKo_')), '', '### English', '', glossaryTable(glossaryTerms(dataSource, 'termsEn_'))].join('\n')
}

function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<br\s*\/?\s*>/gi, '  \n')
    .replace(/<\/?(?:div|span)[^>]*>/gi, '')
}

function sourceForNode(source: string, node: MdxNode): string {
  const start = node.position?.start?.offset
  const end = node.position?.end?.offset
  if (start === undefined || end === undefined) return ''
  return source.slice(start, end)
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

function htmlTableToMarkdown(source: string, table: MdxNode): string {
  const rows = findElements(table, 'tr')
    .map((row) => (row.children ?? [])
      .filter((cell) => cell.name === 'td' || cell.name === 'th')
      .map((cell) => innerSource(source, cell).replaceAll('|', '\\|').replace(/\n+/g, '<br />')))
    .filter((row) => row.length > 0)

  if (rows.length === 0) return ''

  const columnCount = Math.max(...rows.map((row) => row.length))
  const normalizedRows = rows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ''))
  const header = normalizedRows[0]
  const body = normalizedRows.slice(1)

  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function contentToLexical(markdown: string, editorConfig: ReturnType<typeof editorConfigFactory.fromField>): Doc['content'] {
  const normalizedMarkdown = normalizeMarkdown(markdown)
  const tree = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).parse(normalizedMarkdown) as unknown as { children: MdxNode[] }
  const children: Array<{ type: string; version: number; [key: string]: unknown }> = []

  for (const node of tree.children) {
    if (node.type === 'mdxjsEsm') continue

    if (node.type === 'mdxJsxFlowElement' && node.name === 'CaptionedImage') {
      children.push(captionedImageNode(node))
      continue
    }

    if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'img') {
      children.push(htmlImageNode(node))
      continue
    }

    if (node.type === 'mdxJsxFlowElement' && node.name === 'table') {
      const state = convertMarkdownToLexical({
        markdown: htmlTableToMarkdown(normalizedMarkdown, node),
        editorConfig,
      })
      children.push(...(state.root.children as Array<{ type: string; version: number; [key: string]: unknown }>))
      continue
    }

    if (node.type === 'mdxJsxFlowElement' && node.name === 'button') {
      const state = convertMarkdownToLexical({
        markdown: buttonToMarkdown(normalizedMarkdown, node),
        editorConfig,
      })
      children.push(...(state.root.children as Array<{ type: string; version: number; [key: string]: unknown }>))
      continue
    }

    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxFlowExpression') {
      throw new Error(`Unsupported MDX element: ${node.name ?? node.type}`)
    }

    const fragment = sourceForNode(normalizedMarkdown, node)
    if (!fragment.trim()) continue

    const state = convertMarkdownToLexical({ markdown: fragment, editorConfig })
    children.push(...(state.root.children as Array<{ type: string; version: number; [key: string]: unknown }>))
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
  } as Doc['content']
}

async function main() {
  const locales = (selectedLocale ? [selectedLocale] : ['ko', 'en', 'es']) as SourceDocument['locale'][]
  const sourceDocuments = (await Promise.all(locales.map((locale) => collectMarkdownFiles(path.join(resolvedSourceRoot, locale, 'docs'), locale)))).flat()
  const contentField = Docs.fields.find((field) => 'name' in field && field.name === 'content') as RichTextField
  const editorConfig = editorConfigFactory.fromField({ field: contentField })
  const payload = write ? await getPayload({ config }) : null
  const report = { imported: 0, manualReview: [] as Array<{ path: string; reason: string }>, ready: 0 }

  for (const source of sourceDocuments) {
    try {
      const sourceContent = await sourceFileContent(source)
      if (!sourceContent) continue
      const parsed = matter(sourceContent)
      const slug = path.basename(source.relativePath).replace(/\.mdx?$/, '')
      const sourcePath = `${source.locale}/docs/${source.relativePath.replaceAll('\\', '/')}`
      const markdown = slug === 'glossary' ? await glossaryToMarkdown(source) : parsed.content
      const content = contentToLexical(markdown, editorConfig)
      const data = {
        locale: source.locale,
        _status: 'published' as const,
        title: String(parsed.data.title ?? slug),
        description: parsed.data.description ? String(parsed.data.description) : undefined,
        sourceMetadata: Object.fromEntries(
          Object.entries(parsed.data).filter(([key]) => key !== 'payloadGenerated'),
        ),
        publishedAt: parsed.data.date ?? parsed.data.publishedAt,
        slug,
        sourcePath,
        tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map((value) => ({ value: String(value) })) : [],
        content,
      }

      report.ready += 1
      if (!payload) continue

      const existing = await payload.find({
        collection: 'docs',
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
        await payload.update({ collection: 'docs', id: existing.docs[0].id, data, overrideAccess: true })
      } else {
        await payload.create({ collection: 'docs', data, overrideAccess: true })
      }
      report.imported += 1
    } catch (error) {
      report.manualReview.push({
        path: `${source.locale}/docs/${source.relativePath}`,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  console.log(JSON.stringify({ mode: write ? 'write' : 'dry-run', ...report }, null, 2))
}

void main()
