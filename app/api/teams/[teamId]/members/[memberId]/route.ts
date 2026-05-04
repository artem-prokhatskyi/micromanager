import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getAccessibleTeamId, getCurrentUserOrNull } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sortWorkingDays } from '@/lib/utils';
import { SPECIALIZATION, WEEK_DAY } from '@/types';
import type { ApiResponse, TeamMemberRecord } from '@/types';

const specializationValues = [
  SPECIALIZATION.FRONTEND,
  SPECIALIZATION.BACKEND,
  SPECIALIZATION.TEAM_LEADER,
  SPECIALIZATION.QA,
] as const;

const updateMemberSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').optional(),
  jiraEmail: z.string().trim().email('Enter a valid Jira email address.').optional(),
  githubUsername: z.string().trim().optional(),
  workingDays: z.array(
    z.enum([
      WEEK_DAY.MON,
      WEEK_DAY.TUE,
      WEEK_DAY.WED,
      WEEK_DAY.THU,
      WEEK_DAY.FRI,
      WEEK_DAY.SAT,
      WEEK_DAY.SUN,
    ]),
  ).min(1, 'Select at least one working day.').optional(),
  defaultFocusFactor: z.coerce
    .number({ invalid_type_error: 'Must be between 0 and 1.' })
    .gt(0, 'Must be greater than 0.')
    .lte(1, 'Must be between 0 and 1.')
    .optional(),
  specialization: z.array(z.enum(specializationValues)).optional(),
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

interface TeamMemberRouteProps {
  params: Promise<{
    teamId: string;
    memberId: string;
  }>;
}

async function getTeamMemberRecord(teamId: string, memberId: string): Promise<Pick<TeamMemberRecord, 'id'> | null> {
  return prisma.teamMember.findFirst({
    where: {
      id: memberId,
      teamId,
    },
    select: {
      id: true,
    },
  });
}

export async function PUT(
  request: Request,
  { params }: TeamMemberRouteProps,
): Promise<NextResponse<ApiResponse<TeamMemberRecord>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    const { memberId, teamId } = await params;
    const team = await getAccessibleTeamId(teamId, currentUser);

    if (!team) {
      return NextResponse.json(
        { error: { message: 'Team not found.' } },
        { status: 404 },
      );
    }

    const memberRecord = await getTeamMemberRecord(teamId, memberId);

    if (!memberRecord) {
      return NextResponse.json(
        { error: { message: 'Team member not found.' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as unknown;
    const result = updateMemberSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid member input.',
            code: 'VALIDATION_ERROR',
            details: mapValidationErrors(result.error),
          },
        },
        { status: 400 },
      );
    }

    const data: Partial<z.infer<typeof updateMemberSchema>> & {
      jiraEmail?: string;
      githubUsername?: string;
      name?: string;
    } = {};

    if (result.data.name !== undefined) {
      data.name = result.data.name.trim();
    }

    if (result.data.jiraEmail !== undefined) {
      data.jiraEmail = result.data.jiraEmail.trim().toLowerCase();
    }

    if (result.data.githubUsername !== undefined) {
      data.githubUsername = result.data.githubUsername.trim();
    }

    if (result.data.workingDays !== undefined) {
      data.workingDays = sortWorkingDays(result.data.workingDays);
    }

    if (result.data.defaultFocusFactor !== undefined) {
      data.defaultFocusFactor = result.data.defaultFocusFactor;
    }

    if (result.data.specialization !== undefined) {
      data.specialization = result.data.specialization;
    }

    const member = await prisma.teamMember.update({
      where: {
        id: memberId,
      },
      data,
      select: {
        id: true,
        teamId: true,
        name: true,
        jiraEmail: true,
        githubUsername: true,
        workingDays: true,
        defaultFocusFactor: true,
        specialization: true,
      },
    });

    return NextResponse.json({ data: member });
  } catch (error) {
    console.error('[API /teams/:teamId/members/:memberId PUT]', error);

    return NextResponse.json(
      { error: { message: 'Failed to update team member.' } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: TeamMemberRouteProps,
): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    const { memberId, teamId } = await params;
    const team = await getAccessibleTeamId(teamId, currentUser);

    if (!team) {
      return NextResponse.json(
        { error: { message: 'Team not found.' } },
        { status: 404 },
      );
    }

    const memberRecord = await getTeamMemberRecord(teamId, memberId);

    if (!memberRecord) {
      return NextResponse.json(
        { error: { message: 'Team member not found.' } },
        { status: 404 },
      );
    }

    await prisma.teamMember.delete({
      where: {
        id: memberId,
      },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('[API /teams/:teamId/members/:memberId DELETE]', error);

    return NextResponse.json(
      { error: { message: 'Failed to delete team member.' } },
      { status: 500 },
    );
  }
}