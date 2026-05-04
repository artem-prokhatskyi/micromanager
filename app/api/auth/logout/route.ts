import { NextResponse } from 'next/server';

import { destroyCurrentSession } from '@/lib/auth';
import type { ApiResponse } from '@/types';

export async function POST(): Promise<NextResponse<ApiResponse<{ success: true }>>> {
  try {
    await destroyCurrentSession();

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('[API /auth/logout POST]', error);

    return NextResponse.json(
      { error: { message: 'Failed to sign out.' } },
      { status: 500 },
    );
  }
}