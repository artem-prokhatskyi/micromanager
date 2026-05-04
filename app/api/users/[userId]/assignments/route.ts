import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getCurrentUserOrNull, updateUserTeamAssignments } from '@/lib/auth';
import type { ApiResponse } from '@/types';

const assignmentSchema = z.object({
  teamIds: z.array(z.string().trim().min(1)).default([]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse<ApiResponse<{ success: true }>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json(
        { error: { message: 'Authentication required.' } },
        { status: 401 },
      );
    }

    if (currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: { message: 'Admin access is required.' } },
        { status: 403 },
      );
    }

    const { userId } = await params;
    const body = (await request.json()) as unknown;
    const result = assignmentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: { message: 'Invalid assignment input.' } },
        { status: 400 },
      );
    }

    await updateUserTeamAssignments(userId, result.data.teamIds);

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'USER_NOT_ACTIVE') {
        return NextResponse.json(
          { error: { message: 'Only active users can receive assignments.' } },
          { status: 400 },
        );
      }

      if (error.message === 'INVALID_TEAM_ASSIGNMENTS') {
        return NextResponse.json(
          { error: { message: 'One or more selected teams no longer exist.' } },
          { status: 400 },
        );
      }
    }

    console.error('[API /users/:userId/assignments PATCH]', error);

    return NextResponse.json(
      { error: { message: 'Failed to update assignments.' } },
      { status: 500 },
    );
  }
}