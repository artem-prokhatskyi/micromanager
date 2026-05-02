import { startOfUtcDay } from '@/lib/date';
import type {
  DeveloperIssueGroup,
  IssueGroupMember,
  JiraIssue,
  JiraIssueHistory,
  ProcessedIssue,
} from '@/types';

interface IssuePipelineSprintContext {
  actualEnd: Date | null;
  activatedAt: Date | null;
  estimateInHours: boolean;
  jiraDomain: string;
  plannedStart: Date;
  sprintJiraId: number;
  sprintName: string;
  storyPointsFieldId: string;
}

const PRIORITY_ORDER: Record<string, number> = {
  Highest: 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Lowest: 4,
};

function filterHistoriesForSprint(
  histories: JiraIssue['changelog']['histories'],
  actualEnd: Date | null,
): JiraIssueHistory[] {
  if (!actualEnd) {
    return histories;
  }

  return histories.filter((history) => startOfUtcDay(new Date(history.created)) <= startOfUtcDay(actualEnd));
}

function sortHistoriesAscending(histories: JiraIssueHistory[]): JiraIssueHistory[] {
  return [...histories].sort(
    (left, right) => new Date(left.created).getTime() - new Date(right.created).getTime(),
  );
}

function normalizeAssigneeIdentifier(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

function getLastAssigneeIdentifier(issue: JiraIssue, histories: JiraIssueHistory[]): string | null {
  const currentAssigneeEmail = normalizeAssigneeIdentifier(issue.fields.assignee?.emailAddress);
  const currentAssigneeName = normalizeAssigneeIdentifier(issue.fields.assignee?.displayName);

  for (const history of [...histories].reverse()) {
    const assigneeItem = [...history.items].reverse().find((item) => item.field === 'assignee');

    const nextAssignee = normalizeAssigneeIdentifier(assigneeItem?.toString);

    if (!nextAssignee) {
      continue;
    }

    return nextAssignee;
  }

  return currentAssigneeEmail ?? currentAssigneeName;
}

function normalizeStoryPoints(value: number | null, estimateInHours: boolean): number | null {
  if (value === null) {
    return null;
  }

  return estimateInHours ? value / 8 : value;
}

function getStoryPoints(
  issue: JiraIssue,
  histories: JiraIssueHistory[],
  storyPointsFieldId: string,
  estimateInHours: boolean,
): number | null {
  for (const history of [...histories].reverse()) {
    const storyPointsItem = [...history.items].reverse().find(
      (item) =>
        item.fieldId === storyPointsFieldId
        || item.field === storyPointsFieldId
        || item.field === 'story_points'
        || item.field === 'Story Points',
    );

    if (!storyPointsItem) {
      continue;
    }

    const parsedValue = Number.parseFloat(storyPointsItem.toString ?? '');

    return Number.isNaN(parsedValue) ? null : normalizeStoryPoints(parsedValue, estimateInHours);
  }

  const currentValue = issue.fields[storyPointsFieldId];
  const parsedCurrentValue = Number.parseFloat(String(currentValue ?? ''));

  return Number.isNaN(parsedCurrentValue) ? null : normalizeStoryPoints(parsedCurrentValue, estimateInHours);
}

function getLastStatus(issue: JiraIssue, histories: JiraIssueHistory[]): string {
  for (const history of [...histories].reverse()) {
    const statusItem = [...history.items].reverse().find((item) => item.field === 'status');

    if (statusItem?.toString) {
      return statusItem.toString;
    }
  }

  return issue.fields.status.name;
}

function getIssueLabel(
  histories: JiraIssueHistory[],
  activatedAt: Date | null,
  plannedStart: Date,
  sprintJiraId: number,
  sprintName: string,
): 'planned' | 'unplanned' {
  const planningCutoff = activatedAt ?? plannedStart;

  if (!activatedAt) {
    console.warn(
      `[issue-pipeline] Sprint activation date missing for sprint '${sprintName}'. Falling back to plannedStart for planned/unplanned labeling.`,
    );
  }

  let addedAt: Date | null = null;

  for (const history of histories) {
    const hasSprintTransition = history.items.some((item) => {
      if (item.field !== 'Sprint') {
        return false;
      }

      const nextValue = item.toString ?? '';
      const previousValue = item.fromString ?? '';

      return (
        !previousValue.includes(String(sprintJiraId))
        && !previousValue.includes(sprintName)
        && (nextValue.includes(String(sprintJiraId)) || nextValue.includes(sprintName))
      );
    });

    if (hasSprintTransition) {
      addedAt = new Date(history.created);
    }
  }

  if (!addedAt) {
    return 'planned';
  }

  return addedAt <= planningCutoff ? 'planned' : 'unplanned';
}

function toProcessedIssue(
  issue: JiraIssue,
  sprint: IssuePipelineSprintContext,
  assigneeEmail: string,
): ProcessedIssue | null {
  const filteredHistories = sortHistoriesAscending(
    filterHistoriesForSprint(issue.changelog.histories, sprint.actualEnd),
  );

  return {
    key: issue.key,
    title: issue.fields.summary,
    url: `https://${sprint.jiraDomain}/browse/${issue.key}`,
    label: getIssueLabel(
      filteredHistories,
      sprint.activatedAt,
      sprint.plannedStart,
      sprint.sprintJiraId,
      sprint.sprintName,
    ),
    storyPoints: getStoryPoints(issue, filteredHistories, sprint.storyPointsFieldId, sprint.estimateInHours),
    status: getLastStatus(issue, filteredHistories),
    priority: issue.fields.priority?.name ?? null,
    assigneeEmail,
  };
}

export function processSprintIssues(
  issues: JiraIssue[],
  sprint: IssuePipelineSprintContext,
  members: IssueGroupMember[],
): DeveloperIssueGroup[] {
  const membersByEmail = new Map<string, IssueGroupMember>();
  const uniqueMembersByName = new Map<string, IssueGroupMember>();
  const duplicateMemberNames = new Set<string>();

  for (const member of members) {
    const normalizedEmail = normalizeAssigneeIdentifier(member.jiraEmail);

    if (normalizedEmail) {
      membersByEmail.set(normalizedEmail, member);
    }

    const normalizedName = normalizeAssigneeIdentifier(member.name);

    if (!normalizedName) {
      continue;
    }

    if (uniqueMembersByName.has(normalizedName)) {
      uniqueMembersByName.delete(normalizedName);
      duplicateMemberNames.add(normalizedName);
      continue;
    }

    if (!duplicateMemberNames.has(normalizedName)) {
      uniqueMembersByName.set(normalizedName, member);
    }
  }

  const groupedIssues = new Map<string, ProcessedIssue[]>();

  for (const issue of issues) {
    if (!issue.fields.assignee) {
      continue;
    }

    const filteredHistories = sortHistoriesAscending(
      filterHistoriesForSprint(issue.changelog.histories, sprint.actualEnd),
    );
    const assigneeIdentifier = getLastAssigneeIdentifier(issue, filteredHistories);

    if (!assigneeIdentifier) {
      continue;
    }

    const member = membersByEmail.get(assigneeIdentifier) ?? uniqueMembersByName.get(assigneeIdentifier);

    if (!member) {
      continue;
    }

    const processedIssue = toProcessedIssue(issue, sprint, member.jiraEmail);

    if (!processedIssue) {
      continue;
    }

    const existingIssues = groupedIssues.get(member.id) ?? [];
    existingIssues.push(processedIssue);
    groupedIssues.set(member.id, existingIssues);
  }

  return members
    .map<DeveloperIssueGroup | null>((member) => {
      const memberIssues = [...(groupedIssues.get(member.id) ?? [])].sort(
        (left, right) =>
          (PRIORITY_ORDER[left.priority ?? ''] ?? 5)
          - (PRIORITY_ORDER[right.priority ?? ''] ?? 5),
      );

      if (memberIssues.length === 0) {
        return null;
      }

      return {
        member,
        issues: memberIssues,
        totalStoryPoints: memberIssues.reduce(
          (sum, currentIssue) => sum + (currentIssue.storyPoints ?? 0),
          0,
        ),
      };
    })
    .filter((group): group is DeveloperIssueGroup => group !== null);
}