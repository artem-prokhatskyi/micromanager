import { decrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import type {
  JiraConnectionResult,
  JiraIssue,
  JiraSprintMetadata,
} from '@/types';

const JIRA_API_BASE_PATH = '/rest/api/3';
const JIRA_AGILE_BASE_PATH = '/rest/agile/1.0';

const JIRA_ERROR_MESSAGES: Record<number, string> = {
  400: 'Jira rejected the request. Check the team Jira space and your Jira configuration.',
  401: 'Invalid Jira credentials. Please check your API key in Settings.',
  403: 'Jira access denied. Ensure your account has the required permissions.',
  404: 'Resource not found in Jira.',
  429: 'Jira rate limit reached. Please wait a moment and try again.',
};

interface JiraConfig {
  jiraDomain: string;
  jiraEmail: string;
  jiraApiKey: string;
  storyPointsFieldId: string;
}

interface JiraBoardSearchResponse {
  values: Array<{
    id: number;
    type: 'scrum' | 'kanban';
  }>;
}

interface JiraBoardConfigurationResponse {
  id: number;
  location?: {
    projectKeyOrId?: string;
    type?: 'project' | 'user';
  };
}

interface JiraSprintSearchResponse {
  values: JiraSprintMetadata[];
  isLast?: boolean;
  maxResults?: number;
  startAt?: number;
}

interface JiraSprintResponse extends JiraSprintMetadata {}

interface JiraIssueSearchResult extends Pick<JiraIssue, 'key' | 'fields'> {}

interface JiraAgileIssueSearchResponse {
  issues: JiraIssue[];
  maxResults?: number;
  startAt?: number;
  total?: number;
}

interface JiraIssueSearchResponse {
  isLast?: boolean;
  issues: JiraIssueSearchResult[];
  maxResults?: number;
  nextPageToken?: string;
  total?: number;
}

interface JiraRequestLogContext {
  basePath: string;
  durationMs?: number;
  errorMessage?: string;
  jiraDomain?: string;
  method: 'GET' | 'POST';
  path: string;
  requestId: string;
  status?: number;
}

interface JiraAuthLogContext {
  durationMs?: number;
  errorMessage?: string;
  requestId: string;
}

export class JiraRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'JiraRequestError';
    this.status = status;
  }
}

function getJiraErrorMessage(status: number): string {
  if (status >= 500) {
    return 'Jira is currently unavailable.';
  }

  return JIRA_ERROR_MESSAGES[status] ?? 'Jira is currently unavailable.';
}

function logJiraRequest(
  event: 'jira_request_started' | 'jira_request_succeeded' | 'jira_request_failed',
  context: JiraRequestLogContext,
): void {
  const logEntry = {
    event,
    source: 'jira',
    ...context,
  };

  const serializedLogEntry = JSON.stringify(logEntry);

  if (event === 'jira_request_failed') {
    console.error(serializedLogEntry);
    return;
  }

  console.info(serializedLogEntry);
}

function logJiraAuth(
  event: 'jira_auth_started' | 'jira_auth_validation_succeeded' | 'jira_auth_validation_failed',
  context: JiraAuthLogContext,
): void {
  const serializedLogEntry = JSON.stringify({
    event,
    source: 'jira',
    ...context,
  });

  if (event === 'jira_auth_validation_failed') {
    console.error(serializedLogEntry);
    return;
  }

  console.info(serializedLogEntry);
}

async function getJiraConfig(): Promise<JiraConfig> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const settings = await prisma.settings.findFirst({
    select: {
      jiraDomain: true,
      jiraEmail: true,
      jiraApiKey: true,
      storyPointsFieldId: true,
    },
  });

  if (!settings || !settings.jiraDomain || !settings.jiraEmail || !settings.jiraApiKey) {
    throw new JiraRequestError('Jira settings are not configured. Open Settings and save valid Jira credentials.');
  }

  try {
    const config = {
      jiraDomain: settings.jiraDomain,
      jiraEmail: settings.jiraEmail,
      jiraApiKey: decrypt(settings.jiraApiKey),
      storyPointsFieldId: settings.storyPointsFieldId || 'story_points',
    };

    return config;
  } catch {
    throw new JiraRequestError('Stored Jira credentials could not be decrypted. Update the Jira API key in Settings.');
  }
}

async function jiraFetch<T>(path: string, basePath: string = JIRA_API_BASE_PATH): Promise<T> {
  const { jiraApiKey, jiraDomain, jiraEmail } = await getJiraConfig();
  const credentials = Buffer.from(`${jiraEmail}:${jiraApiKey}`).toString('base64');
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  logJiraRequest('jira_request_started', {
    requestId,
    method: 'GET',
    jiraDomain,
    basePath,
    path,
  });

  try {
    const response = await fetch(`https://${jiraDomain}${basePath}${path}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      logJiraRequest('jira_request_failed', {
        requestId,
        method: 'GET',
        jiraDomain,
        basePath,
        path,
        status: response.status,
        durationMs: Date.now() - startedAt,
        errorMessage: getJiraErrorMessage(response.status),
      });

      throw new JiraRequestError(getJiraErrorMessage(response.status), response.status);
    }

    logJiraRequest('jira_request_succeeded', {
      requestId,
      method: 'GET',
      jiraDomain,
      basePath,
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof JiraRequestError) {
      throw error;
    }

    logJiraRequest('jira_request_failed', {
      requestId,
      method: 'GET',
      jiraDomain,
      basePath,
      path,
      durationMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : 'Unknown Jira request failure.',
    });

    throw new JiraRequestError('Cannot reach Jira. Check your network connection.');
  }
}

async function jiraPost<T>(
  path: string,
  body: Record<string, unknown>,
  basePath: string = JIRA_API_BASE_PATH,
): Promise<T> {
  const { jiraApiKey, jiraDomain, jiraEmail } = await getJiraConfig();
  const credentials = Buffer.from(`${jiraEmail}:${jiraApiKey}`).toString('base64');
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  logJiraRequest('jira_request_started', {
    requestId,
    method: 'POST',
    jiraDomain,
    basePath,
    path,
  });

  try {
    const response = await fetch(`https://${jiraDomain}${basePath}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      const responseText = await response.text();
      const jiraErrorMessage = getDetailedJiraPostErrorMessage(response.status, responseText);

      logJiraRequest('jira_request_failed', {
        requestId,
        method: 'POST',
        jiraDomain,
        basePath,
        path,
        status: response.status,
        durationMs: Date.now() - startedAt,
        errorMessage: jiraErrorMessage,
      });

      throw new JiraRequestError(jiraErrorMessage, response.status);
    }

    logJiraRequest('jira_request_succeeded', {
      requestId,
      method: 'POST',
      jiraDomain,
      basePath,
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof JiraRequestError) {
      throw error;
    }

    logJiraRequest('jira_request_failed', {
      requestId,
      method: 'POST',
      jiraDomain,
      basePath,
      path,
      durationMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : 'Unknown Jira request failure.',
    });

    throw new JiraRequestError('Cannot reach Jira. Check your network connection.');
  }
}

function getDetailedJiraPostErrorMessage(status: number, responseText: string): string {
  const fallbackMessage = getJiraErrorMessage(status);

  if (!responseText) {
    return fallbackMessage;
  }

  try {
    const parsedResponse = JSON.parse(responseText) as {
      errorMessages?: string[];
      errors?: Record<string, string>;
      message?: string;
    };

    const detailedMessages = [
      ...(parsedResponse.errorMessages ?? []),
      ...Object.values(parsedResponse.errors ?? {}),
      ...(parsedResponse.message ? [parsedResponse.message] : []),
    ].filter(Boolean);

    if (detailedMessages.length > 0) {
      return detailedMessages.join(' | ');
    }
  } catch {
    if (responseText.trim().length > 0) {
      return responseText.trim();
    }
  }

  return fallbackMessage;
}

function parseJiraDate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function resolveJiraSprintDates(
  sprint: Pick<JiraSprintMetadata, 'startDate' | 'endDate' | 'activatedDate' | 'completeDate'>,
): {
  actualEnd: Date | null;
  activatedAt: Date | null;
  plannedEnd: Date;
  plannedStart: Date;
} {
  const activatedAt = parseJiraDate(sprint.activatedDate);
  const actualEnd = parseJiraDate(sprint.completeDate);
  const fallbackDate = new Date();
  const plannedStart = parseJiraDate(sprint.startDate) ?? activatedAt ?? actualEnd ?? fallbackDate;
  const plannedEndCandidate = parseJiraDate(sprint.endDate) ?? actualEnd ?? plannedStart;
  const plannedEnd = plannedEndCandidate < plannedStart ? plannedStart : plannedEndCandidate;

  return {
    actualEnd,
    activatedAt,
    plannedEnd,
    plannedStart,
  };
}

export async function validateJiraConnection(): Promise<JiraConnectionResult> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  logJiraAuth('jira_auth_started', {
    requestId,
  });

  try {
    await jiraFetch('/myself');

    logJiraAuth('jira_auth_validation_succeeded', {
      requestId,
      durationMs: Date.now() - startedAt,
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Jira is currently unavailable.';

    logJiraAuth('jira_auth_validation_failed', {
      requestId,
      durationMs: Date.now() - startedAt,
      errorMessage: message,
    });

    return {
      success: false,
      message,
    };
  }
}

export async function findSprintsByName(
  jiraSpace: string,
  sprintName: string,
): Promise<JiraSprintMetadata[]> {
  const collectedSprints = await findAvailableSprints(jiraSpace);
  const normalizedSprintName = sprintName.trim().toLowerCase();

  return collectedSprints.filter(
    (sprint) => sprint.name.trim().toLowerCase() === normalizedSprintName,
  );
}

export async function findAvailableSprints(jiraSpace: string): Promise<JiraSprintMetadata[]> {
  const boardResponse = await jiraFetch<JiraBoardSearchResponse>(
    `/board?projectKeyOrId=${encodeURIComponent(jiraSpace)}`,
    JIRA_AGILE_BASE_PATH,
  );

  const scrumBoards = boardResponse.values.filter(({ type }) => type === 'scrum');

  let boardId = scrumBoards[0]?.id;

  if (scrumBoards.length > 1) {
    const normalizedJiraSpace = jiraSpace.trim().toLowerCase();

    for (const board of scrumBoards) {
      const boardConfiguration = await jiraFetch<JiraBoardConfigurationResponse>(
        `/board/${board.id}/configuration`,
        JIRA_AGILE_BASE_PATH,
      );
      const boardProjectKeyOrId = boardConfiguration.location?.projectKeyOrId?.trim().toLowerCase();

      if (boardConfiguration.location?.type === 'project' && boardProjectKeyOrId === normalizedJiraSpace) {
        boardId = board.id;
        break;
      }
    }
  }

  if (!boardId) {
    return [];
  }

  const collectedSprints: JiraSprintMetadata[] = [];
  let startAt = 0;
  let hasMoreResults = true;

  while (hasMoreResults) {
    const sprintResponse = await jiraFetch<JiraSprintSearchResponse>(
      `/board/${boardId}/sprint?state=active,future,closed&maxResults=50&startAt=${startAt}`,
      JIRA_AGILE_BASE_PATH,
    );

    collectedSprints.push(...sprintResponse.values);

    if (sprintResponse.isLast === true) {
      hasMoreResults = false;
      continue;
    }

    const pageSize = sprintResponse.maxResults ?? sprintResponse.values.length;

    if (sprintResponse.values.length < pageSize || sprintResponse.values.length === 0) {
      hasMoreResults = false;
      continue;
    }

    startAt += pageSize;
  }

  return [...collectedSprints].sort((left, right) => {
    const leftDate = parseJiraDate(left.startDate)
      ?? parseJiraDate(left.activatedDate)
      ?? parseJiraDate(left.endDate)
      ?? parseJiraDate(left.completeDate)
      ?? new Date(0);
    const rightDate = parseJiraDate(right.startDate)
      ?? parseJiraDate(right.activatedDate)
      ?? parseJiraDate(right.endDate)
      ?? parseJiraDate(right.completeDate)
      ?? new Date(0);

    return rightDate.getTime() - leftDate.getTime();
  });
}

export async function findSprintByName(
  jiraSpace: string,
  sprintName: string,
): Promise<JiraSprintMetadata | null> {
  const sprints = await findSprintsByName(jiraSpace, sprintName);

  return sprints[0] ?? null;
}

export async function getSprintByJiraId(jiraSprintId: number): Promise<JiraSprintMetadata> {
  return jiraFetch<JiraSprintResponse>(`/sprint/${jiraSprintId}`, JIRA_AGILE_BASE_PATH);
}

export async function fetchSprintIssues(jiraSprintId: number): Promise<JiraIssue[]> {
  const { storyPointsFieldId } = await getJiraConfig();
  const fields = ['created', 'summary', 'assignee', 'priority', 'status', storyPointsFieldId].join(',');
  const pageSize = 200;
  const issues: JiraIssue[] = [];
  let startAt = 0;
  let hasMoreResults = true;

  while (hasMoreResults) {
    const issueResponse = await jiraFetch<JiraAgileIssueSearchResponse>(
      `/sprint/${jiraSprintId}/issue?expand=changelog&fields=${encodeURIComponent(fields)}&maxResults=${pageSize}&startAt=${startAt}`,
      JIRA_AGILE_BASE_PATH,
    );

    issues.push(...issueResponse.issues);

    const receivedCount = issueResponse.issues.length;
    const nextStartAt = startAt + receivedCount;
    const reportedTotal = issueResponse.total;
    const reportedPageSize = issueResponse.maxResults ?? pageSize;

    if (receivedCount === 0 || receivedCount < reportedPageSize) {
      hasMoreResults = false;
      continue;
    }

    if (typeof reportedTotal === 'number' && nextStartAt >= reportedTotal) {
      hasMoreResults = false;
      continue;
    }

    startAt = nextStartAt;
  }

  return issues;
}

async function fetchIssueWithChangelog(issueKey: string, fields: string): Promise<JiraIssue> {
  return jiraFetch<JiraIssue>(
    `/issue/${encodeURIComponent(issueKey)}?expand=changelog&fields=${encodeURIComponent(fields)}`,
  );
}

function escapeJqlValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export async function fetchAssignedIssuesOutsideProject(input: {
  assigneeEmail: string;
  excludedProjectKey: string;
  sprintEnd: Date;
  sprintStart: Date;
}): Promise<JiraIssue[]> {
  const { storyPointsFieldId } = await getJiraConfig();
  const fields = ['created', 'summary', 'assignee', 'priority', 'status', storyPointsFieldId].join(',');
  const pageSize = 100;
  const issues: JiraIssue[] = [];
  if (input.sprintStart.getTime() > input.sprintEnd.getTime()) {
    return issues;
  }

  const jql = [
    `assignee = \"${escapeJqlValue(input.assigneeEmail)}\"`,
    `project != \"${escapeJqlValue(input.excludedProjectKey)}\"`,
    'status NOT IN (\"To Do\", \"NEW\", \"Closed\", \"ON HOLD\", \"Rejected\", \"Dev Review\", \"Duplicate\", \"Backlog\")',
  ].join(' AND ');
  const orderedJql = `${jql} ORDER BY priority DESC, updated DESC`;
  let nextPageToken: string | undefined;
  let hasMoreResults = true;

  while (hasMoreResults) {
    const issueResponse = await jiraPost<JiraIssueSearchResponse>('/search/jql', {
      fields: fields.split(','),
      fieldsByKeys: false,
      jql: orderedJql,
      maxResults: pageSize,
      ...(nextPageToken ? { nextPageToken } : {}),
    });

    const issuesWithChangelog = await Promise.all(
      issueResponse.issues.map((issue) => fetchIssueWithChangelog(issue.key, fields)),
    );

    issues.push(...issuesWithChangelog);

    if (issueResponse.nextPageToken) {
      nextPageToken = issueResponse.nextPageToken;

      if (issueResponse.isLast || issueResponse.issues.length === 0) {
        hasMoreResults = false;
      }

      continue;
    }

    hasMoreResults = false;
  }

  return issues;
}