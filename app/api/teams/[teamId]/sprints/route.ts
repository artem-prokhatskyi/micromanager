import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getTeamSprints } from '@/lib/data/sprint';
import { findSprintsByName, JiraRequestError } from '@/lib/jira';
import { prisma } from '@/lib/prisma';
import type { ApiResponse, JiraSprintMetadata, SprintListItem, SprintRecord } from '@/types';

const createSprintSchema = z.object({
  sprintName: z.string().trim().min(1, 'Sprint name is required.'),
  jiraSprintId: z.coerce.number().int().positive().optional(),
});

interface SprintsRouteProps {
  params: Promise<{
    teamId: string;
  }>;
}

interface MultipleSprintMatches {
  multiple: true;
  options: JiraSprintMetadata[];
}

function mapValidationErrors(error: z.ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((accumulator, issue) => {
    const path = issue.path[0];

    if (typeof path === 'string' && !accumulator[path]) {
      accumulator[path] = issue.message;
    }

    return accumulator;
  }, {});
}

function toSprintCreateData(teamId: string, sprint: JiraSprintMetadata): Pick<SprintRecord, 'teamId' | 'jiraSprintId' | 'name' | 'plannedStart' | 'plannedEnd' | 'actualEnd' | 'activatedAt'> {
  return {
    teamId,
    jiraSprintId: sprint.id,
    name: sprint.name,
    plannedStart: new Date(sprint.startDate),
    plannedEnd: new Date(sprint.endDate),
    actualEnd: sprint.completeDate ? new Date(sprint.completeDate) : null,
    activatedAt: sprint.activatedDate ? new Date(sprint.activatedDate) : null,
  };
}

export async function GET(
  _request: Request,
  { params }: SprintsRouteProps,
): Promise<NextResponse<ApiResponse<SprintListItem[]>>> {
  try {
    const { teamId } = await params;
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: { message: 'Team not found.' } }, { status: 404 });
    }

    const sprints = await getTeamSprints(teamId);

    return NextResponse.json({ data: sprints });
  } catch (error) {
    console.error('[API /teams/:teamId/sprints GET]', error);

    return NextResponse.json(
      { error: { message: 'Failed to load sprints.' } },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: SprintsRouteProps,
): Promise<NextResponse<ApiResponse<SprintRecord | MultipleSprintMatches>>> {
  try {
    const { teamId } = await params;
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
        jiraSpace: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: { message: 'Team not found.' } }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const result = createSprintSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid sprint input.',
            code: 'VALIDATION_ERROR',
            details: mapValidationErrors(result.error),
          },
        },
        { status: 400 },
      );
    }

    const sprintMatches = await findSprintsByName(team.jiraSpace, result.data.sprintName);

    if (sprintMatches.length === 0) {
      return NextResponse.json(
        {
          error: {
            message: `Sprint '${result.data.sprintName}' not found in Jira.`,
          },
        },
        { status: 404 },
      );
    }

    if (result.data.jiraSprintId === undefined && sprintMatches.length > 1) {
      return NextResponse.json({ data: { multiple: true, options: sprintMatches } });
    }

    const matchedSprint = result.data.jiraSprintId === undefined
      ? sprintMatches[0]
      : sprintMatches.find((sprint) => sprint.id === result.data.jiraSprintId);

    if (!matchedSprint) {
      return NextResponse.json(
        { error: { message: 'Selected Jira sprint is no longer available for this team.' } },
        { status: 404 },
      );
    }

    const existingSprint = await prisma.sprint.findFirst({
      where: {
        teamId,
        jiraSprintId: matchedSprint.id,
      },
      select: {
        id: true,
      },
    });

    if (existingSprint) {
      return NextResponse.json(
        { error: { message: 'This sprint has already been added for the selected team.' } },
        { status: 409 },
      );
    }

    const sprint = await prisma.sprint.create({
      data: toSprintCreateData(teamId, matchedSprint),
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

    return NextResponse.json({ data: sprint }, { status: 201 });
  } catch (error) {
    console.error('[API /teams/:teamId/sprints POST]', error);

    if (error instanceof JiraRequestError) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            code: 'JIRA_REQUEST_FAILED',
          },
        },
        { status: error.status === 400 ? 400 : 502 },
      );
    }

    return NextResponse.json(
      { error: { message: 'Failed to create sprint.' } },
      { status: 500 },
    );
  }
}