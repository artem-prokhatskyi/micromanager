import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getAccessibleTeamId, getCurrentUserOrNull } from '@/lib/auth';
import { formatUtcDate } from '@/lib/date';
import { prisma } from '@/lib/prisma';
import { NON_WORKING_DAY_TYPE } from '@/types';
import type { ApiResponse, CalendarNonWorkingDayRecord } from '@/types';

const updateNonWorkingDaySchema = z
  .object({
    type: z
      .enum([
        NON_WORKING_DAY_TYPE.HOLIDAY,
        NON_WORKING_DAY_TYPE.VACATION,
        NON_WORKING_DAY_TYPE.SICKLEAVE,
      ])
      .optional(),
    halfDay: z.boolean().optional(),
  })
  .refine((value) => value.type !== undefined || value.halfDay !== undefined, {
    message: 'Provide at least one field to update.',
    path: ['type'],
  });

interface NonWorkingDayRouteProps {
  params: Promise<{
    teamId: string;
    id: string;
  }>;
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

async function getNonWorkingDayRecord(teamId: string, id: string): Promise<{ id: string } | null> {
  return prisma.nonWorkingDay.findFirst({
    where: {
      id,
      teamId,
    },
    select: {
      id: true,
    },
  });
}

function toCalendarNonWorkingDayRecord(record: {
  id: string;
  memberId: string;
  teamId: string;
  date: Date;
  type: CalendarNonWorkingDayRecord['type'];
  halfDay: boolean;
  member: {
    name: string;
  };
}): CalendarNonWorkingDayRecord {
  return {
    id: record.id,
    memberId: record.memberId,
    memberName: record.member.name,
    teamId: record.teamId,
    date: formatUtcDate(record.date),
    type: record.type,
    halfDay: record.halfDay,
  };
}

export async function PUT(
  request: Request,
  { params }: NonWorkingDayRouteProps,
): Promise<NextResponse<ApiResponse<CalendarNonWorkingDayRecord>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    const { id, teamId } = await params;
    const team = await getAccessibleTeamId(teamId, currentUser);

    if (!team) {
      return NextResponse.json({ error: { message: 'Team not found.' } }, { status: 404 });
    }

    const record = await getNonWorkingDayRecord(teamId, id);

    if (!record) {
      return NextResponse.json({ error: { message: 'Non-working day record not found.' } }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const result = updateNonWorkingDaySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid non-working day input.',
            code: 'VALIDATION_ERROR',
            details: mapValidationErrors(result.error),
          },
        },
        { status: 400 },
      );
    }

    const updatedRecord = await prisma.nonWorkingDay.update({
      where: {
        id,
      },
      data: {
        ...(result.data.type !== undefined ? { type: result.data.type } : {}),
        ...(result.data.halfDay !== undefined ? { halfDay: result.data.halfDay } : {}),
      },
      select: {
        id: true,
        memberId: true,
        teamId: true,
        date: true,
        type: true,
        halfDay: true,
        member: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ data: toCalendarNonWorkingDayRecord(updatedRecord) });
  } catch (error) {
    console.error('[API /teams/:teamId/non-working-days/:id PUT]', error);

    return NextResponse.json(
      { error: { message: 'Failed to update non-working day record.' } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: NonWorkingDayRouteProps,
): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    const { id, teamId } = await params;
    const team = await getAccessibleTeamId(teamId, currentUser);

    if (!team) {
      return NextResponse.json({ error: { message: 'Team not found.' } }, { status: 404 });
    }

    const record = await getNonWorkingDayRecord(teamId, id);

    if (!record) {
      return NextResponse.json({ error: { message: 'Non-working day record not found.' } }, { status: 404 });
    }

    await prisma.nonWorkingDay.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('[API /teams/:teamId/non-working-days/:id DELETE]', error);

    return NextResponse.json(
      { error: { message: 'Failed to delete non-working day record.' } },
      { status: 500 },
    );
  }
}