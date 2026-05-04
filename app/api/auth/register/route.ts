import { NextResponse } from 'next/server';

import { z } from 'zod';

import {
  getPasswordValidationErrors,
  registerFirstUser,
  registerInvitedUser,
} from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@/types';

const registerSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  inviteToken: z
    .preprocess(
      (value) => (value === null ? undefined : value),
      z.string().trim().optional(),
    ),
  password: z.string().min(1, 'Password is required.'),
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

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ success: true }>>> {
  try {
    const body = (await request.json()) as unknown;
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid registration input.',
            code: 'VALIDATION_ERROR',
            details: mapValidationErrors(result.error),
          },
        },
        { status: 400 },
      );
    }

    const passwordErrors = getPasswordValidationErrors(result.data.password);

    if (passwordErrors.length > 0) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid registration input.',
            code: 'VALIDATION_ERROR',
            details: {
              password: passwordErrors[0] ?? 'Password is invalid.',
            },
          },
        },
        { status: 400 },
      );
    }

    const totalUsers = await prisma.user.count();

    if (totalUsers === 0) {
      await registerFirstUser(result.data.email, result.data.password);

      return NextResponse.json({ data: { success: true } }, { status: 201 });
    }

    if (!result.data.inviteToken) {
      return NextResponse.json(
        {
          error: {
            message: 'A valid invite link is required.',
            details: {
              inviteToken: 'Invite link is missing or invalid.',
            },
          },
        },
        { status: 403 },
      );
    }

    await registerInvitedUser(result.data.inviteToken, result.data.email, result.data.password);

    return NextResponse.json({ data: { success: true } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVALID_INVITE') {
        return NextResponse.json(
          {
            error: {
              message: 'This invite link is invalid or has already been used.',
              details: {
                inviteToken: 'Invite link is invalid or already used.',
              },
            },
          },
          { status: 400 },
        );
      }

      if (error.message === 'INVITE_EMAIL_MISMATCH') {
        return NextResponse.json(
          {
            error: {
              message: 'This invite link is tied to a different email address.',
              details: {
                email: 'Use the email address that the admin invited.',
              },
            },
          },
          { status: 400 },
        );
      }

      if (error.message === 'INVITE_REQUIRED') {
        return NextResponse.json(
          {
            error: {
              message: 'Registration now requires an invite link.',
              details: {
                inviteToken: 'A valid invite link is required.',
              },
            },
          },
          { status: 403 },
        );
      }
    }

    console.error('[API /auth/register POST]', error);

    return NextResponse.json(
      { error: { message: 'Failed to register user.' } },
      { status: 500 },
    );
  }
}