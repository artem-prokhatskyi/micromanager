import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getAccessibleTeamId, getCurrentUserOrNull } from '@/lib/auth';
import { getTeamMembers } from '@/lib/data/team';
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

const createMemberSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  jiraEmail: z.string().trim().email('Enter a valid Jira email address.'),
  githubUsername: z.string().trim().optional().default(''),
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
  ).min(1, 'Select at least one working day.'),
  defaultFocusFactor: z.coerce
    .number({ invalid_type_error: 'Must be between 0 and 1.' })
    .gt(0, 'Must be greater than 0.')
    .lte(1, 'Must be between 0 and 1.'),
  specialization: z.array(z.enum(specializationValues)).optional().default([]),
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

interface TeamMembersRouteProps {
  params: Promise<{
    teamId: string;
  }>;
}

export async function GET(
  _request: Request,
  { params }: TeamMembersRouteProps,
): Promise<NextResponse<ApiResponse<TeamMemberRecord[]>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    const { teamId } = await params;
    const team = await getAccessibleTeamId(teamId, currentUser);

    if (!team) {
      return NextResponse.json(
        { error: { message: 'Team not found.' } },
        { status: 404 },
      );
    }

    const members = await getTeamMembers(teamId);

    return NextResponse.json({ data: members });
  } catch (error) {
    console.error('[API /teams/:teamId/members GET]', error);

    return NextResponse.json(
      { error: { message: 'Failed to load team members.' } },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: TeamMembersRouteProps,
): Promise<NextResponse<ApiResponse<TeamMemberRecord>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    const { teamId } = await params;
    const team = await getAccessibleTeamId(teamId, currentUser);

    if (!team) {
      return NextResponse.json(
        { error: { message: 'Team not found.' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as unknown;
    const result = createMemberSchema.safeParse(body);

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

    const member = await prisma.teamMember.create({
      data: {
        teamId,
        name: result.data.name.trim(),
        jiraEmail: result.data.jiraEmail.trim().toLowerCase(),
        githubUsername: result.data.githubUsername.trim(),
        workingDays: sortWorkingDays(result.data.workingDays),
        defaultFocusFactor: result.data.defaultFocusFactor,
        specialization: result.data.specialization,
      },
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

    return NextResponse.json({ data: member }, { status: 201 });
  } catch (error) {
    console.error('[API /teams/:teamId/members POST]', error);

    return NextResponse.json(
      { error: { message: 'Failed to create team member.' } },
      { status: 500 },
    );
  }
}