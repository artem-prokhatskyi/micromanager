import { NextResponse } from 'next/server';

import { z } from 'zod';

import { createInviteForUser, getCurrentUserOrNull } from '@/lib/auth';
import type { ApiResponse } from '@/types';

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
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

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ inviteToken: string; userId: string }>>> {
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

    const body = (await request.json()) as unknown;
    const result = inviteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid invite input.',
            code: 'VALIDATION_ERROR',
            details: mapValidationErrors(result.error),
          },
        },
        { status: 400 },
      );
    }

    const invite = await createInviteForUser(result.data.email, currentUser.id);

    return NextResponse.json(
      {
        data: {
          inviteToken: invite.token,
          userId: invite.userId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'PENDING_USER_EXISTS') {
        return NextResponse.json(
          {
            error: {
              message: 'A pending invite already exists for this email.',
              details: {
                email: 'Reset the pending user instead of creating a new invite.',
              },
            },
          },
          { status: 409 },
        );
      }

      if (error.message === 'USER_ALREADY_EXISTS') {
        return NextResponse.json(
          {
            error: {
              message: 'A user with this email already exists.',
              details: {
                email: 'This email is already used by another account.',
              },
            },
          },
          { status: 409 },
        );
      }
    }

    console.error('[API /users/invite POST]', error);

    return NextResponse.json(
      { error: { message: 'Failed to create invite.' } },
      { status: 500 },
    );
  }
}