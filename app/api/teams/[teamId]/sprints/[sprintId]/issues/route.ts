import { NextResponse } from 'next/server';

import { fetchSprintIssues, JiraRequestError } from '@/lib/jira';
import { processSprintIssues } from '@/lib/issue-pipeline';
import { getSprintIssuesContext, upsertSprintIssueCache } from '@/lib/data/sprint';
import type { ApiResponse, JiraIssue, SprintIssuesResponseData } from '@/types';

interface SprintIssuesRouteProps {
  params: Promise<{
    teamId: string;
    sprintId: string;
  }>;
}

function toResponseData(input: {
  cachedAt: Date | null;
  isStale: boolean;
  issues: JiraIssue[];
  jiraDomain: string;
  members: Parameters<typeof processSprintIssues>[2];
  sprint: Parameters<typeof processSprintIssues>[1];
}): SprintIssuesResponseData {
  return {
    groups: processSprintIssues(input.issues, input.sprint, input.members),
    cachedAt: input.cachedAt ? input.cachedAt.toISOString() : null,
    isStale: input.isStale,
  };
}

export async function GET(
  _request: Request,
  { params }: SprintIssuesRouteProps,
): Promise<NextResponse<ApiResponse<SprintIssuesResponseData>>> {
  try {
    const { sprintId, teamId } = await params;
    const context = await getSprintIssuesContext(teamId, sprintId);

    if (!context) {
      return NextResponse.json({ error: { message: 'Sprint not found.' } }, { status: 404 });
    }

    if (context.cache) {
      return NextResponse.json({
        data: toResponseData({
          cachedAt: context.cache.fetchedAt,
          isStale: false,
          issues: context.cache.data,
          jiraDomain: context.team.jiraDomain,
          members: context.members,
          sprint: {
            actualEnd: context.sprint.actualEnd,
            activatedAt: context.sprint.activatedAt,
            jiraDomain: context.team.jiraDomain,
            plannedStart: context.sprint.plannedStart,
            sprintJiraId: context.sprint.jiraSprintId,
            sprintName: context.sprint.name,
            storyPointsFieldId: context.storyPointsFieldId,
          },
        }),
      });
    }

    const freshIssues = await fetchSprintIssues(context.sprint.jiraSprintId);
    const fetchedAt = await upsertSprintIssueCache(context.sprint.id, freshIssues);

    return NextResponse.json({
      data: toResponseData({
        cachedAt: fetchedAt,
        isStale: false,
        issues: freshIssues,
        jiraDomain: context.team.jiraDomain,
        members: context.members,
        sprint: {
          actualEnd: context.sprint.actualEnd,
          activatedAt: context.sprint.activatedAt,
          jiraDomain: context.team.jiraDomain,
          plannedStart: context.sprint.plannedStart,
          sprintJiraId: context.sprint.jiraSprintId,
          sprintName: context.sprint.name,
          storyPointsFieldId: context.storyPointsFieldId,
        },
      }),
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
    const { sprintId, teamId } = await params;
    const context = await getSprintIssuesContext(teamId, sprintId);

    if (!context) {
      return NextResponse.json({ error: { message: 'Sprint not found.' } }, { status: 404 });
    }

    const freshIssues = await fetchSprintIssues(context.sprint.jiraSprintId);
    const fetchedAt = await upsertSprintIssueCache(context.sprint.id, freshIssues);

    return NextResponse.json({
      data: toResponseData({
        cachedAt: fetchedAt,
        isStale: false,
        issues: freshIssues,
        jiraDomain: context.team.jiraDomain,
        members: context.members,
        sprint: {
          actualEnd: context.sprint.actualEnd,
          activatedAt: context.sprint.activatedAt,
          jiraDomain: context.team.jiraDomain,
          plannedStart: context.sprint.plannedStart,
          sprintJiraId: context.sprint.jiraSprintId,
          sprintName: context.sprint.name,
          storyPointsFieldId: context.storyPointsFieldId,
        },
      }),
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