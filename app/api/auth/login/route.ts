import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateUser, createSessionForUser } from '@/lib/auth';
import type { ApiResponse } from '@/types';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().optional().default(false),
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
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid login input.',
            code: 'VALIDATION_ERROR',
            details: mapValidationErrors(result.error),
          },
        },
        { status: 400 },
      );
    }

    const user = await authenticateUser(result.data.email, result.data.password);

    if (!user) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid email or password.',
          },
        },
        { status: 401 },
      );
    }

    await createSessionForUser(user.id, result.data.rememberMe);

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('[API /auth/login POST]', error);

    return NextResponse.json(
      { error: { message: 'Failed to sign in.' } },
      { status: 500 },
    );
  }
}