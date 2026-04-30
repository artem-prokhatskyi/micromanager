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
  }>;
}

interface JiraSprintSearchResponse {
  values: JiraSprintMetadata[];
}

interface JiraIssueSearchResponse {
  issues: JiraIssue[];
}

class JiraRequestError extends Error {
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

async function getJiraConfig(): Promise<JiraConfig> {
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
    return {
      jiraDomain: settings.jiraDomain,
      jiraEmail: settings.jiraEmail,
      jiraApiKey: decrypt(settings.jiraApiKey),
      storyPointsFieldId: settings.storyPointsFieldId || 'story_points',
    };
  } catch {
    throw new JiraRequestError('Stored Jira credentials could not be decrypted. Update the Jira API key in Settings.');
  }
}

async function jiraFetch<T>(path: string, basePath: string = JIRA_API_BASE_PATH): Promise<T> {
  const { jiraApiKey, jiraDomain, jiraEmail } = await getJiraConfig();
  const credentials = Buffer.from(`${jiraEmail}:${jiraApiKey}`).toString('base64');

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
      throw new JiraRequestError(getJiraErrorMessage(response.status), response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof JiraRequestError) {
      throw error;
    }

    throw new JiraRequestError('Cannot reach Jira. Check your network connection.');
  }
}

export async function validateJiraConnection(): Promise<JiraConnectionResult> {
  try {
    await jiraFetch('/myself');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Jira is currently unavailable.';

    return {
      success: false,
      message,
    };
  }
}

export async function findSprintByName(
  jiraSpace: string,
  sprintName: string,
): Promise<JiraSprintMetadata | null> {
  const boardResponse = await jiraFetch<JiraBoardSearchResponse>(
    `/board?projectKeyOrId=${encodeURIComponent(jiraSpace)}`,
    JIRA_AGILE_BASE_PATH,
  );

  const boardId = boardResponse.values[0]?.id;

  if (!boardId) {
    return null;
  }

  const sprintResponse = await jiraFetch<JiraSprintSearchResponse>(
    `/board/${boardId}/sprint?maxResults=50`,
    JIRA_AGILE_BASE_PATH,
  );

  const normalizedSprintName = sprintName.trim().toLowerCase();

  return (
    sprintResponse.values.find((sprint) => sprint.name.trim().toLowerCase() === normalizedSprintName) ??
    null
  );
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