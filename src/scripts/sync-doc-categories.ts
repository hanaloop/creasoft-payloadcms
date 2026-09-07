import { readdir } from 'node:fs/promises'
import path from 'node:path'

import 'dotenv/config'
import { getPayload } from 'payload'

import config from '@payload-config'

type Locale = 'en' | 'es' | 'ko'

type SourceDocument = {
  locale: Locale
  relativePath: string
}

type CategoryDefinition = {
  key: string
  locale: Locale
  parentKey?: string
  path: string
  slug: string
  title: string
}

const args = new Set(process.argv.slice(2))
const categoriesOnly = args.has('--categories-only')

const legacyCategoryTitles: Record<string, Record<Locale, string>> = {
  'x20_environment-general': {
    ko: '환경 규제, 공시 관련',
    en: 'Environmental Regulations & Disclosures',
    es: 'Regulaciones ambientales y divulgación',
  },
  'x20_environment-general/EU-regulations': {
    ko: 'EU 규제',
    en: 'EU Regulations',
    es: 'Regulaciones de la UE',
  },
  'x20_environment-general/global-regulations': {
    ko: '글로벌 규제',
    en: 'Global Regulations',
    es: 'Regulaciones globales',
  },
  x30_platform: {
    ko: 'Hana.eco',
    en: 'Hana.eco',
    es: 'Hana.eco',
  },
  x40_engineering: {
    ko: 'Engineering',
    en: 'Engineering',
    es: 'Ingeniería',
  },
  misc: {
    ko: '기타',
    en: 'Miscellaneous',
    es: 'Varios',
  },
}

function categoryTitle(locale: Locale, categoryPath: string): string {
  return (
    legacyCategoryTitles[categoryPath]?.[locale] ?? categoryPath.split('/').at(-1) ?? categoryPath
  )
}

const sourceRoot = process.env.HANALOOP_CONTENT_DIR

if (!sourceRoot) {
  throw new Error('Set HANALOOP_CONTENT_DIR to the hanaloop.net/content directory.')
}

const resolvedSourceRoot = sourceRoot

async function collectMarkdownFiles(directory: string, locale: Locale): Promise<SourceDocument[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: SourceDocument[] = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      const nestedFiles = await collectMarkdownFiles(absolutePath, locale)
      files.push(
        ...nestedFiles.map((file) => ({
          ...file,
          relativePath: path.join(entry.name, file.relativePath),
        })),
      )
      continue
    }

    if (/\.mdx?$/.test(entry.name)) {
      files.push({ locale, relativePath: entry.name })
    }
  }

  return files
}

function categoryDefinitions(sourceDocuments: SourceDocument[]): CategoryDefinition[] {
  const categories = new Map<string, CategoryDefinition>()

  for (const source of sourceDocuments) {
    const directories = path
      .dirname(source.relativePath)
      .split(path.sep)
      .filter((segment) => segment !== '.')

    for (let index = 0; index < directories.length; index += 1) {
      const categoryPath = directories.slice(0, index + 1).join('/')
      const key = `${source.locale}/${categoryPath}`

      if (categories.has(key)) continue

      const parentPath = directories.slice(0, index).join('/')
      categories.set(key, {
        key,
        locale: source.locale,
        parentKey: parentPath ? `${source.locale}/${parentPath}` : undefined,
        path: categoryPath,
        slug: directories[index],
        title: categoryTitle(source.locale, categoryPath),
      })
    }
  }

  return [...categories.values()].sort(
    (left, right) => left.path.split('/').length - right.path.split('/').length,
  )
}

async function main() {
  const locales: Locale[] = ['ko', 'en', 'es']
  const sourceDocuments = (
    await Promise.all(
      locales.map((locale) =>
        collectMarkdownFiles(path.join(resolvedSourceRoot, locale, 'docs'), locale),
      ),
    )
  ).flat()
  const categories = categoryDefinitions(sourceDocuments)
  const payload = await getPayload({ config })

  const existingDocs = await payload.find({
    collection: 'docs',
    depth: 0,
    limit: 0,
    overrideAccess: true,
  })
  const docsBySourcePath = new Map(
    existingDocs.docs.filter((doc) => doc.sourcePath).map((doc) => [doc.sourcePath as string, doc]),
  )
  const categoryIDs = new Map<string, number>()

  let categoriesCreated = 0
  let categoriesUpdated = 0
  let documentsUpdated = 0
  const missingDocuments: string[] = []

  for (const category of categories) {
    const existing = await payload.find({
      collection: 'doc-categories',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        and: [{ locale: { equals: category.locale } }, { slug: { equals: category.slug } }],
      },
    })
    const parent = category.parentKey ? categoryIDs.get(category.parentKey) : undefined
    const existingCategory = existing.docs[0]

    if (existingCategory) {
      const existingParent =
        typeof existingCategory.parent === 'object' && existingCategory.parent !== null
          ? Number(existingCategory.parent.id)
          : existingCategory.parent

      if (existingCategory.title !== category.title || existingParent !== parent) {
        await payload.update({
          collection: 'doc-categories',
          id: existingCategory.id,
          data: {
            parent,
            title: category.title,
          },
          overrideAccess: true,
        })
        categoriesUpdated += 1
      }

      categoryIDs.set(category.key, Number(existingCategory.id))
      continue
    }

    const created = await payload.create({
      collection: 'doc-categories',
      data: {
        locale: category.locale,
        parent,
        slug: category.slug,
        title: category.title,
      },
      overrideAccess: true,
    })
    categoryIDs.set(category.key, Number(created.id))
    categoriesCreated += 1
  }

  if (!categoriesOnly) {
    for (const source of sourceDocuments) {
      const sourcePath = `${source.locale}/docs/${source.relativePath.replaceAll('\\', '/')}`
      const document = docsBySourcePath.get(sourcePath)

      if (!document) {
        missingDocuments.push(sourcePath)
        continue
      }

      const directory = path.dirname(source.relativePath).replaceAll('\\', '/')
      const categoryID = categoryIDs.get(`${source.locale}/${directory}`)

      if (!categoryID || document.parent === categoryID) continue

      await payload.update({
        collection: 'docs',
        id: document.id,
        data: { parent: categoryID },
        context: { skipPagesDeploy: true },
        overrideAccess: true,
      })
      documentsUpdated += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        categoriesCreated,
        categoriesFound: categories.length,
        categoriesUpdated,
        documentsFound: sourceDocuments.length - missingDocuments.length,
        documentsUpdated,
        missingDocuments,
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
