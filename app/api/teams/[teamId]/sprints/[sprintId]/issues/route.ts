import { NextResponse } from 'next/server';

import { getAccessibleTeamId, getCurrentUserOrNull } from '@/lib/auth';
import { fetchAssignedIssuesOutsideProject, fetchSprintIssues, JiraRequestError } from '@/lib/jira';
import {
  processExternalInProgressIssues,
  processQaExternalInProgressIssues,
  processQaSprintIssues,
  processSprintIssues,
} from '@/lib/issue-pipeline';
import { getSprintIssuesContext, upsertSprintIssueCache } from '@/lib/data/sprint';
import type { ApiResponse, DeveloperIssueGroup, JiraIssue, NonWorkingDayRecord, ProcessedIssue, SprintIssuesResponseData } from '@/types';

interface SprintIssuesRouteProps {
  params: Promise<{
    teamId: string;
    sprintId: string;
  }>;
}

function hasIssueTypeInCache(issues: JiraIssue[]): boolean {
  return issues.every((issue) => 'issuetype' in issue.fields);
}

function toResponseData(input: {
  cachedAt: Date | null;
  externalIssues?: JiraIssue[];
  isStale: boolean;
  issues: JiraIssue[];
  jiraDomain: string;
  members: Parameters<typeof processSprintIssues>[2];
  nonWorkingDaysByMemberId: Record<string, NonWorkingDayRecord[]>;
  sprint: Parameters<typeof processSprintIssues>[1];
}): SprintIssuesResponseData {
  const sprintGroups = processSprintIssues(input.issues, input.sprint, input.members);
  const qaSprintGroups = processQaSprintIssues(
    input.issues,
    input.sprint,
    input.members,
    input.nonWorkingDaysByMemberId,
  );
  const externalIssues = input.externalIssues ?? [];

  const mergeExternalIssues = (
    groups: DeveloperIssueGroup[],
    groupedExternalIssues: Map<string, ProcessedIssue[]>,
    members: typeof input.members,
  ): DeveloperIssueGroup[] => {
    const groupsByMemberId = new Map<string, DeveloperIssueGroup>(
      groups.map((group) => [group.member.id, group]),
    );

    for (const member of members) {
      const externalInProgressIssues = groupedExternalIssues.get(member.id) ?? [];
      const existingGroup = groupsByMemberId.get(member.id);

      if (existingGroup) {
        existingGroup.externalInProgressIssues = externalInProgressIssues;
        continue;
      }

      if (externalInProgressIssues.length === 0) {
        continue;
      }

      groupsByMemberId.set(member.id, {
        member,
        externalInProgressIssues,
        issues: [],
        totalStoryPoints: 0,
      });
    }

    return members
      .map((member) => groupsByMemberId.get(member.id) ?? null)
      .filter((group): group is DeveloperIssueGroup => group !== null);
  };

  if (externalIssues.length > 0) {
    const groupedExternalIssues = processExternalInProgressIssues(
      externalIssues,
      input.sprint,
      input.members,
    );
    const groupedQaExternalIssues = processQaExternalInProgressIssues(
      externalIssues,
      input.sprint,
      input.members,
      input.nonWorkingDaysByMemberId,
    );
    const qaMembers = input.members.filter((member) => member.specialization.includes('qa'));

    return {
      groups: mergeExternalIssues(sprintGroups, groupedExternalIssues, input.members),
      qaGroups: mergeExternalIssues(qaSprintGroups, groupedQaExternalIssues, qaMembers),
      cachedAt: input.cachedAt ? input.cachedAt.toISOString() : null,
      isStale: input.isStale,
    };
  }

  return {
    groups: sprintGroups,
    qaGroups: qaSprintGroups,
    cachedAt: input.cachedAt ? input.cachedAt.toISOString() : null,
    isStale: input.isStale,
  };
}

async function fetchExternalIssues(
  input: {
    members: Parameters<typeof processSprintIssues>[2];
    sprint: Parameters<typeof processSprintIssues>[1];
    teamJiraSpace: string;
  },
): Promise<JiraIssue[]> {
  let externalIssues: Array<{ issues: JiraIssue[]; memberId: string }>;

  try {
    externalIssues = await Promise.all(
      input.members.map(async (member) => ({
        issues: await fetchAssignedIssuesOutsideProject({
          assigneeEmail: member.jiraEmail,
          excludedProjectKey: input.teamJiraSpace,
          includeQaField: member.specialization.includes('qa'),
          sprintEnd: input.sprint.actualEnd ?? new Date(),
          sprintStart: input.sprint.activatedAt ?? input.sprint.plannedStart,
        }),
        memberId: member.id,
      })),
    );
  } catch (error) {
    if (error instanceof JiraRequestError) {
      console.warn(
        `[API /teams/:teamId/sprints/:sprintId/issues] External Jira issue lookup skipped: ${error.message}`,
      );

      return [];
    }

    throw error;
  }

  return [...new Map(externalIssues.flatMap((entry) => entry.issues).map((issue) => [issue.key, issue])).values()];
}

export async function GET(
  _request: Request,
  { params }: SprintIssuesRouteProps,
): Promise<NextResponse<ApiResponse<SprintIssuesResponseData>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    const { sprintId, teamId } = await params;
    const team = await getAccessibleTeamId(teamId, currentUser);

    if (!team) {
      return NextResponse.json({ error: { message: 'Team not found.' } }, { status: 404 });
    }

    const context = await getSprintIssuesContext(teamId, sprintId);

    if (!context) {
      return NextResponse.json({ error: { message: 'Sprint not found.' } }, { status: 404 });
    }

    if (
      context.cache
      && hasIssueTypeInCache(context.cache.sprintIssues)
      && hasIssueTypeInCache(context.cache.externalIssues)
    ) {
      const responseData = toResponseData({
        cachedAt: context.cache.fetchedAt,
        externalIssues: context.cache.externalIssues,
        isStale: false,
        issues: context.cache.sprintIssues,
        jiraDomain: context.team.jiraDomain,
        members: context.members,
        nonWorkingDaysByMemberId: context.nonWorkingDaysByMemberId,
        sprint: {
          actualEnd: context.sprint.actualEnd,
          activatedAt: context.sprint.activatedAt,
          estimateInHours: context.team.estimateInHours,
          jiraDomain: context.team.jiraDomain,
          plannedEnd: context.sprint.plannedEnd,
          plannedStart: context.sprint.plannedStart,
          sprintJiraId: context.sprint.jiraSprintId,
          sprintName: context.sprint.name,
          storyPointsFieldId: context.storyPointsFieldId,
        },
      });

      return NextResponse.json({
        data: responseData,
      });
    }

    const freshIssues = await fetchSprintIssues(context.sprint.jiraSprintId);
    const externalIssues = await fetchExternalIssues({
      members: context.members,
      sprint: {
        actualEnd: context.sprint.actualEnd,
        activatedAt: context.sprint.activatedAt,
        estimateInHours: context.team.estimateInHours,
        jiraDomain: context.team.jiraDomain,
        plannedStart: context.sprint.plannedStart,
        plannedEnd: context.sprint.plannedEnd,
        sprintJiraId: context.sprint.jiraSprintId,
        sprintName: context.sprint.name,
        storyPointsFieldId: context.storyPointsFieldId,
      },
      teamJiraSpace: context.team.jiraSpace,
    });
    const fetchedAt = await upsertSprintIssueCache(context.sprint.id, {
      externalIssues,
      sprintIssues: freshIssues,
    });
    const responseData = toResponseData({
      cachedAt: fetchedAt,
      externalIssues,
      isStale: false,
      issues: freshIssues,
      jiraDomain: context.team.jiraDomain,
      members: context.members,
      nonWorkingDaysByMemberId: context.nonWorkingDaysByMemberId,
      sprint: {
        actualEnd: context.sprint.actualEnd,
        activatedAt: context.sprint.activatedAt,
        estimateInHours: context.team.estimateInHours,
        jiraDomain: context.team.jiraDomain,
        plannedEnd: context.sprint.plannedEnd,
        plannedStart: context.sprint.plannedStart,
        sprintJiraId: context.sprint.jiraSprintId,
        sprintName: context.sprint.name,
        storyPointsFieldId: context.storyPointsFieldId,
      },
    });

    return NextResponse.json({
      data: responseData,
    });
  } catch (error) {
    console.error('[API /teams/:teamId/sprints/:sprintId/issues GET]', error);

    if (error instanceof JiraRequestError) {
      return NextResponse.json(
        { error: { message: error.message, code: 'JIRA_REQUEST_FAILED' } },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: { message: 'Failed to load sprint issues.' } },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: Request,
  { params }: SprintIssuesRouteProps,
): Promise<NextResponse<ApiResponse<SprintIssuesResponseData>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    const { sprintId, teamId } = await params;
    const team = await getAccessibleTeamId(teamId, currentUser);

    if (!team) {
      return NextResponse.json({ error: { message: 'Team not found.' } }, { status: 404 });
    }

    const context = await getSprintIssuesContext(teamId, sprintId);

    if (!context) {
      return NextResponse.json({ error: { message: 'Sprint not found.' } }, { status: 404 });
    }

    const freshIssues = await fetchSprintIssues(context.sprint.jiraSprintId);
    const externalIssues = await fetchExternalIssues({
      members: context.members,
      sprint: {
        actualEnd: context.sprint.actualEnd,
        activatedAt: context.sprint.activatedAt,
        estimateInHours: context.team.estimateInHours,
        jiraDomain: context.team.jiraDomain,
        plannedStart: context.sprint.plannedStart,
        plannedEnd: context.sprint.plannedEnd,
        sprintJiraId: context.sprint.jiraSprintId,
        sprintName: context.sprint.name,
        storyPointsFieldId: context.storyPointsFieldId,
      },
      teamJiraSpace: context.team.jiraSpace,
    });
    const fetchedAt = await upsertSprintIssueCache(context.sprint.id, {
      externalIssues,
      sprintIssues: freshIssues,
    });
    const responseData = toResponseData({
      cachedAt: fetchedAt,
      externalIssues,
      isStale: false,
      issues: freshIssues,
      jiraDomain: context.team.jiraDomain,
      members: context.members,
      nonWorkingDaysByMemberId: context.nonWorkingDaysByMemberId,
      sprint: {
        actualEnd: context.sprint.actualEnd,
        activatedAt: context.sprint.activatedAt,
        estimateInHours: context.team.estimateInHours,
        jiraDomain: context.team.jiraDomain,
        plannedEnd: context.sprint.plannedEnd,
        plannedStart: context.sprint.plannedStart,
        sprintJiraId: context.sprint.jiraSprintId,
        sprintName: context.sprint.name,
        storyPointsFieldId: context.storyPointsFieldId,
      },
    });

    return NextResponse.json({
      data: responseData,
    });
  } catch (error) {
    console.error('[API /teams/:teamId/sprints/:sprintId/issues POST]', error);

    if (error instanceof JiraRequestError) {
      return NextResponse.json(
        { error: { message: error.message, code: 'JIRA_REQUEST_FAILED' } },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: { message: 'Failed to refresh sprint issues.' } },
      { status: 500 },
    );
  }
}