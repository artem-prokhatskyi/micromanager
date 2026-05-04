import { NextResponse } from 'next/server';

import { getCurrentUserOrNull, resetActiveUserPassword, resetPendingInvite } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@/types';

interface ResetUserResponse {
  inviteToken?: string;
  temporaryPassword?: string;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse<ApiResponse<ResetUserResponse>>> {
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
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { message: 'User not found.' } },
        { status: 404 },
      );
    }

    if (user.status === 'pending') {
      const inviteToken = await resetPendingInvite(userId);

      return NextResponse.json({ data: { inviteToken } });
    }

    if (user.status === 'active') {
      const temporaryPassword = await resetActiveUserPassword(userId);

      return NextResponse.json({ data: { temporaryPassword } });
    }

    return NextResponse.json(
      { error: { message: 'Deactivated users cannot be reset.' } },
      { status: 400 },
    );
  } catch (error) {
    console.error('[API /users/:userId/reset POST]', error);

    return NextResponse.json(
      { error: { message: 'Failed to reset user.' } },
      { status: 500 },
    );
  }
}