import { unstable_noStore as noStore } from 'next/cache';

import { prisma } from '@/lib/prisma';
import type { ManagedUserRecord, TeamOption } from '@/types';

export async function getManagedUsers(): Promise<ManagedUserRecord[]> {
  noStore();

  const users = await prisma.user.findMany({
    select: {
      email: true,
      id: true,
      invitedBy: {
        select: {
          email: true,
        },
      },
      role: true,
      status: true,
      teamAssignments: {
        select: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          team: {
            name: 'asc',
          },
        },
      },
    },
    orderBy: [
      {
        status: 'asc',
      },
      {
        email: 'asc',
      },
    ],
  });

  return users.map((user) => {
    const assignedTeams = user.teamAssignments.map((assignment) => assignment.team);

    return {
      assignedTeamIds: assignedTeams.map((team) => team.id),
      assignedTeams,
      email: user.email,
      id: user.id,
      invitedByEmail: user.invitedBy?.email ?? null,
      role: user.role,
      status: user.status,
    };
  });
}

export async function getAllTeamOptionsForAdmin(): Promise<TeamOption[]> {
  noStore();

  return prisma.team.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  });
}