import { unstable_noStore as noStore } from 'next/cache';

import { Prisma } from '@prisma/client';

import {
  actualEndDate,
  calculateCapacity,
  isSprintOverdue,
  summarizeAbsencesByType,
  workingDaysInRange,
} from '@/lib/capacity';
import { prisma } from '@/lib/prisma';
import { getTeamDetail, getTeamMembers } from '@/lib/data/team';
import type {
  MemberCapacityData,
  NonWorkingDayRecord,
  SprintDashboardData,
  IssueGroupMember,
  JiraIssue,
  SprintListItem,
  SprintOption,
  SprintRecord,
} from '@/types';

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

function toPrismaJsonValue(value: JiraIssue[]): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function getTeamSprints(teamId: string): Promise<SprintListItem[]> {
  noStore();

  const sprints = await prisma.sprint.findMany({
    where: {
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

  return prisma.sprint.findFirst({
    where: {
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

  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
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

  return prisma.sprint.findMany({
    where: {
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

  const sprintEndForActuals = actualEndDate(sprint);
  const memberIds = members.map((member) => member.id);

  const [focusFactorOverrides, nonWorkingDays] = await Promise.all([
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
          gte: sprint.plannedStart,
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
  ]);

  const overridesByMemberId = new Map<string, number>(
    focusFactorOverrides.map((override) => [override.memberId, override.focusFactor]),
  );
  const normalizedNonWorkingDays: NonWorkingDayRecord[] = nonWorkingDays.map((record) => ({
    ...record,
    date: record.date.toISOString(),
  }));

  const memberCapacityRows = members.map<MemberCapacityData>((member) => {
    const memberNonWorkingDays = normalizedNonWorkingDays.filter(
      (record) => record.memberId === member.id,
    );
    const plannedNonWorkingDays = memberNonWorkingDays.filter((record) => {
      const date = new Date(record.date);

      return date >= sprint.plannedStart && date <= sprint.plannedEnd;
    });
    const focusFactor = overridesByMemberId.get(member.id) ?? member.defaultFocusFactor;
    const plannedWorkingDays = workingDaysInRange(
      member.workingDays,
      plannedNonWorkingDays,
      sprint.plannedStart,
      sprint.plannedEnd,
    );
    const plannedCapacity = calculateCapacity(plannedWorkingDays, focusFactor);
    const actualWorkingDays = sprint.isOverdue
      ? workingDaysInRange(
          member.workingDays,
          memberNonWorkingDays,
          sprint.plannedStart,
          sprintEndForActuals,
        )
      : null;
    const actualCapacity = actualWorkingDays === null
      ? null
      : calculateCapacity(actualWorkingDays, focusFactor);

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
    data: JiraIssue[];
    fetchedAt: Date;
  } | null;
  members: IssueGroupMember[];
  sprint: SprintListItem;
  storyPointsFieldId: string;
  team: {
    id: string;
    jiraDomain: string;
  };
}

export async function getSprintIssuesContext(
  teamId: string,
  sprintId: string,
): Promise<SprintIssuesContext | null> {
  noStore();

  const [sprint, team, members, settings] = await Promise.all([
    prisma.sprint.findFirst({
      where: {
        id: sprintId,
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
    prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
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
          data: readCachedJiraIssues(sprint.issueCache.data),
          fetchedAt: sprint.issueCache.fetchedAt,
        }
      : null,
    members: members.map((member) => ({
      id: member.id,
      jiraEmail: member.jiraEmail,
      name: member.name,
    })),
    sprint: toSprintListItem(sprint),
    storyPointsFieldId: settings.storyPointsFieldId || 'story_points',
    team: {
      id: team.id,
      jiraDomain: settings.jiraDomain,
    },
  };
}

export async function upsertSprintIssueCache(
  sprintId: string,
  data: JiraIssue[],
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