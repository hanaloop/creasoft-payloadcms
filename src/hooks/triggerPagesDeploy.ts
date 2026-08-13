import { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

const owner = 'hanaloop'
const repo = 'hanaloop.net'
const workflow = 'deploy-gh-pages.yml'

async function triggerPagesDeploy(reason: string) {
  const token = process.env.GITHUB_PAGES_DEPLOY_TOKEN

  if (!token) {
    console.error('[pages-deploy] GITHUB_PAGES_DEPLOY_TOKEN is not set; skipping.')
    return
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorizaiton: `Bearer ${token}`,
        'X-GITHUB-api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: process.env.GITHUB_PAGES_DEPLOY_REF || 'published',
        inputs: {
          reason,
        },
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      `[pages-deploy] Github workflow dispatch failed: ${response.status} ${await response.text()},`,
    )
  }
}

export const triggerPagesDeplotAfterChange: CollectionAfterChangeHook = async ({
  collection,
  doc,
  previousDoc,
}) => {
  const affectsPublishedContent =
    doc._status === 'published' || previousDoc?._status === 'published'

  if (affectsPublishedContent) {
    await triggerPagesDeploy(`${collection.slug}: ${doc.id}:changed`)
  }

  return doc
}

export const triggerPagesDeployAfterDelete: CollectionAfterDeleteHook = async ({
  collection,
  doc,
}) => {
  await triggerPagesDeploy(`${collection.slug}: ${doc.id}:deleted`)
  return doc
}
