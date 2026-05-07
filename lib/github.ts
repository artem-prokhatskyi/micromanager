import { decrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import type { GithubSprintMetrics } from '@/types';

const GITHUB_API_BASE_URL = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const GITHUB_RETRYABLE_STATUSES = new Set([502, 503, 504]);
const GITHUB_MAX_ATTEMPTS = 3;

interface GithubConfig {
  githubApiKey: string;
}

interface GithubPullRequestDetail {
  comments?: number;
  created_at: string;
  draft: boolean;
  merged_at: string | null;
  number: number;
  review_comments?: number;
  updated_at?: string;
  user: {
    login: string;
  } | null;
}

interface GithubPullRequestReview {
  state: string;
  submitted_at: string | null;
  user: {
    login: string;
  } | null;
}

interface GithubTimelineEvent {
  created_at: string;
  event: string;
}

interface GithubMetricsAccumulator {
  approvedPullRequests: number;
  authoredPullRequestsWithComments: number;
  mergedPullRequests: number;
  openedPullRequests: number;
  reviewedPullRequests: number;
  submittedReviews: number;
  totalComments: number;
  totalReviewMs: number;
}

interface GithubRepositoryRef {
  owner: string;
  repo: string;
}

export interface GithubMemberMetricsResult {
  available: boolean;
  metricsByUsername: Map<string, GithubSprintMetrics>;
}

class GithubRequestError extends Error {
  path: string;
  status: number;

  constructor(path: string, status: number) {
    super(`GitHub request failed with status ${status}.`);
    this.name = 'GithubRequestError';
    this.path = path;
    this.status = status;
  }
}

async function getGithubConfig(): Promise<GithubConfig> {
  const settings = await prisma.settings.findFirst({
    select: {
      githubApiKey: true,
    },
  });

  if (!settings?.githubApiKey) {
    throw new Error('GitHub settings are not configured.');
  }

  try {
    return {
      githubApiKey: decrypt(settings.githubApiKey),
    };
  } catch {
    throw new Error('Stored GitHub credentials could not be decrypted.');
  }
}

async function githubFetch<T>(githubApiKey: string, path: string): Promise<T> {
  for (let attempt = 1; attempt <= GITHUB_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubApiKey}`,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
      cache: 'no-store',
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const error = new GithubRequestError(path, response.status);

    if (!isGithubTransientError(error) || attempt === GITHUB_MAX_ATTEMPTS) {
      throw error;
    }

    await delay(attempt * 250);
  }

  throw new GithubRequestError(path, 503);
}

function isGithubNotFoundError(error: unknown): error is GithubRequestError {
  return error instanceof GithubRequestError && error.status === 404;
}

function isGithubTransientError(error: unknown): error is GithubRequestError {
  return error instanceof GithubRequestError && GITHUB_RETRYABLE_STATUSES.has(error.status);
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function logGithubSkip(reason: string, context: Record<string, string | number>): void {
  console.warn(
    JSON.stringify({
      event: 'github_metrics_skipped',
      reason,
      source: 'github',
      ...context,
    }),
  );
}

function normalizeGithubUsername(value: string): string {
  return value.trim().toLowerCase();
}

function parseRepository(value: string): GithubRepositoryRef | null {
  const normalized = value
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  const [owner, repo, ...rest] = normalized.split('/');

  if (!owner || !repo || rest.length > 0) {
    return null;
  }

  return {
    owner,
    repo,
  };
}

function buildPullListPath(repository: GithubRepositoryRef, page: number): string {
  const searchParams = new URLSearchParams({
    direction: 'desc',
    page: String(page),
    per_page: '100',
    sort: 'updated',
    state: 'all',
  });

  return `/repos/${repository.owner}/${repository.repo}/pulls?${searchParams.toString()}`;
}

function isWithinRange(dateValue: string | null | undefined, startMs: number, endMs: number): boolean {
  if (!dateValue) {
    return false;
  }

  const timestamp = new Date(dateValue).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return timestamp >= startMs && timestamp <= endMs;
}

async function listPullRequestsForSprintWithToken(
  githubApiKey: string,
  repository: GithubRepositoryRef,
  sprintStart: Date,
): Promise<GithubPullRequestDetail[]> {
  const items: GithubPullRequestDetail[] = [];
  const sprintStartMs = sprintStart.getTime();

  for (let page = 1; ; page += 1) {
    let response: GithubPullRequestDetail[];

    try {
      response = await githubFetch<GithubPullRequestDetail[]>(githubApiKey, buildPullListPath(repository, page));
    } catch (error) {
      if (isGithubNotFoundError(error)) {
        logGithubSkip('repository_not_found_or_inaccessible', {
          path: error.path,
          repository: `${repository.owner}/${repository.repo}`,
          status: error.status,
        });

        return [];
      }

      if (isGithubTransientError(error)) {
        logGithubSkip('repository_temporarily_unavailable', {
          path: error.path,
          repository: `${repository.owner}/${repository.repo}`,
          status: error.status,
        });

        return [];
      }

      throw error;
    }

    items.push(...response);

    const oldestUpdatedAt = response.at(-1)?.updated_at;
    const oldestUpdatedAtMs = oldestUpdatedAt ? new Date(oldestUpdatedAt).getTime() : Number.NaN;

    if (response.length < 100 || (!Number.isNaN(oldestUpdatedAtMs) && oldestUpdatedAtMs < sprintStartMs)) {
      return items;
    }
  }

  return items;
}

async function getTimelineEventsWithToken(
  githubApiKey: string,
  repository: GithubRepositoryRef,
  pullRequestNumber: number,
): Promise<GithubTimelineEvent[]> {
  const events: GithubTimelineEvent[] = [];

  for (let page = 1; ; page += 1) {
    let pageItems: GithubTimelineEvent[];

    try {
      pageItems = await githubFetch<GithubTimelineEvent[]>(
        githubApiKey,
        `/repos/${repository.owner}/${repository.repo}/issues/${pullRequestNumber}/timeline?per_page=100&page=${page}`,
      );
    } catch (error) {
      if (isGithubNotFoundError(error)) {
        logGithubSkip('timeline_not_found_or_inaccessible', {
          path: error.path,
          pullRequestNumber,
          repository: `${repository.owner}/${repository.repo}`,
          status: error.status,
        });

        return [];
      }

      if (isGithubTransientError(error)) {
        logGithubSkip('timeline_temporarily_unavailable', {
          path: error.path,
          pullRequestNumber,
          repository: `${repository.owner}/${repository.repo}`,
          status: error.status,
        });

        return [];
      }

      throw error;
    }

    events.push(...pageItems);

    if (pageItems.length < 100) {
      return events;
    }
  }

  return events;
}

async function getPullRequestReviewsWithToken(
  githubApiKey: string,
  repository: GithubRepositoryRef,
  pullRequestNumber: number,
): Promise<GithubPullRequestReview[]> {
  const reviews: GithubPullRequestReview[] = [];

  for (let page = 1; ; page += 1) {
    let pageItems: GithubPullRequestReview[];

    try {
      pageItems = await githubFetch<GithubPullRequestReview[]>(
        githubApiKey,
        `/repos/${repository.owner}/${repository.repo}/pulls/${pullRequestNumber}/reviews?per_page=100&page=${page}`,
      );
    } catch (error) {
      if (isGithubNotFoundError(error)) {
        logGithubSkip('reviews_not_found_or_inaccessible', {
          path: error.path,
          pullRequestNumber,
          repository: `${repository.owner}/${repository.repo}`,
          status: error.status,
        });

        return [];
      }

      if (isGithubTransientError(error)) {
        logGithubSkip('reviews_temporarily_unavailable', {
          path: error.path,
          pullRequestNumber,
          repository: `${repository.owner}/${repository.repo}`,
          status: error.status,
        });

        return [];
      }

      throw error;
    }

    reviews.push(...pageItems);

    if (pageItems.length < 100) {
      return reviews;
    }
  }

  return reviews;
}

function calculateReviewDurationMs(
  detail: GithubPullRequestDetail,
  timelineEvents: GithubTimelineEvent[],
  reviews: GithubPullRequestReview[],
): number | null {
  const firstApprovalMs = reviews
    .filter((review) => review.state === 'APPROVED' && review.submitted_at)
    .map((review) => new Date(review.submitted_at as string).getTime())
    .filter((submittedAtMs) => !Number.isNaN(submittedAtMs))
    .sort((left, right) => left - right)[0] ?? null;
  const fallbackEndMs = detail.merged_at ? new Date(detail.merged_at).getTime() : Number.NaN;
  const reviewEndMs = firstApprovalMs ?? fallbackEndMs;

  if (reviewEndMs === null || Number.isNaN(reviewEndMs)) {
    return null;
  }

  const createdAtMs = new Date(detail.created_at).getTime();

  if (Number.isNaN(createdAtMs) || reviewEndMs <= createdAtMs) {
    return null;
  }

  const draftEvents = timelineEvents
    .filter((event) => event.event === 'ready_for_review' || event.event === 'convert_to_draft')
    .map((event) => ({
      createdAtMs: new Date(event.created_at).getTime(),
      event: event.event,
    }))
    .filter((event) => !Number.isNaN(event.createdAtMs) && event.createdAtMs < reviewEndMs)
    .sort((left, right) => left.createdAtMs - right.createdAtMs);

  const startsAsDraft = draftEvents[0]?.event === 'ready_for_review';
  let isDraft = startsAsDraft;
  let segmentStartMs = createdAtMs;
  let reviewDurationMs = 0;

  for (const event of draftEvents) {
    if (!isDraft && event.createdAtMs > segmentStartMs) {
      reviewDurationMs += event.createdAtMs - segmentStartMs;
    }

    isDraft = event.event === 'convert_to_draft';
    segmentStartMs = event.createdAtMs;
  }

  if (!isDraft && reviewEndMs > segmentStartMs) {
    reviewDurationMs += reviewEndMs - segmentStartMs;
  }

  return reviewDurationMs > 0 ? reviewDurationMs : null;
}

function createEmptyAccumulator(): GithubMetricsAccumulator {
  return {
    approvedPullRequests: 0,
    authoredPullRequestsWithComments: 0,
    mergedPullRequests: 0,
    openedPullRequests: 0,
    reviewedPullRequests: 0,
    submittedReviews: 0,
    totalComments: 0,
    totalReviewMs: 0,
  };
}

function toMetrics(accumulator: GithubMetricsAccumulator): GithubSprintMetrics {
  return {
    approvedPullRequests: accumulator.approvedPullRequests,
    averageCommentsPerPullRequest: accumulator.authoredPullRequestsWithComments > 0
      ? accumulator.totalComments / accumulator.authoredPullRequestsWithComments
      : null,
    averageReviewTimeHours: accumulator.reviewedPullRequests > 0
      ? accumulator.totalReviewMs / accumulator.reviewedPullRequests / (1000 * 60 * 60)
      : null,
    mergedPullRequests: accumulator.mergedPullRequests,
    openedPullRequests: accumulator.openedPullRequests,
    submittedReviews: accumulator.submittedReviews,
  };
}

export function createEmptyGithubSprintMetrics(): GithubSprintMetrics {
  return {
    approvedPullRequests: 0,
    averageCommentsPerPullRequest: null,
    averageReviewTimeHours: null,
    mergedPullRequests: 0,
    openedPullRequests: 0,
    submittedReviews: 0,
  };
}

export async function getGithubSprintMetricsByUsername(params: {
  repositories: string[];
  sprintEnd: Date;
  sprintStart: Date;
  usernames: string[];
}): Promise<GithubMemberMetricsResult> {
  const normalizedUsernames = [...new Set(params.usernames.map(normalizeGithubUsername).filter(Boolean))];

  if (normalizedUsernames.length === 0) {
    return {
      available: false,
      metricsByUsername: new Map<string, GithubSprintMetrics>(),
    };
  }

  const repositories = [...new Map(
    params.repositories
      .map(parseRepository)
      .filter((repository): repository is GithubRepositoryRef => repository !== null)
      .map((repository) => [`${repository.owner.toLowerCase()}/${repository.repo.toLowerCase()}`, repository]),
  ).values()];

  if (repositories.length === 0) {
    return {
      available: false,
      metricsByUsername: new Map<string, GithubSprintMetrics>(),
    };
  }

  try {
    const { githubApiKey } = await getGithubConfig();
    const sprintStartMs = params.sprintStart.getTime();
    const sprintEndMs = params.sprintEnd.getTime();

    const metrics = new Map<string, GithubMetricsAccumulator>(
      normalizedUsernames.map((username) => [username, createEmptyAccumulator()]),
    );

    for (const repository of repositories) {
      const sprintPullRequests = await listPullRequestsForSprintWithToken(
        githubApiKey,
        repository,
        params.sprintStart,
      );

      const createdPullRequests = sprintPullRequests.filter((pullRequest) =>
        isWithinRange(pullRequest.created_at, sprintStartMs, sprintEndMs));

      for (const pullRequest of createdPullRequests) {
        const username = pullRequest.user?.login ? normalizeGithubUsername(pullRequest.user.login) : '';
        const accumulator = metrics.get(username);

        if (accumulator) {
          accumulator.openedPullRequests += 1;
          accumulator.authoredPullRequestsWithComments += 1;
          accumulator.totalComments += (pullRequest.comments ?? 0) + (pullRequest.review_comments ?? 0);
        }
      }

      const mergedItems = sprintPullRequests.filter((pullRequest) =>
        isWithinRange(pullRequest.merged_at, sprintStartMs, sprintEndMs));

      const mergedPullRequests = await Promise.all(
        mergedItems.map(async (item) => {
          const [reviews, timeline] = await Promise.all([
            getPullRequestReviewsWithToken(githubApiKey, repository, item.number),
            getTimelineEventsWithToken(githubApiKey, repository, item.number),
          ]);

          return {
            detail: item,
            reviewDurationMs: calculateReviewDurationMs(item, timeline, reviews),
          };
        }),
      );

      for (const pullRequest of mergedPullRequests) {
        const username = pullRequest.detail.user?.login ? normalizeGithubUsername(pullRequest.detail.user.login) : '';
        const accumulator = metrics.get(username);

        if (!accumulator) {
          continue;
        }

        accumulator.mergedPullRequests += 1;

        if (pullRequest.reviewDurationMs !== null) {
          accumulator.reviewedPullRequests += 1;
          accumulator.totalReviewMs += pullRequest.reviewDurationMs;
        }
      }

      const updatedItems = sprintPullRequests.filter((pullRequest) =>
        isWithinRange(pullRequest.updated_at, sprintStartMs, sprintEndMs));

      const reviewsByPullRequest = await Promise.all(
        updatedItems.map(async (item) => ({
          reviews: await getPullRequestReviewsWithToken(githubApiKey, repository, item.number),
        })),
      );

      for (const reviewSet of reviewsByPullRequest) {
        for (const review of reviewSet.reviews) {
          if (!review.submitted_at) {
            continue;
          }

          const submittedAtMs = new Date(review.submitted_at).getTime();

          if (Number.isNaN(submittedAtMs)) {
            continue;
          }

          if (submittedAtMs < params.sprintStart.getTime() || submittedAtMs > params.sprintEnd.getTime()) {
            continue;
          }

          const username = review.user?.login ? normalizeGithubUsername(review.user.login) : '';
          const accumulator = metrics.get(username);

          if (!accumulator) {
            continue;
          }

          accumulator.submittedReviews += 1;

          if (review.state === 'APPROVED') {
            accumulator.approvedPullRequests += 1;
          }
        }
      }
    }

    return {
      available: true,
      metricsByUsername: new Map<string, GithubSprintMetrics>(
        [...metrics.entries()].map(([username, accumulator]) => [username, toMetrics(accumulator)]),
      ),
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        errorMessage: error instanceof Error ? error.message : 'Unknown GitHub request failure.',
        event: 'github_metrics_failed',
        path: error instanceof GithubRequestError ? error.path : undefined,
        status: error instanceof GithubRequestError ? error.status : undefined,
        source: 'github',
      }),
    );

    return {
      available: false,
      metricsByUsername: new Map<string, GithubSprintMetrics>(),
    };
  }
}