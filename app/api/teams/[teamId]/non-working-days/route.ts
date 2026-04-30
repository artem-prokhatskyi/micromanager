import { NextResponse } from 'next/server';

import { z } from 'zod';

import { formatUtcDate, parseUtcDate } from '@/lib/date';
import { prisma } from '@/lib/prisma';
import { NON_WORKING_DAY_TYPE } from '@/types';
import type { ApiResponse, CalendarNonWorkingDayRecord } from '@/types';

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.');

const createNonWorkingDaySchema = z.object({
  memberIds: z.array(z.string().trim().min(1)).min(1, 'Select at least one team member.'),
  date: dateStringSchema,
  type: z.enum([
    NON_WORKING_DAY_TYPE.HOLIDAY,
    NON_WORKING_DAY_TYPE.VACATION,
    NON_WORKING_DAY_TYPE.SICKLEAVE,
  ]),
  halfDay: z.boolean(),
});

const listNonWorkingDaysSchema = z.object({
  start: dateStringSchema,
  end: dateStringSchema,
});

interface NonWorkingDaysRouteProps {
  params: Promise<{
    teamId: string;
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

async function getTeamRecord(teamId: string): Promise<{ id: string } | null> {
  return prisma.team.findUnique({
    where: {
      id: teamId,
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

export async function GET(
  request: Request,
  { params }: NonWorkingDaysRouteProps,
): Promise<NextResponse<ApiResponse<CalendarNonWorkingDayRecord[]>>> {
  try {
    const { teamId } = await params;
    const team = await getTeamRecord(teamId);

    if (!team) {
      return NextResponse.json({ error: { message: 'Team not found.' } }, { status: 404 });
    }

    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const result = listNonWorkingDaysSchema.safeParse(query);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid date range.',
            code: 'VALIDATION_ERROR',
            details: mapValidationErrors(result.error),
          },
        },
        { status: 400 },
      );
    }

    const start = parseUtcDate(result.data.start);
    const end = parseUtcDate(result.data.end);

    if (start > end) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid date range.',
            code: 'VALIDATION_ERROR',
            details: {
              end: 'End date must be on or after the start date.',
            },
          },
        },
        { status: 400 },
      );
    }

    const records = await prisma.nonWorkingDay.findMany({
      where: {
        teamId,
        date: {
          gte: start,
          lte: end,
        },
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
      orderBy: [
        {
          date: 'asc',
        },
        {
          member: {
            name: 'asc',
          },
        },
      ],
    });

    return NextResponse.json({ data: records.map(toCalendarNonWorkingDayRecord) });
  } catch (error) {
    console.error('[API /teams/:teamId/non-working-days GET]', error);

    return NextResponse.json(
      { error: { message: 'Failed to load non-working days.' } },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: NonWorkingDaysRouteProps,
): Promise<NextResponse<ApiResponse<CalendarNonWorkingDayRecord[]>>> {
  try {
    const { teamId } = await params;
    const team = await getTeamRecord(teamId);

    if (!team) {
      return NextResponse.json({ error: { message: 'Team not found.' } }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const result = createNonWorkingDaySchema.safeParse(body);

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

    const normalizedDate = parseUtcDate(result.data.date);
    const memberIds = [...new Set(result.data.memberIds)];
    const members = await prisma.teamMember.findMany({
      where: {
        id: {
          in: memberIds,
        },
        teamId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (members.length !== memberIds.length) {
      return NextResponse.json(
        { error: { message: 'One or more team members were not found.' } },
        { status: 404 },
      );
    }

    const existingRecords = await prisma.nonWorkingDay.findMany({
      where: {
        memberId: {
          in: memberIds,
        },
        date: normalizedDate,
      },
      select: {
        memberId: true,
      },
    });
    const conflictingMemberIds = new Set(existingRecords.map((record) => record.memberId));
    const conflicts = members
      .filter((member) => conflictingMemberIds.has(member.id))
      .map((member) => member.name);

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: {
            message: 'One or more selected team members already have a record on this date.',
            code: 'NON_WORKING_DAY_CONFLICT',
            conflicts,
          },
        },
        { status: 409 },
      );
    }

    const createdRecords = await prisma.$transaction(
      members.map((member) =>
        prisma.nonWorkingDay.create({
          data: {
            memberId: member.id,
            teamId,
            date: normalizedDate,
            type: result.data.type,
            halfDay: result.data.halfDay,
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
        }),
      ),
    );

    return NextResponse.json(
      { data: createdRecords.map(toCalendarNonWorkingDayRecord) },
      { status: 201 },
    );
  } catch (error) {
    console.error('[API /teams/:teamId/non-working-days POST]', error);

    return NextResponse.json(
      { error: { message: 'Failed to create non-working day records.' } },
      { status: 500 },
    );
  }
}