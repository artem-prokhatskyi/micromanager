import { NextResponse } from 'next/server';

import { deleteUser, getCurrentUserOrNull } from '@/lib/auth';
import type { ApiResponse } from '@/types';

export async function DELETE(
  _request: Request,
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

    await deleteUser(userId);

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return NextResponse.json(
        { error: { message: 'User not found.' } },
        { status: 404 },
      );
    }

    console.error('[API /users/:userId DELETE]', error);

    return NextResponse.json(
      { error: { message: 'Failed to delete user.' } },
      { status: 500 },
    );
  }
}