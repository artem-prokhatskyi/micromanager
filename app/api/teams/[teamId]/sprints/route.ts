import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getTeamSprints } from '@/lib/data/sprint';
import { findAvailableSprints, findSprintsByName, JiraRequestError, resolveJiraSprintDates } from '@/lib/jira';
import { prisma } from '@/lib/prisma';
import type { ApiResponse, JiraSprintMetadata, SprintListItem, SprintRecord } from '@/types';

const createSprintSchema = z.object({
  sprintName: z.string().trim().optional(),
  jiraSprintId: z.coerce.number().int().positive('Select a sprint to add.'),
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

interface AvailableSprintOption extends JiraSprintMetadata {
  alreadyAdded: false;
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
  const dates = resolveJiraSprintDates(sprint);

  return {
    teamId,
    jiraSprintId: sprint.id,
    name: sprint.name,
    plannedStart: dates.plannedStart,
    plannedEnd: dates.plannedEnd,
    actualEnd: dates.actualEnd,
    activatedAt: dates.activatedAt,
  };
}

export async function GET(
  request: Request,
  { params }: SprintsRouteProps,
): Promise<NextResponse<ApiResponse<SprintListItem[] | AvailableSprintOption[]>>> {
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

    const scope = new URL(request.url).searchParams.get('scope');

    if (scope === 'available') {
      const availableSprints = await findAvailableSprints(team.jiraSpace);
      const existingSprints = await prisma.sprint.findMany({
        where: {
          teamId,
        },
        select: {
          jiraSprintId: true,
        },
      });
      const existingSprintIds = new Set(existingSprints.map((sprint) => sprint.jiraSprintId));

      return NextResponse.json({
        data: availableSprints
          .filter((sprint) => !existingSprintIds.has(sprint.id))
          .map((sprint) => ({
            ...sprint,
            alreadyAdded: false as const,
          })),
      });
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

    const availableSprints = await findAvailableSprints(team.jiraSpace);
    const matchedSprint = availableSprints.find((sprint) => sprint.id === result.data.jiraSprintId);

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