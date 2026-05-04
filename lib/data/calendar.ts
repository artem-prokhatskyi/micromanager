import { unstable_noStore as noStore } from 'next/cache';

import { formatUtcDate } from '@/lib/date';
import { prisma } from '@/lib/prisma';
import { getTeamDetail, getTeamMembers } from '@/lib/data/team';
import { getTeamSprints } from '@/lib/data/sprint';
import type { TeamCalendarData } from '@/types';
import type { CalendarRange } from '@/lib/date';

export async function getTeamCalendarData(
  teamId: string,
  range: CalendarRange,
): Promise<TeamCalendarData | null> {
  noStore();

  const [team, members, sprints, nonWorkingDays] = await Promise.all([
    getTeamDetail(teamId),
    getTeamMembers(teamId),
    getTeamSprints(teamId),
    prisma.nonWorkingDay.findMany({
      where: {
        teamId,
        date: {
          gte: range.start,
          lte: range.end,
        },
      },
      select: {
        id: true,
        memberId: true,
        teamId: true,
        date: true,
        type: true,
        halfDay: true,
        member: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        {
          date: 'asc',
        },
        {
          member: {
            name: 'asc',
          },
        },
      ],
    }),
  ]);

  if (!team) {
    return null;
  }

  return {
    team,
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
    })),
    sprints: sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      activatedAt: sprint.activatedAt ? formatUtcDate(sprint.activatedAt) : null,
      plannedStart: formatUtcDate(sprint.plannedStart),
      plannedEnd: formatUtcDate(sprint.plannedEnd),
      actualEnd: sprint.actualEnd ? formatUtcDate(sprint.actualEnd) : null,
      isOverdue: sprint.isOverdue,
    })),
    nonWorkingDays: nonWorkingDays.map((record) => ({
      id: record.id,
      memberId: record.memberId,
      memberName: record.member.name,
      teamId: record.teamId,
      date: formatUtcDate(record.date),
      type: record.type,
      halfDay: record.halfDay,
    })),
  };
}