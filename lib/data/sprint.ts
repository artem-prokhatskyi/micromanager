import { unstable_noStore as noStore } from 'next/cache';

import { Prisma } from '@prisma/client';

import {
  actualEndDate,
  actualStartDate,
  calculateCapacity,
  isSprintOverdue,
  summarizeAbsencesByType,
  workingDaysInRange,
} from '@/lib/capacity';
import { buildAccessibleTeamWhere, getCurrentUserOrNull } from '@/lib/auth';
import { createEmptyGithubSprintMetrics, getGithubSprintMetricsByUsername } from '@/lib/github';
import { prisma } from '@/lib/prisma';
import { getTeamDetail, getTeamMembers } from '@/lib/data/team';
import type {
  GithubSprintMetrics,
  MemberCapacityData,
  NonWorkingDayRecord,
  SprintDashboardData,
  IssueGroupMember,
  JiraIssue,
  SprintListItem,
  SprintOption,
  SprintRecord,
} from '@/types';

interface CachedSprintIssuesPayload {
  externalIssues: JiraIssue[];
  sprintIssues: JiraIssue[];
}

interface CachedSprintGithubMetricsPayload {
  metricsByUsername: Record<string, GithubSprintMetrics>;
}

const GITHUB_METRICS_CACHE_TTL_MS = 15 * 60 * 1000;

async function getAccessibleTeamWhere(): Promise<Prisma.TeamWhereInput | null> {
  const currentUser = await getCurrentUserOrNull();

  if (!currentUser) {
    return null;
  }

  return buildAccessibleTeamWhere(currentUser);
}

function toSprintListItem(sprint: SprintRecord): SprintListItem {
  return {
    ...sprint,
    isOverdue: isSprintOverdue(sprint),
  };
}

function isJiraIssue(value: unknown): value is JiraIssue {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.key === 'string'
    && typeof candidate.fields === 'object'
    && candidate.fields !== null
    && typeof candidate.changelog === 'object'
    && candidate.changelog !== null
  );
}

function readCachedJiraIssues(value: Prisma.JsonValue): JiraIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<JiraIssue[]>((issues, entry) => {
    if (isJiraIssue(entry)) {
      issues.push(entry);
    }

    return issues;
  }, []);
}

function isCachedSprintIssuesPayload(value: unknown): value is Record<string, Prisma.JsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return 'sprintIssues' in value || 'externalIssues' in value;
}

function readCachedSprintIssuesPayload(value: Prisma.JsonValue): CachedSprintIssuesPayload {
  if (isCachedSprintIssuesPayload(value)) {
    return {
      externalIssues: readCachedJiraIssues(value.externalIssues ?? []),
      sprintIssues: readCachedJiraIssues(value.sprintIssues ?? []),
    };
  }

  return {
    externalIssues: [],
    sprintIssues: readCachedJiraIssues(value),
  };
}

function toPrismaJsonValue(value: CachedSprintIssuesPayload): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isGithubSprintMetrics(value: unknown): value is GithubSprintMetrics {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    (typeof candidate.averageCommentsPerPullRequest === 'number' || candidate.averageCommentsPerPullRequest === null)
    && (typeof candidate.averageReviewTimeHours === 'number' || candidate.averageReviewTimeHours === null)
    && typeof candidate.approvedPullRequests === 'number'
    && typeof candidate.mergedPullRequests === 'number'
    && typeof candidate.openedPullRequests === 'number'
    && typeof candidate.submittedReviews === 'number'
  );
}

function readCachedSprintGithubMetricsPayload(value: Prisma.JsonValue): CachedSprintGithubMetricsPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { metricsByUsername: {} };
  }

  const candidate = value as Record<string, unknown>;
  const metricsRecord = candidate.metricsByUsername;

  if (typeof metricsRecord !== 'object' || metricsRecord === null || Array.isArray(metricsRecord)) {
    return { metricsByUsername: {} };
  }

  return {
    metricsByUsername: Object.entries(metricsRecord).reduce<Record<string, GithubSprintMetrics>>((accumulator, [username, metrics]) => {
      if (isGithubSprintMetrics(metrics)) {
        accumulator[username] = metrics;
      }

      return accumulator;
    }, {}),
  };
}

function toGithubMetricsPrismaJsonValue(value: CachedSprintGithubMetricsPayload): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function getTeamSprints(teamId: string): Promise<SprintListItem[]> {
  noStore();

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return [];
  }

  const sprints = await prisma.sprint.findMany({
    where: {
      team: accessibleWhere,
      teamId,
    },
    select: {
      id: true,
      teamId: true,
      jiraSprintId: true,
      name: true,
      plannedStart: true,
      plannedEnd: true,
      actualEnd: true,
      activatedAt: true,
    },
    orderBy: {
      plannedStart: 'desc',
    },
  });

  return sprints.map(toSprintListItem);
}

export async function getLatestSprint(teamId: string): Promise<Pick<SprintRecord, 'id'> | null> {
  noStore();

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return null;
  }

  return prisma.sprint.findFirst({
    where: {
      team: accessibleWhere,
      teamId,
    },
    select: {
      id: true,
    },
    orderBy: {
      plannedStart: 'desc',
    },
  });
}

export async function getSprintById(teamId: string, sprintId: string): Promise<SprintListItem | null> {
  noStore();

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return null;
  }

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      team: accessibleWhere,
      teamId,
    },
    select: {
      id: true,
      teamId: true,
      jiraSprintId: true,
      name: true,
      plannedStart: true,
      plannedEnd: true,
      actualEnd: true,
      activatedAt: true,
    },
  });

  return sprint ? toSprintListItem(sprint) : null;
}

export async function getSprintSelectorOptions(teamId: string): Promise<SprintOption[]> {
  noStore();

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return [];
  }

  return prisma.sprint.findMany({
    where: {
      team: accessibleWhere,
      teamId,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      plannedStart: 'desc',
    },
  });
}

export async function getSprintDashboardData(
  teamId: string,
  sprintId: string,
): Promise<SprintDashboardData | null> {
  noStore();

  const [team, sprint, sprints, members] = await Promise.all([
    getTeamDetail(teamId),
    getSprintById(teamId, sprintId),
    getSprintSelectorOptions(teamId),
    getTeamMembers(teamId),
  ]);

  if (!team || !sprint) {
    return null;
  }

  const sprintStartForCapacity = actualStartDate(sprint);
  const sprintEndForActuals = actualEndDate(sprint);
  const memberIds = members.map((member) => member.id);

  const [focusFactorOverrides, nonWorkingDays, githubMetricsCache] = await Promise.all([
    prisma.sprintFocusFactor.findMany({
      where: {
        sprintId,
      },
      select: {
        memberId: true,
        focusFactor: true,
      },
    }),
    prisma.nonWorkingDay.findMany({
      where: {
        teamId,
        memberId: {
          in: memberIds,
        },
        date: {
          gte: sprintStartForCapacity,
          lte: sprintEndForActuals,
        },
      },
      select: {
        id: true,
        memberId: true,
        teamId: true,
        date: true,
        type: true,
        halfDay: true,
      },
    }),
    prisma.sprintGithubMetricsCache.findUnique({
      where: {
        sprintId,
      },
      select: {
        data: true,
        fetchedAt: true,
      },
    }),
  ]);

  const cachedGithubMetrics = githubMetricsCache
    ? readCachedSprintGithubMetricsPayload(githubMetricsCache.data)
    : null;
  const canUseCachedGithubMetrics = Boolean(
    cachedGithubMetrics
    && githubMetricsCache
    && (Date.now() - githubMetricsCache.fetchedAt.getTime()) < GITHUB_METRICS_CACHE_TTL_MS,
  );
  const githubMetricsResult = canUseCachedGithubMetrics && cachedGithubMetrics
    ? {
        available: true,
        metricsByUsername: new Map<string, GithubSprintMetrics>(Object.entries(cachedGithubMetrics.metricsByUsername)),
      }
    : await getGithubSprintMetricsByUsername({
        repositories: team.githubRepositories,
        sprintEnd: sprintEndForActuals,
        sprintStart: sprintStartForCapacity,
        usernames: members.map((member) => member.githubUsername),
      });

  if (githubMetricsResult.available && (!canUseCachedGithubMetrics || !cachedGithubMetrics)) {
    await upsertSprintGithubMetricsCache(sprintId, {
      metricsByUsername: Object.fromEntries(githubMetricsResult.metricsByUsername.entries()),
    });
  }
  const githubMetricsToUse = !githubMetricsResult.available && cachedGithubMetrics
    ? {
        available: true,
        metricsByUsername: new Map<string, GithubSprintMetrics>(Object.entries(cachedGithubMetrics.metricsByUsername)),
      }
    : githubMetricsResult;

  const overridesByMemberId = new Map<string, number>(
    focusFactorOverrides.map((override) => [override.memberId, override.focusFactor]),
  );
  const normalizedNonWorkingDays: NonWorkingDayRecord[] = nonWorkingDays.map((record) => ({
    ...record,
    date: record.date.toISOString(),
  }));
  const emptyGithubMetrics: GithubSprintMetrics = createEmptyGithubSprintMetrics();

  const memberCapacityRows = members.map<MemberCapacityData>((member) => {
    const memberNonWorkingDays = normalizedNonWorkingDays.filter(
      (record) => record.memberId === member.id,
    );
    const plannedNonWorkingDays = memberNonWorkingDays.filter((record) => {
      const date = new Date(record.date);

      return date >= sprintStartForCapacity && date <= sprint.plannedEnd;
    });
    const focusFactor = overridesByMemberId.get(member.id) ?? member.defaultFocusFactor;
    const plannedWorkingDays = workingDaysInRange(
      member.workingDays,
      plannedNonWorkingDays,
      sprintStartForCapacity,
      sprint.plannedEnd,
    );
    const plannedCapacity = calculateCapacity(plannedWorkingDays, focusFactor);
    const actualWorkingDays = sprint.isOverdue
      ? workingDaysInRange(
          member.workingDays,
          memberNonWorkingDays,
          sprintStartForCapacity,
          sprintEndForActuals,
        )
      : null;
    const actualCapacity = actualWorkingDays === null
      ? null
      : calculateCapacity(actualWorkingDays, focusFactor);
    const normalizedGithubUsername = member.githubUsername.trim().toLowerCase();

    return {
      memberId: member.id,
      name: member.name,
      specialization: member.specialization,
      plannedWorkingDays,
      focusFactor,
      plannedCapacity,
      actualWorkingDays,
      actualCapacity,
      absenceSummary: summarizeAbsencesByType(memberNonWorkingDays),
      githubMetrics: githubMetricsToUse.available && normalizedGithubUsername
        ? githubMetricsToUse.metricsByUsername.get(normalizedGithubUsername) ?? emptyGithubMetrics
        : null,
    };
  });

  return {
    team,
    sprint,
    sprints,
    members: memberCapacityRows,
    totals: {
      plannedCapacity: memberCapacityRows.reduce(
        (total, member) => total + member.plannedCapacity,
        0,
      ),
      actualCapacity: sprint.isOverdue
        ? memberCapacityRows.reduce(
            (total, member) => total + (member.actualCapacity ?? 0),
            0,
          )
        : null,
    },
  };
}

export interface SprintIssuesContext {
  cache: {
    externalIssues: JiraIssue[];
    sprintIssues: JiraIssue[];
    fetchedAt: Date;
  } | null;
  members: IssueGroupMember[];
  sprint: SprintListItem;
  storyPointsFieldId: string;
  team: {
    estimateInHours: boolean;
    id: string;
    jiraDomain: string;
    jiraSpace: string;
  };
}

export async function getSprintIssuesContext(
  teamId: string,
  sprintId: string,
): Promise<SprintIssuesContext | null> {
  noStore();

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return null;
  }

  const [sprint, team, members, settings] = await Promise.all([
    prisma.sprint.findFirst({
      where: {
        id: sprintId,
        team: accessibleWhere,
        teamId,
      },
      select: {
        id: true,
        teamId: true,
        jiraSprintId: true,
        name: true,
        plannedStart: true,
        plannedEnd: true,
        actualEnd: true,
        activatedAt: true,
        issueCache: {
          select: {
            data: true,
            fetchedAt: true,
          },
        },
      },
    }),
    prisma.team.findFirst({
      where: {
        ...accessibleWhere,
        id: teamId,
      },
      select: {
        estimateInHours: true,
        id: true,
        jiraSpace: true,
      },
    }),
    getTeamMembers(teamId),
    prisma.settings.findFirst({
      select: {
        jiraDomain: true,
        storyPointsFieldId: true,
      },
    }),
  ]);

  if (!sprint || !team || !settings?.jiraDomain) {
    return null;
  }

  return {
    cache: sprint.issueCache
      ? {
          ...readCachedSprintIssuesPayload(sprint.issueCache.data),
          fetchedAt: sprint.issueCache.fetchedAt,
        }
      : null,
    members: members.map((member) => ({
      id: member.id,
      jiraEmail: member.jiraEmail,
      name: member.name,
      specialization: member.specialization,
    })),
    sprint: toSprintListItem(sprint),
    storyPointsFieldId: settings.storyPointsFieldId || 'story_points',
    team: {
      estimateInHours: team.estimateInHours,
      id: team.id,
      jiraDomain: settings.jiraDomain,
      jiraSpace: team.jiraSpace,
    },
  };
}

export async function upsertSprintIssueCache(
  sprintId: string,
  data: CachedSprintIssuesPayload,
): Promise<Date> {
  const issueCache = await prisma.sprintIssueCache.upsert({
    where: {
      sprintId,
    },
    create: {
      sprintId,
      data: toPrismaJsonValue(data),
      fetchedAt: new Date(),
    },
    update: {
      data: toPrismaJsonValue(data),
      fetchedAt: new Date(),
    },
    select: {
      fetchedAt: true,
    },
  });

  return issueCache.fetchedAt;
}

export async function upsertSprintGithubMetricsCache(
  sprintId: string,
  data: CachedSprintGithubMetricsPayload,
): Promise<Date> {
  const githubMetricsCache = await prisma.sprintGithubMetricsCache.upsert({
    where: {
      sprintId,
    },
    create: {
      sprintId,
      data: toGithubMetricsPrismaJsonValue(data),
      fetchedAt: new Date(),
    },
    update: {
      data: toGithubMetricsPrismaJsonValue(data),
      fetchedAt: new Date(),
    },
    select: {
      fetchedAt: true,
    },
  });

  return githubMetricsCache.fetchedAt;
}