import { NextResponse } from 'next/server';

import { z } from 'zod';

import {
  changeUserPassword,
  getCurrentUserOrNull,
  getPasswordValidationErrors,
} from '@/lib/auth';
import type { ApiResponse } from '@/types';

const changePasswordSchema = z.object({
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
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json(
        { error: { message: 'Authentication required.' } },
        { status: 401 },
      );
    }

    const body = (await request.json()) as unknown;
    const result = changePasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid password input.',
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
            message: 'Invalid password input.',
            code: 'VALIDATION_ERROR',
            details: {
              password: passwordErrors[0] ?? 'Password is invalid.',
            },
          },
        },
        { status: 400 },
      );
    }

    await changeUserPassword(currentUser.id, result.data.password);

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('[API /auth/change-password POST]', error);

    return NextResponse.json(
      { error: { message: 'Failed to update password.' } },
      { status: 500 },
    );
  }
}