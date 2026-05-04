import { unstable_noStore as noStore } from 'next/cache';

import { Prisma } from '@prisma/client';

import { buildAccessibleTeamWhere, getCurrentUserOrNull } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sortWorkingDays } from '@/lib/utils';
import type { TeamDetail, TeamMemberRecord, TeamOption } from '@/types';

export interface ShellTeam {
  id: string;
  name: string;
}

async function getAccessibleTeamWhere(): Promise<Prisma.TeamWhereInput | null> {
  const currentUser = await getCurrentUserOrNull();

  if (!currentUser) {
    return null;
  }

  return buildAccessibleTeamWhere(currentUser);
}

export async function getTeams(): Promise<ShellTeam[]> {
  noStore();

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return [];
  }

  return prisma.team.findMany({
    where: accessibleWhere,
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

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return null;
  }

  return prisma.team.findFirst({
    where: accessibleWhere,
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

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return null;
  }

  return prisma.team.findFirst({
    where: {
      ...accessibleWhere,
      id: teamId,
    },
    select: {
      id: true,
    },
  });
}

export async function getTeamOptions(): Promise<TeamOption[]> {
  noStore();

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return [];
  }

  return prisma.team.findMany({
    where: accessibleWhere,
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

export async function getTeamDetail(teamId: string): Promise<TeamDetail | null> {
  noStore();

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return null;
  }

  return prisma.team.findFirst({
    where: {
      ...accessibleWhere,
      id: teamId,
    },
    select: {
      id: true,
      name: true,
      jiraSpace: true,
      githubRepositories: true,
      estimateInHours: true,
    },
  });
}

export async function getTeamMembers(teamId: string): Promise<TeamMemberRecord[]> {
  noStore();

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return [];
  }

  const members = await prisma.teamMember.findMany({
    where: {
      team: accessibleWhere,
      teamId,
    },
    select: {
      id: true,
      teamId: true,
      name: true,
      jiraEmail: true,
      githubUsername: true,
      workingDays: true,
      defaultFocusFactor: true,
      specialization: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return members.map((member) => ({
    ...member,
    workingDays: sortWorkingDays(member.workingDays),
  }));
}

export async function getTeamMember(teamId: string, memberId: string): Promise<TeamMemberRecord | null> {
  noStore();

  const accessibleWhere = await getAccessibleTeamWhere();

  if (!accessibleWhere) {
    return null;
  }

  const member = await prisma.teamMember.findFirst({
    where: {
      id: memberId,
      team: accessibleWhere,
      teamId,
    },
    select: {
      id: true,
      teamId: true,
      name: true,
      jiraEmail: true,
      githubUsername: true,
      workingDays: true,
      defaultFocusFactor: true,
      specialization: true,
    },
  });

  if (!member) {
    return null;
  }

  return {
    ...member,
    workingDays: sortWorkingDays(member.workingDays),
  };
}