import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterOperationHook,
  CollectionSlug,
  RequestContext,
} from 'payload'

const gitLabApiURL = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4'

// Per-request marker. afterChange/afterDelete run once per document, while
// afterOperation runs once per operation (a bulk publish of N docs is a single
// `update` operation). Documents only record that a deploy is needed; the
// operation hook fires the GitLab pipeline at most once.
const PENDING_KEY = 'pagesDeployPending'

type PendingDeploy = { ids: (number | string)[]; action: 'changed' | 'deleted' }

const markPending = (
  context: RequestContext,
  id: number | string,
  action: PendingDeploy['action'],
) => {
  const pending = (context[PENDING_KEY] as PendingDeploy | undefined) ?? { ids: [], action }
  pending.ids.push(id)
  if (action === 'deleted') pending.action = 'deleted'
  context[PENDING_KEY] = pending
}

async function triggerGitLabPagesDeploy(reason: string) {
  const projectID = process.env.GITLAB_PROJECT_ID
  const token = process.env.GITLAB_TRIGGER_TOKEN

  if (!projectID || !token) {
    console.warn('[pages-deploy] GITLAB_PROJECT_ID or GITLAB_TRIGGER_TOKEN is not set; skipping.')
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

export const triggerGitLabPagesDeployAfterChange: CollectionAfterChangeHook = ({
  context,
  doc,
  previousDoc,
}) => {
  if (context?.skipPagesDeploy) return doc

  const affectsPublishedContent =
    doc._status === 'published' || previousDoc?._status === 'published'

  if (affectsPublishedContent) markPending(context, doc.id, 'changed')

  return doc
}

export const triggerGitLabPagesDeployAfterDelete: CollectionAfterDeleteHook = ({
  context,
  doc,
}) => {
  if (context?.skipPagesDeploy) return doc

  if (doc._status === 'published') markPending(context, doc.id, 'deleted')

  return doc
}

const deployOperations = new Set(['create', 'update', 'updateByID', 'delete', 'deleteByID'])

export const triggerGitLabPagesDeployAfterOperation =
  <TSlug extends CollectionSlug>(): CollectionAfterOperationHook<TSlug> =>
  async ({ collection, operation, req, result }) => {
    if (!deployOperations.has(operation)) return result

    const pending = req.context[PENDING_KEY] as PendingDeploy | undefined
    if (!pending?.ids.length) return result

    // Clear before triggering so a nested operation sharing this req cannot fire twice.
    delete req.context[PENDING_KEY]

    const target = pending.ids.length === 1 ? String(pending.ids[0]) : `bulk:${pending.ids.length}`

    try {
      await triggerGitLabPagesDeploy(`${collection.slug}:${target}:${pending.action}`)
    } catch (error) {
      // Do not roll back the content save because the deploy trigger failed.
      req.payload.logger.error({ err: error, msg: '[pages-deploy] trigger failed' })
    }

    return result
  }
