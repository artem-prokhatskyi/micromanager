import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getAccessibleTeamId, getCurrentUserOrNull } from '@/lib/auth';
import { getTeamDetail } from '@/lib/data/team';
import { prisma } from '@/lib/prisma';
import type { ApiResponse, TeamDetail } from '@/types';

const updateTeamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required.'),
  jiraSpace: z.string().trim().min(1, 'Jira space is required.'),
  githubRepositories: z.array(z.string().trim().min(1)).optional().default([]),
  estimateInHours: z.boolean().optional().default(false),
});

function mapValidationErrors(error: z.ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((accumulator, issue) => {
    const path = issue.path[0];

    if (typeof path === 'string' && !accumulator[path]) {
      accumulator[path] = issue.message;
    }

    return accumulator;
  }, {});
}

interface TeamRouteProps {
  params: Promise<{
    teamId: string;
  }>;
}

export async function GET(
  _request: Request,
  { params }: TeamRouteProps,
): Promise<NextResponse<ApiResponse<TeamDetail>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    const { teamId } = await params;
    const accessibleTeam = await getAccessibleTeamId(teamId, currentUser);

    if (!accessibleTeam) {
      return NextResponse.json(
        { error: { message: 'Team not found.' } },
        { status: 404 },
      );
    }

    const team = await getTeamDetail(teamId);

    if (!team) {
      return NextResponse.json(
        { error: { message: 'Team not found.' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: team });
  } catch (error) {
    console.error('[API /teams/:teamId GET]', error);

    return NextResponse.json(
      { error: { message: 'Failed to load team.' } },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: TeamRouteProps,
): Promise<NextResponse<ApiResponse<{ id: string; name: string }>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    const { teamId } = await params;
    const existingTeam = await getAccessibleTeamId(teamId, currentUser);

    if (!existingTeam) {
      return NextResponse.json(
        { error: { message: 'Team not found.' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as unknown;
    const result = updateTeamSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid team input.',
            code: 'VALIDATION_ERROR',
            details: mapValidationErrors(result.error),
          },
        },
        { status: 400 },
      );
    }

    const team = await prisma.team.update({
      where: {
        id: teamId,
      },
      data: {
        name: result.data.name.trim(),
        jiraSpace: result.data.jiraSpace.trim().toUpperCase(),
        githubRepositories: result.data.githubRepositories,
        estimateInHours: result.data.estimateInHours,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({ data: team });
  } catch (error) {
    console.error('[API /teams/:teamId PUT]', error);

    return NextResponse.json(
      { error: { message: 'Failed to update team.' } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: TeamRouteProps,
): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    const { teamId } = await params;
    const existingTeam = await getAccessibleTeamId(teamId, currentUser);

    if (!existingTeam) {
      return NextResponse.json(
        { error: { message: 'Team not found.' } },
        { status: 404 },
      );
    }

    await prisma.team.delete({
      where: {
        id: teamId,
      },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('[API /teams/:teamId DELETE]', error);

    return NextResponse.json(
      { error: { message: 'Failed to delete team.' } },
      { status: 500 },
    );
  }
}