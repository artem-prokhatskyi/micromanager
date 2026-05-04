import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getCurrentUserOrNull, updateUserRole } from '@/lib/auth';
import type { ApiResponse } from '@/types';

const roleSchema = z.object({
  role: z.enum(['admin', 'user']),
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
    const result = roleSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: { message: 'Invalid role input.' } },
        { status: 400 },
      );
    }

    await updateUserRole(userId, result.data.role, currentUser.id);

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'CANNOT_CHANGE_OWN_ROLE') {
        return NextResponse.json(
          { error: { message: 'You cannot change your own role.' } },
          { status: 400 },
        );
      }

      if (error.message === 'USER_NOT_ACTIVE') {
        return NextResponse.json(
          { error: { message: 'Only active users can have their role changed.' } },
          { status: 400 },
        );
      }
    }

    console.error('[API /users/:userId/role PATCH]', error);

    return NextResponse.json(
      { error: { message: 'Failed to update user role.' } },
      { status: 500 },
    );
  }
}