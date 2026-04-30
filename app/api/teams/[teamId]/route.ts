import { NextResponse } from 'next/server';

import { getTeamDetail } from '@/lib/data/team';
import type { ApiResponse, TeamDetail } from '@/types';

interface TeamRouteProps {
  params: Promise<{
    teamId: string;
  }>;
}

export async function GET(
  _request: Request,
  { params }: TeamRouteProps,
): Promise<NextResponse<ApiResponse<TeamDetail>>> {
  try {
    const { teamId } = await params;
    const team = await getTeamDetail(teamId);

    if (!team) {
      return NextResponse.json(
        { error: { message: 'Team not found.' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: team });
  } catch (error) {
    console.error('[API /teams/:teamId GET]', error);

    return NextResponse.json(
      { error: { message: 'Failed to load team.' } },
      { status: 500 },
    );
  }
}