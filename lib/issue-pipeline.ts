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

interface MemberLookup {
  memberById: Map<string, IssueGroupMember>;
  membersByEmail: Map<string, IssueGroupMember>;
  uniqueMembersByName: Map<string, IssueGroupMember>;
}

const QA_OWNER_FIELD_ID = 'customfield_11325';

const PRIORITY_ORDER: Record<string, number> = {
  'David Jackson': 0,
  Critical: 1,
  High: 2,
  Medium: 3,
  Low: 4,
  Lowest: 5,
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

function buildMemberLookup(members: IssueGroupMember[]): MemberLookup {
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

  return {
    memberById: new Map<string, IssueGroupMember>(members.map((member) => [member.id, member])),
    membersByEmail,
    uniqueMembersByName,
  };
}

function findMemberForIssue(issue: JiraIssue, histories: JiraIssueHistory[], lookup: MemberLookup): IssueGroupMember | null {
  const assigneeIdentifier = getLastAssigneeIdentifier(issue, histories);

  if (!assigneeIdentifier) {
    return null;
  }

  return lookup.membersByEmail.get(assigneeIdentifier) ?? lookup.uniqueMembersByName.get(assigneeIdentifier) ?? null;
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

function normalizeIdentifiers(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => normalizeAssigneeIdentifier(value)).filter((value): value is string => value !== null))];
}

function parseUserFieldIdentifiers(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseUserFieldIdentifiers(entry));
  }

  if (typeof value === 'string') {
    return normalizeIdentifiers(value.split(','));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    return normalizeIdentifiers([
      typeof record.emailAddress === 'string' ? record.emailAddress : null,
      typeof record.displayName === 'string' ? record.displayName : null,
      typeof record.name === 'string' ? record.name : null,
      typeof record.value === 'string' ? record.value : null,
    ]);
  }

  return [];
}

function getLastQaIdentifiers(issue: JiraIssue, histories: JiraIssueHistory[]): string[] {
  for (const history of [...histories].reverse()) {
    const qaItem = [...history.items].reverse().find(
      (item) => item.fieldId === QA_OWNER_FIELD_ID || item.field === QA_OWNER_FIELD_ID,
    );

    if (!qaItem) {
      continue;
    }

    const identifiers = parseUserFieldIdentifiers(qaItem.toString);

    if (identifiers.length > 0) {
      return identifiers;
    }
  }

  return parseUserFieldIdentifiers(issue.fields[QA_OWNER_FIELD_ID]);
}

function findQaMembersForIssue(issue: JiraIssue, histories: JiraIssueHistory[], lookup: MemberLookup): IssueGroupMember[] {
  const identifiers = new Set<string>([
    ...getLastQaIdentifiers(issue, histories),
    ...normalizeIdentifiers([getLastAssigneeIdentifier(issue, histories)]),
  ]);
  const members = new Map<string, IssueGroupMember>();

  for (const identifier of identifiers) {
    const member = lookup.membersByEmail.get(identifier) ?? lookup.uniqueMembersByName.get(identifier);

    if (member) {
      members.set(member.id, member);
    }
  }

  return [...members.values()];
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

function isInProgressStatus(status: string): boolean {
  const normalizedStatus = status.trim().toLowerCase();

  return (
    normalizedStatus.includes('progress')
    || normalizedStatus.includes('develop')
    || normalizedStatus.includes('implement')
    || normalizedStatus.includes('coding')
    || normalizedStatus.includes('working')
  );
}

function isQaTestingStatus(status: string): boolean {
  const normalizedStatus = status.trim().toLowerCase();

  return (
    normalizedStatus.includes('testing')
    || normalizedStatus.includes('qa')
    || normalizedStatus.includes('verify')
    || normalizedStatus.includes('validation')
  );
}

function fallsWithinSprintWindow(date: Date, sprint: IssuePipelineSprintContext): boolean {
  const sprintStart = startOfUtcDay(sprint.activatedAt ?? sprint.plannedStart).getTime();
  const sprintEnd = startOfUtcDay(sprint.actualEnd ?? new Date()).getTime();
  const value = startOfUtcDay(date).getTime();

  return value >= sprintStart && value <= sprintEnd;
}

function intervalsOverlap(start: Date, end: Date, sprint: IssuePipelineSprintContext): boolean {
  const intervalStart = startOfUtcDay(start).getTime();
  const intervalEnd = startOfUtcDay(end).getTime();
  const sprintStart = startOfUtcDay(sprint.activatedAt ?? sprint.plannedStart).getTime();
  const sprintEnd = startOfUtcDay(sprint.actualEnd ?? new Date()).getTime();

  return intervalStart <= sprintEnd && intervalEnd >= sprintStart;
}

function parseIssueCreatedAt(issue: JiraIssue): Date | null {
  const createdAt = new Date(issue.fields.created);

  return Number.isNaN(createdAt.getTime()) ? null : createdAt;
}

function hadMatchingStatusDuringSprint(
  issue: JiraIssue,
  histories: JiraIssueHistory[],
  sprint: IssuePipelineSprintContext,
  matcher: (status: string) => boolean,
): boolean {
  let currentStatus = issue.fields.status.name;
  let currentIntervalEnd = sprint.actualEnd ?? new Date();

  for (const history of [...histories].reverse()) {
    const statusItem = [...history.items].reverse().find((item) => item.field === 'status');

    if (!statusItem) {
      continue;
    }

    const changedAt = new Date(history.created);

    if (!Number.isNaN(changedAt.getTime()) && matcher(currentStatus) && intervalsOverlap(changedAt, currentIntervalEnd, sprint)) {
      return true;
    }

    currentStatus = statusItem.fromString ?? currentStatus;
    currentIntervalEnd = changedAt;
  }

  const issueCreatedAt = parseIssueCreatedAt(issue);

  if (!issueCreatedAt) {
    return false;
  }

  return matcher(currentStatus) && intervalsOverlap(issueCreatedAt, currentIntervalEnd, sprint);
}

function toProcessedIssue(
  issue: JiraIssue,
  sprint: IssuePipelineSprintContext,
  assigneeEmail: string,
  label: ProcessedIssue['label'],
  histories?: JiraIssueHistory[],
): ProcessedIssue | null {
  const filteredHistories = histories ?? sortHistoriesAscending(
    filterHistoriesForSprint(issue.changelog.histories, sprint.actualEnd),
  );

  return {
    key: issue.key,
    title: issue.fields.summary,
    url: `https://${sprint.jiraDomain}/browse/${issue.key}`,
    label: label === 'external'
      ? 'external'
      : getIssueLabel(
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
  if (!sprint.activatedAt && issues.length > 0) {
    console.warn(
      `[issue-pipeline] Sprint activation date missing for sprint '${sprint.sprintName}'. Falling back to plannedStart for planned/unplanned labeling.`,
    );
  }

  const lookup = buildMemberLookup(members);

  const groupedIssues = new Map<string, ProcessedIssue[]>();

  for (const issue of issues) {
    if (!issue.fields.assignee) {
      continue;
    }

    const filteredHistories = sortHistoriesAscending(
      filterHistoriesForSprint(issue.changelog.histories, sprint.actualEnd),
    );
    const member = findMemberForIssue(issue, filteredHistories, lookup);

    if (!member) {
      continue;
    }

    const processedIssue = toProcessedIssue(
      issue,
      sprint,
      member.jiraEmail,
      getIssueLabel(
        filteredHistories,
        sprint.activatedAt,
        sprint.plannedStart,
        sprint.sprintJiraId,
        sprint.sprintName,
      ),
      filteredHistories,
    );

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
        externalInProgressIssues: [],
        issues: memberIssues,
        totalStoryPoints: memberIssues.reduce(
          (sum, currentIssue) => sum + (currentIssue.storyPoints ?? 0),
          0,
        ),
      };
    })
    .filter((group): group is DeveloperIssueGroup => group !== null);
}

export function processExternalInProgressIssues(
  issues: JiraIssue[],
  sprint: IssuePipelineSprintContext,
  members: IssueGroupMember[],
): Map<string, ProcessedIssue[]> {
  const lookup = buildMemberLookup(members);
  const groupedIssues = new Map<string, ProcessedIssue[]>();

  for (const issue of issues) {
    if (!issue.fields.assignee) {
      continue;
    }

    const filteredHistories = sortHistoriesAscending(issue.changelog.histories);
    const member = findMemberForIssue(issue, filteredHistories, lookup);

    if (!member || !hadMatchingStatusDuringSprint(issue, filteredHistories, sprint, isInProgressStatus)) {
      continue;
    }

    const processedIssue = toProcessedIssue(
      issue,
      sprint,
      member.jiraEmail,
      'external',
      filteredHistories,
    );

    if (!processedIssue) {
      continue;
    }

    const existingIssues = groupedIssues.get(member.id) ?? [];
    existingIssues.push(processedIssue);
    groupedIssues.set(member.id, existingIssues);
  }

  for (const [memberId, memberIssues] of groupedIssues.entries()) {
    groupedIssues.set(
      memberId,
      [...memberIssues].sort(
        (left, right) =>
          (PRIORITY_ORDER[left.priority ?? ''] ?? 99)
          - (PRIORITY_ORDER[right.priority ?? ''] ?? 99),
      ),
    );
  }

  return groupedIssues;
}

export function processQaSprintIssues(
  issues: JiraIssue[],
  sprint: IssuePipelineSprintContext,
  members: IssueGroupMember[],
): DeveloperIssueGroup[] {
  const qaMembers = members.filter((member) => member.specialization.includes('qa'));

  if (qaMembers.length === 0) {
    return [];
  }

  const lookup = buildMemberLookup(qaMembers);
  const groupedIssues = new Map<string, ProcessedIssue[]>();

  for (const issue of issues) {
    const filteredHistories = sortHistoriesAscending(
      filterHistoriesForSprint(issue.changelog.histories, sprint.actualEnd),
    );
    const matchedMembers = findQaMembersForIssue(issue, filteredHistories, lookup);

    if (matchedMembers.length === 0) {
      continue;
    }

    for (const member of matchedMembers) {
      const processedIssue = toProcessedIssue(
        issue,
        sprint,
        member.jiraEmail,
        getIssueLabel(
          filteredHistories,
          sprint.activatedAt,
          sprint.plannedStart,
          sprint.sprintJiraId,
          sprint.sprintName,
        ),
        filteredHistories,
      );

      if (!processedIssue) {
        continue;
      }

      const existingIssues = groupedIssues.get(member.id) ?? [];
      existingIssues.push(processedIssue);
      groupedIssues.set(member.id, existingIssues);
    }
  }

  return qaMembers
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
        externalInProgressIssues: [],
        issues: memberIssues,
        totalStoryPoints: 0,
      };
    })
    .filter((group): group is DeveloperIssueGroup => group !== null);
}

export function processQaExternalInProgressIssues(
  issues: JiraIssue[],
  sprint: IssuePipelineSprintContext,
  members: IssueGroupMember[],
): Map<string, ProcessedIssue[]> {
  const qaMembers = members.filter((member) => member.specialization.includes('qa'));

  if (qaMembers.length === 0) {
    return new Map<string, ProcessedIssue[]>();
  }

  const lookup = buildMemberLookup(qaMembers);
  const groupedIssues = new Map<string, ProcessedIssue[]>();

  for (const issue of issues) {
    const filteredHistories = sortHistoriesAscending(issue.changelog.histories);
    const matchedMembers = findQaMembersForIssue(issue, filteredHistories, lookup);

    if (matchedMembers.length === 0 || !hadMatchingStatusDuringSprint(issue, filteredHistories, sprint, isQaTestingStatus)) {
      continue;
    }

    for (const member of matchedMembers) {
      const processedIssue = toProcessedIssue(
        issue,
        sprint,
        member.jiraEmail,
        'external',
        filteredHistories,
      );

      if (!processedIssue) {
        continue;
      }

      const existingIssues = groupedIssues.get(member.id) ?? [];
      existingIssues.push(processedIssue);
      groupedIssues.set(member.id, existingIssues);
    }
  }

  for (const [memberId, memberIssues] of groupedIssues.entries()) {
    groupedIssues.set(
      memberId,
      [...memberIssues].sort(
        (left, right) =>
          (PRIORITY_ORDER[left.priority ?? ''] ?? 99)
          - (PRIORITY_ORDER[right.priority ?? ''] ?? 99),
      ),
    );
  }

  return groupedIssues;
}