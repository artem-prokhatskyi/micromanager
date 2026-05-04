import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getCurrentUserOrNull } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@/types';

const createTeamSchema = z.object({
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

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ id: string; name: string }>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json(
        { error: { message: 'Authentication required.' } },
        { status: 401 },
      );
    }

    const body = (await request.json()) as unknown;
    const result = createTeamSchema.safeParse(body);

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

    const team = await prisma.team.create({
      data: {
        createdByUserId: currentUser.id,
        name: result.data.name.trim(),
        jiraSpace: result.data.jiraSpace.trim().toUpperCase(),
        githubRepositories: result.data.githubRepositories,
        estimateInHours: result.data.estimateInHours,
        userAssignments: {
          create: {
            userId: currentUser.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({ data: team }, { status: 201 });
  } catch (error) {
    console.error('[API /teams POST]', error);

    return NextResponse.json(
      { error: { message: 'Failed to create team.' } },
      { status: 500 },
    );
  }
}