import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

const gitLabApiURL = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4'

async function triggerGitLabPagesDeploy(reason: string) {
  const projectID = process.env.GITLAB_PROJECT_ID
  const token = process.env.GITLAB_TRIGGER_TOKEN

  if (!projectID || !token) {
    console.warn(
      '[pages-deploy] GITLAB_PROJECT_ID or GITLAB_TRIGGER_TOKEN is not set; skipping.',
    )
    return
  }

  const response = await fetch(
    `${gitLabApiURL}/projects/${encodeURIComponent(projectID)}/trigger/pipeline`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token,
        ref: process.env.GITLAB_DEPLOY_REF || 'main',
        'variables[PAYLOAD_DEPLOY_REASON]': reason,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      `[pages-deploy] GitLab pipeline trigger failed: ${response.status} ${await response.text()}`,
    )
  }
}

export const triggerGitLabPagesDeployAfterChange: CollectionAfterChangeHook = async ({
  collection,
  doc,
  previousDoc,
}) => {
  const affectsPublishedContent =
    doc._status === 'published' || previousDoc?._status === 'published'

  if (affectsPublishedContent) {
    await triggerGitLabPagesDeploy(`${collection.slug}:${doc.id}:changed`)
  }

  return doc
}

export const triggerGitLabPagesDeployAfterDelete: CollectionAfterDeleteHook = async ({
  collection,
  doc,
}) => {
  if (doc._status === 'published') {
    await triggerGitLabPagesDeploy(`${collection.slug}:${doc.id}:deleted`)
  }
  return doc
}
