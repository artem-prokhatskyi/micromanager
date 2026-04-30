import { NextResponse } from 'next/server';

import { getSprintById } from '@/lib/data/sprint';
import { getSprintByJiraId } from '@/lib/jira';
import { prisma } from '@/lib/prisma';
import type { ApiResponse, SprintListItem } from '@/types';

interface SprintRouteProps {
  params: Promise<{
    teamId: string;
    sprintId: string;
  }>;
}

export async function GET(
  _request: Request,
  { params }: SprintRouteProps,
): Promise<NextResponse<ApiResponse<SprintListItem>>> {
  try {
    const { sprintId, teamId } = await params;
    const sprint = await getSprintById(teamId, sprintId);

    if (!sprint) {
      return NextResponse.json({ error: { message: 'Sprint not found.' } }, { status: 404 });
    }

    return NextResponse.json({ data: sprint });
  } catch (error) {
    console.error('[API /teams/:teamId/sprints/:sprintId GET]', error);

    return NextResponse.json(
      { error: { message: 'Failed to load sprint.' } },
      { status: 500 },
    );
  }
}

export async function PUT(
  _request: Request,
  { params }: SprintRouteProps,
): Promise<NextResponse<ApiResponse<SprintListItem>>> {
  try {
    const { sprintId, teamId } = await params;
    const sprint = await prisma.sprint.findFirst({
      where: {
        id: sprintId,
        teamId,
      },
      select: {
        id: true,
        jiraSprintId: true,
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: { message: 'Sprint not found.' } }, { status: 404 });
    }

    const jiraSprint = await getSprintByJiraId(sprint.jiraSprintId);

    await prisma.sprint.update({
      where: {
        id: sprintId,
      },
      data: {
        name: jiraSprint.name,
        plannedStart: new Date(jiraSprint.startDate),
        plannedEnd: new Date(jiraSprint.endDate),
        actualEnd: jiraSprint.completeDate ? new Date(jiraSprint.completeDate) : null,
        activatedAt: jiraSprint.activatedDate ? new Date(jiraSprint.activatedDate) : null,
      },
    });

    const updatedSprint = await getSprintById(teamId, sprintId);

    if (!updatedSprint) {
      return NextResponse.json({ error: { message: 'Sprint not found.' } }, { status: 404 });
    }

    return NextResponse.json({ data: updatedSprint });
  } catch (error) {
    console.error('[API /teams/:teamId/sprints/:sprintId PUT]', error);

    return NextResponse.json(
      { error: { message: 'Failed to sync sprint.' } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: SprintRouteProps,
): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  try {
    const { sprintId, teamId } = await params;
    const sprint = await prisma.sprint.findFirst({
      where: {
        id: sprintId,
        teamId,
      },
      select: {
        id: true,
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: { message: 'Sprint not found.' } }, { status: 404 });
    }

    await prisma.sprint.delete({
      where: {
        id: sprintId,
      },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('[API /teams/:teamId/sprints/:sprintId DELETE]', error);

    return NextResponse.json(
      { error: { message: 'Failed to delete sprint.' } },
      { status: 500 },
    );
  }
}