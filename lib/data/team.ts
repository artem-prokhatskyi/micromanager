import { unstable_noStore as noStore } from 'next/cache';

import { prisma } from '@/lib/prisma';

export interface ShellTeam {
  id: string;
  name: string;
}

export async function getTeams(): Promise<ShellTeam[]> {
  noStore();

  return prisma.team.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

export async function getFirstTeam(): Promise<Pick<ShellTeam, 'id'> | null> {
  noStore();

  return prisma.team.findFirst({
    select: {
      id: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

export async function getTeamById(teamId: string): Promise<Pick<ShellTeam, 'id'> | null> {
  noStore();

  return prisma.team.findUnique({
    where: {
      id: teamId,
    },
    select: {
      id: true,
    },
  });
}