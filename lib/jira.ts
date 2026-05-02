import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
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

interface JiraSprintSearchResponse {
  values: JiraSprintMetadata[];
  isLast?: boolean;
  maxResults?: number;
  startAt?: number;
}

interface JiraSprintResponse extends JiraSprintMetadata {}

interface JiraIssueSearchResponse {
  issues: JiraIssue[];
}

interface JiraRequestLogContext {
  basePath: string;
  durationMs?: number;
  errorMessage?: string;
  jiraDomain?: string;
  method: 'GET';
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
  const boardResponse = await jiraFetch<JiraBoardSearchResponse>(
    `/board?projectKeyOrId=${encodeURIComponent(jiraSpace)}`,
    JIRA_AGILE_BASE_PATH,
  );

  const boardId = boardResponse.values.filter(({ type }) => type === 'scrum')[0]?.id;

  if (!boardId) {
    return [];
  }

  const collectedSprints: JiraSprintMetadata[] = [];
  let startAt = 0;
  let hasMoreResults = true;

  while (hasMoreResults) {
    const sprintResponse = await jiraFetch<JiraSprintSearchResponse>(
      `/board/${boardId}/sprint?state=active,future&maxResults=50&startAt=${startAt}`,
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

  const normalizedSprintName = sprintName.trim().toLowerCase();

  return collectedSprints.filter(
    (sprint) => sprint.name.trim().toLowerCase() === normalizedSprintName,
  );
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
  const fields = ['summary', 'assignee', 'priority', 'status', storyPointsFieldId].join(',');
  const issueResponse = await jiraFetch<JiraIssueSearchResponse>(
    `/sprint/${jiraSprintId}/issue?expand=changelog&fields=${encodeURIComponent(fields)}&maxResults=200`,
    JIRA_AGILE_BASE_PATH,
  );

  return issueResponse.issues;
}