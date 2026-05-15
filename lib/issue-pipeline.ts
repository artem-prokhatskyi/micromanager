import { formatUtcDate, getTodayUtc, listUtcDaysInRange, startOfUtcDay } from '@/lib/date';
import { WEEK_DAY } from '@/types';
import type {
  DeveloperIssueGroup,
  IssueGroupMember,
  JiraIssue,
  JiraIssueHistory,
  NonWorkingDayRecord,
  ProcessedIssue,
  WeekDay,
} from '@/types';

interface IssuePipelineSprintContext {
  actualEnd: Date | null;
  activatedAt: Date | null;
  estimateInHours: boolean;
  jiraDomain: string;
  plannedEnd: Date;
  plannedStart: Date;
  sprintJiraId: number;
  sprintName: string;
  storyPointsFieldId: string;
}

interface IssuePipelineMember extends IssueGroupMember {
  workingDays: WeekDay[];
}

interface MemberLookup {
  memberById: Map<string, IssuePipelineMember>;
  membersByEmail: Map<string, IssuePipelineMember>;
  uniqueMembersByName: Map<string, IssuePipelineMember>;
}

const QA_OWNER_FIELD_ID = 'customfield_11325';
const QA_TESTING_WORK_START_HOUR = 9;
const QA_TESTING_WORK_END_HOUR = 19;
const WEEKDAY_MAP: Record<WeekDay, number> = {
  [WEEK_DAY.SUN]: 0,
  [WEEK_DAY.MON]: 1,
  [WEEK_DAY.TUE]: 2,
  [WEEK_DAY.WED]: 3,
  [WEEK_DAY.THU]: 4,
  [WEEK_DAY.FRI]: 5,
  [WEEK_DAY.SAT]: 6,
};

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

function buildMemberLookup(members: IssuePipelineMember[]): MemberLookup {
  const membersByEmail = new Map<string, IssuePipelineMember>();
  const uniqueMembersByName = new Map<string, IssuePipelineMember>();
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
    memberById: new Map<string, IssuePipelineMember>(members.map((member) => [member.id, member])),
    membersByEmail,
    uniqueMembersByName,
  };
}

function getDeveloperMembers(members: IssuePipelineMember[]): IssuePipelineMember[] {
  return members.filter((member) => !member.specialization.includes('qa'));
}

function findMemberForIssue(issue: JiraIssue, histories: JiraIssueHistory[], lookup: MemberLookup): IssuePipelineMember | null {
  const assigneeIdentifier = getLastAssigneeIdentifier(issue, histories);

  if (!assigneeIdentifier) {
    return null;
  }

  const matchedMember = lookup.membersByEmail.get(assigneeIdentifier) ?? lookup.uniqueMembersByName.get(assigneeIdentifier) ?? null;

  if (matchedMember) {
    return matchedMember;
  }

  // Fallback: the changelog toString field contains a display name which may not
  // match the stored member name. Try the current assignee email and name directly.
  const currentEmail = normalizeAssigneeIdentifier(issue.fields.assignee?.emailAddress);
  const currentName = normalizeAssigneeIdentifier(issue.fields.assignee?.displayName);

  if (currentEmail) {
    const memberByEmail = lookup.membersByEmail.get(currentEmail);

    if (memberByEmail) {
      return memberByEmail;
    }
  }

  if (currentName) {
    return lookup.uniqueMembersByName.get(currentName) ?? null;
  }

  return null;
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

function findQaMembersForIssue(issue: JiraIssue, _histories: JiraIssueHistory[], lookup: MemberLookup): IssuePipelineMember[] {
  const identifiers = parseUserFieldIdentifiers(issue.fields[QA_OWNER_FIELD_ID]);
  const members = new Map<string, IssuePipelineMember>();

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

function getStatusAtDate(issue: JiraIssue, histories: JiraIssueHistory[], targetDate: Date): string {
  const issueCreatedAt = parseIssueCreatedAt(issue);

  if (issueCreatedAt && issueCreatedAt.getTime() > targetDate.getTime()) {
    return 'Not created';
  }

  let status = issue.fields.status.name;

  for (const history of [...histories].reverse()) {
    const statusItem = [...history.items].reverse().find((item) => item.field === 'status');

    if (!statusItem) {
      continue;
    }

    const changedAt = new Date(history.created);

    if (Number.isNaN(changedAt.getTime())) {
      continue;
    }

    if (changedAt.getTime() > targetDate.getTime()) {
      status = statusItem.fromString ?? status;
      continue;
    }

    return status;
  }

  return status;
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
    normalizedStatus === 'in progress'
  );
}

function isQaTestingStatus(status: string): boolean {
  const normalizedStatus = status.trim().toLowerCase();

  return (
    normalizedStatus === 'testing'
  );
}

const EXCLUDED_QA_ISSUE_TYPES = new Set(['sub-task', 'sub-bug', 'epic']);

function isExcludedQaIssueType(issue: JiraIssue): boolean {
  const issueType = issue.fields.issuetype?.name?.trim().toLowerCase() ?? '';

  return EXCLUDED_QA_ISSUE_TYPES.has(issueType);
}

function getSprintWindow(sprint: IssuePipelineSprintContext): { end: Date; start: Date } {
  const sprintStart = startOfUtcDay(sprint.activatedAt ?? sprint.plannedStart);

  if (sprint.actualEnd) {
    const actualEndDay = startOfUtcDay(sprint.actualEnd);

    return {
      start: sprintStart,
      end: new Date(Date.UTC(
        actualEndDay.getUTCFullYear(),
        actualEndDay.getUTCMonth(),
        actualEndDay.getUTCDate(),
        23,
        59,
        59,
        999,
      )),
    };
  }

  return {
    start: sprintStart,
    end: new Date(),
  };
}

function getTotalIssueWindow(issue: JiraIssue): { end: Date; start: Date } | null {
  const issueCreatedAt = parseIssueCreatedAt(issue);

  if (!issueCreatedAt) {
    return null;
  }

  return {
    start: issueCreatedAt,
    end: new Date(),
  };
}

function buildNonWorkingDayAmountByDate(nonWorkingDays: NonWorkingDayRecord[]): Map<string, number> {
  return nonWorkingDays.reduce<Map<string, number>>((accumulator, record) => {
    const currentAmount = accumulator.get(record.date) ?? 0;

    accumulator.set(record.date, Math.min(1, currentAmount + (record.halfDay ? 0.5 : 1)));

    return accumulator;
  }, new Map<string, number>());
}

function calculateWorkingStatusDurationMs(
  start: Date,
  end: Date,
  member: IssuePipelineMember,
  nonWorkingDays: NonWorkingDayRecord[],
): number {
  const startMs = start.getTime();
  const endMs = end.getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return 0;
  }

  const workingDayNumbers = new Set<number>(member.workingDays.map((day) => WEEKDAY_MAP[day]));

  if (workingDayNumbers.size === 0) {
    return 0;
  }

  const nonWorkingDayAmountByDate = buildNonWorkingDayAmountByDate(nonWorkingDays);

  return listUtcDaysInRange(start, end).reduce((total, day) => {
    if (!workingDayNumbers.has(day.getUTCDay())) {
      return total;
    }

    const availabilityFactor = 1 - (nonWorkingDayAmountByDate.get(formatUtcDate(day)) ?? 0);

    if (availabilityFactor <= 0) {
      return total;
    }

    const workDayStartMs = Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      QA_TESTING_WORK_START_HOUR,
      0,
      0,
      0,
    );
    const workDayEndMs = Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      QA_TESTING_WORK_END_HOUR,
      0,
      0,
      0,
    );
    const intervalStartMs = Math.max(startMs, workDayStartMs);
    const intervalEndMs = Math.min(endMs, workDayEndMs);

    if (intervalEndMs <= intervalStartMs) {
      return total;
    }

    return total + ((intervalEndMs - intervalStartMs) * availabilityFactor);
  }, 0);
}

function calculateStatusTimeHours(
  issue: JiraIssue,
  histories: JiraIssueHistory[],
  member: IssuePipelineMember,
  nonWorkingDays: NonWorkingDayRecord[],
  matcher: (status: string) => boolean,
  window: { end: Date; start: Date } | null,
): number | null {
  if (!window) {
    return null;
  }

  if (window.end.getTime() <= window.start.getTime()) {
    return null;
  }

  const effectiveStart = window.start;
  let currentStatus = getStatusAtDate(issue, histories, effectiveStart);
  let currentIntervalStart = effectiveStart;
  let totalDurationMs = 0;

  for (const history of histories) {
    const statusItem = history.items.find((item) => item.field === 'status');

    if (!statusItem) {
      continue;
    }

    const changedAt = new Date(history.created);

    if (Number.isNaN(changedAt.getTime()) || changedAt.getTime() <= effectiveStart.getTime()) {
      continue;
    }

    if (changedAt.getTime() > window.end.getTime()) {
      break;
    }

    if (matcher(currentStatus)) {
      totalDurationMs += calculateWorkingStatusDurationMs(currentIntervalStart, changedAt, member, nonWorkingDays);
    }

    currentStatus = statusItem.toString ?? currentStatus;
    currentIntervalStart = changedAt;
  }

  if (matcher(currentStatus) && window.end.getTime() > currentIntervalStart.getTime()) {
    totalDurationMs += calculateWorkingStatusDurationMs(currentIntervalStart, window.end, member, nonWorkingDays);
  }

  if (totalDurationMs <= 0) {
    return null;
  }

  return Math.round((totalDurationMs / (1000 * 60 * 60)) * 100) / 100;
}

function calculateQaTestingTimeHours(
  issue: JiraIssue,
  histories: JiraIssueHistory[],
  sprint: IssuePipelineSprintContext,
  member: IssuePipelineMember,
  nonWorkingDays: NonWorkingDayRecord[],
): number | null {
  return calculateStatusTimeHours(
    issue,
    histories,
    member,
    nonWorkingDays,
    isQaTestingStatus,
    getSprintWindow(sprint),
  );
}

function calculateDevTimeHours(
  issue: JiraIssue,
  histories: JiraIssueHistory[],
  sprint: IssuePipelineSprintContext,
  member: IssuePipelineMember,
  nonWorkingDays: NonWorkingDayRecord[],
): number | null {
  return calculateStatusTimeHours(
    issue,
    histories,
    member,
    nonWorkingDays,
    isInProgressStatus,
    getSprintWindow(sprint),
  );
}

function calculateTotalQaTimeHours(
  issue: JiraIssue,
  histories: JiraIssueHistory[],
  member: IssuePipelineMember,
  nonWorkingDays: NonWorkingDayRecord[],
): number | null {
  return calculateStatusTimeHours(
    issue,
    histories,
    member,
    nonWorkingDays,
    isQaTestingStatus,
    getTotalIssueWindow(issue),
  );
}

function calculateTotalDevTimeHours(
  issue: JiraIssue,
  histories: JiraIssueHistory[],
  member: IssuePipelineMember,
  nonWorkingDays: NonWorkingDayRecord[],
): number | null {
  return calculateStatusTimeHours(
    issue,
    histories,
    member,
    nonWorkingDays,
    isInProgressStatus,
    getTotalIssueWindow(issue),
  );
}

function calculateDevQaRatio(totalDevTimeHours: number | null, totalQaTimeHours: number | null): number | null {
  if (totalDevTimeHours === null || totalQaTimeHours === null || totalQaTimeHours <= 0) {
    return null;
  }

  return Math.round((totalDevTimeHours / totalQaTimeHours) * 100) / 100;
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
  devTimeHours: number | null = null,
  totalDevTimeHours: number | null = null,
  totalQaTimeHours: number | null = null,
  testingTimeHours: number | null = null,
): ProcessedIssue | null {
  const allHistories = sortHistoriesAscending(issue.changelog.histories);
  const filteredHistories = histories ?? sortHistoriesAscending(
    filterHistoriesForSprint(allHistories, sprint.actualEnd),
  );
  const sprintStart = sprint.activatedAt ?? sprint.plannedStart;
  const sprintEnd = sprint.actualEnd ?? new Date();
  const statusAtSprintStart = getStatusAtDate(issue, allHistories, sprintStart);
  const statusAtSprintEnd = getStatusAtDate(issue, allHistories, sprintEnd);

  return {
    key: issue.key,
    title: issue.fields.summary,
    url: `https://${sprint.jiraDomain}/browse/${issue.key}`,
    issueType: issue.fields.issuetype?.name ?? null,
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
    status: statusAtSprintEnd,
    statusAtSprintStart,
    statusAtSprintEnd,
    priority: issue.fields.priority?.name ?? null,
    assigneeEmail,
    devTimeHours,
    totalDevTimeHours,
    totalQaTimeHours,
    devQaRatio: calculateDevQaRatio(totalDevTimeHours, totalQaTimeHours),
    testingTimeHours,
  };
}

export function processSprintIssues(
  issues: JiraIssue[],
  sprint: IssuePipelineSprintContext,
  members: IssuePipelineMember[],
  nonWorkingDaysByMemberId: Record<string, NonWorkingDayRecord[]>,
): DeveloperIssueGroup[] {
  const developerMembers = getDeveloperMembers(members);

  if (!sprint.activatedAt && issues.length > 0) {
    console.warn(
      `[issue-pipeline] Sprint activation date missing for sprint '${sprint.sprintName}'. Falling back to plannedStart for planned/unplanned labeling.`,
    );
  }

  const lookup = buildMemberLookup(developerMembers);

  const groupedIssues = new Map<string, ProcessedIssue[]>();

  for (const issue of issues) {
    if (!issue.fields.assignee) {
      continue;
    }

    const allHistories = sortHistoriesAscending(issue.changelog.histories);
    const filteredHistories = sortHistoriesAscending(
      filterHistoriesForSprint(allHistories, sprint.actualEnd),
    );
    const member = findMemberForIssue(issue, filteredHistories, lookup);

    if (!member) {
      continue;
    }

    const devTimeHours = calculateDevTimeHours(
      issue,
      allHistories,
      sprint,
      member,
      nonWorkingDaysByMemberId[member.id] ?? [],
    );
    const totalDevTimeHours = calculateTotalDevTimeHours(
      issue,
      allHistories,
      member,
      nonWorkingDaysByMemberId[member.id] ?? [],
    );
    const qaLookup = buildMemberLookup(members.filter((candidate) => candidate.specialization.includes('qa')));
    const qaMember = findQaMembersForIssue(issue, allHistories, qaLookup)[0] ?? null;
    const totalQaTimeHours = qaMember
      ? calculateTotalQaTimeHours(
          issue,
          allHistories,
          qaMember,
          nonWorkingDaysByMemberId[qaMember.id] ?? [],
        )
      : null;

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
      devTimeHours,
      totalDevTimeHours,
      totalQaTimeHours,
    );

    if (!processedIssue) {
      continue;
    }

    const existingIssues = groupedIssues.get(member.id) ?? [];
    existingIssues.push(processedIssue);
    groupedIssues.set(member.id, existingIssues);
  }

  return developerMembers
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
  members: IssuePipelineMember[],
  nonWorkingDaysByMemberId: Record<string, NonWorkingDayRecord[]>,
): Map<string, ProcessedIssue[]> {
  const developerMembers = getDeveloperMembers(members);
  const lookup = buildMemberLookup(developerMembers);
  const qaLookup = buildMemberLookup(members.filter((member) => member.specialization.includes('qa')));
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

    const devTimeHours = calculateDevTimeHours(
      issue,
      filteredHistories,
      sprint,
      member,
      nonWorkingDaysByMemberId[member.id] ?? [],
    );
    const totalDevTimeHours = calculateTotalDevTimeHours(
      issue,
      filteredHistories,
      member,
      nonWorkingDaysByMemberId[member.id] ?? [],
    );
    const qaMember = findQaMembersForIssue(issue, filteredHistories, qaLookup)[0] ?? null;
    const totalQaTimeHours = qaMember
      ? calculateTotalQaTimeHours(
          issue,
          filteredHistories,
          qaMember,
          nonWorkingDaysByMemberId[qaMember.id] ?? [],
        )
      : null;

    const processedIssue = toProcessedIssue(
      issue,
      sprint,
      member.jiraEmail,
      'external',
      filteredHistories,
      devTimeHours,
      totalDevTimeHours,
      totalQaTimeHours,
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
  members: IssuePipelineMember[],
  nonWorkingDaysByMemberId: Record<string, NonWorkingDayRecord[]>,
): DeveloperIssueGroup[] {
  const qaMembers = members.filter((member) => member.specialization.includes('qa'));
  const developerLookup = buildMemberLookup(getDeveloperMembers(members));

  if (qaMembers.length === 0) {
    return [];
  }

  const lookup = buildMemberLookup(qaMembers);
  const groupedIssues = new Map<string, ProcessedIssue[]>();

  for (const issue of issues) {
    if (isExcludedQaIssueType(issue)) {
      continue;
    }

    const allHistories = sortHistoriesAscending(issue.changelog.histories);
    const filteredHistories = sortHistoriesAscending(
      filterHistoriesForSprint(allHistories, sprint.actualEnd),
    );
    const matchedMembers = findQaMembersForIssue(issue, filteredHistories, lookup);

    if (matchedMembers.length === 0) {
      continue;
    }

    for (const member of matchedMembers) {
      const developerMember = findMemberForIssue(issue, allHistories, developerLookup);
      const devTimeHours = developerMember
        ? calculateDevTimeHours(
            issue,
            allHistories,
            sprint,
            developerMember,
            nonWorkingDaysByMemberId[developerMember.id] ?? [],
          )
        : null;
      const totalDevTimeHours = developerMember
        ? calculateTotalDevTimeHours(
            issue,
            allHistories,
            developerMember,
            nonWorkingDaysByMemberId[developerMember.id] ?? [],
          )
        : null;
      const testingTimeHours = calculateQaTestingTimeHours(
        issue,
        allHistories,
        sprint,
        member,
        nonWorkingDaysByMemberId[member.id] ?? [],
      );
      const totalQaTimeHours = calculateTotalQaTimeHours(
        issue,
        allHistories,
        member,
        nonWorkingDaysByMemberId[member.id] ?? [],
      );
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
        devTimeHours,
        totalDevTimeHours,
        totalQaTimeHours,
        testingTimeHours,
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
  members: IssuePipelineMember[],
  nonWorkingDaysByMemberId: Record<string, NonWorkingDayRecord[]>,
): Map<string, ProcessedIssue[]> {
  const qaMembers = members.filter((member) => member.specialization.includes('qa'));
  const developerLookup = buildMemberLookup(getDeveloperMembers(members));

  if (qaMembers.length === 0) {
    return new Map<string, ProcessedIssue[]>();
  }

  const lookup = buildMemberLookup(qaMembers);
  const groupedIssues = new Map<string, ProcessedIssue[]>();

  for (const issue of issues) {
    if (isExcludedQaIssueType(issue)) {
      continue;
    }

    const filteredHistories = sortHistoriesAscending(issue.changelog.histories);
    const matchedMembers = findQaMembersForIssue(issue, filteredHistories, lookup);

    if (matchedMembers.length === 0 || !hadMatchingStatusDuringSprint(issue, filteredHistories, sprint, isQaTestingStatus)) {
      continue;
    }

    for (const member of matchedMembers) {
      const developerMember = findMemberForIssue(issue, filteredHistories, developerLookup);
      const devTimeHours = developerMember
        ? calculateDevTimeHours(
            issue,
            filteredHistories,
            sprint,
            developerMember,
            nonWorkingDaysByMemberId[developerMember.id] ?? [],
          )
        : null;
      const totalDevTimeHours = developerMember
        ? calculateTotalDevTimeHours(
            issue,
            filteredHistories,
            developerMember,
            nonWorkingDaysByMemberId[developerMember.id] ?? [],
          )
        : null;
      const testingTimeHours = calculateQaTestingTimeHours(
        issue,
        filteredHistories,
        sprint,
        member,
        nonWorkingDaysByMemberId[member.id] ?? [],
      );
      const totalQaTimeHours = calculateTotalQaTimeHours(
        issue,
        filteredHistories,
        member,
        nonWorkingDaysByMemberId[member.id] ?? [],
      );
      const processedIssue = toProcessedIssue(
        issue,
        sprint,
        member.jiraEmail,
        'external',
        filteredHistories,
        devTimeHours,
        totalDevTimeHours,
        totalQaTimeHours,
        testingTimeHours,
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