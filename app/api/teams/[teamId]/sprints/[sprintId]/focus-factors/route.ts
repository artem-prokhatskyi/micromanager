import { NextResponse } from 'next/server';

import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@/types';

const updateFocusFactorSchema = z.object({
  memberId: z.string().trim().min(1, 'Member is required.'),
  focusFactor: z.coerce
    .number({ invalid_type_error: 'Must be between 0 and 1.' })
    .gt(0, 'Must be greater than 0.')
    .lte(1, 'Must be between 0 and 1.'),
});

interface FocusFactorRouteProps {
  params: Promise<{
    teamId: string;
    sprintId: string;
  }>;
}

interface SprintFocusFactorResponse {
  sprintId: string;
  memberId: string;
  focusFactor: number;
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

export async function PATCH(
  request: Request,
  { params }: FocusFactorRouteProps,
): Promise<NextResponse<ApiResponse<SprintFocusFactorResponse>>> {
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

    const body = (await request.json()) as unknown;
    const result = updateFocusFactorSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid focus factor input.',
            code: 'VALIDATION_ERROR',
            details: mapValidationErrors(result.error),
          },
        },
        { status: 400 },
      );
    }

    const member = await prisma.teamMember.findFirst({
      where: {
        id: result.data.memberId,
        teamId,
      },
      select: {
        id: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: { message: 'Team member not found.' } }, { status: 404 });
    }

    const focusFactor = await prisma.sprintFocusFactor.upsert({
      where: {
        sprintId_memberId: {
          sprintId,
          memberId: result.data.memberId,
        },
      },
      create: {
        sprintId,
        memberId: result.data.memberId,
        focusFactor: result.data.focusFactor,
      },
      update: {
        focusFactor: result.data.focusFactor,
      },
      select: {
        sprintId: true,
        memberId: true,
        focusFactor: true,
      },
    });

    return NextResponse.json({ data: focusFactor });
  } catch (error) {
    console.error('[API /teams/:teamId/sprints/:sprintId/focus-factors PATCH]', error);

    return NextResponse.json(
      { error: { message: 'Failed to update sprint focus factor.' } },
      { status: 500 },
    );
  }
}