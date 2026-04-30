import { unstable_noStore as noStore } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { sortWorkingDays } from '@/lib/utils';
import type { TeamDetail, TeamMemberRecord, TeamOption } from '@/types';

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

export async function getTeamOptions(): Promise<TeamOption[]> {
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

export async function getTeamDetail(teamId: string): Promise<TeamDetail | null> {
  noStore();

  return prisma.team.findUnique({
    where: {
      id: teamId,
    },
    select: {
      id: true,
      name: true,
      jiraSpace: true,
      githubRepositories: true,
    },
  });
}

export async function getTeamMembers(teamId: string): Promise<TeamMemberRecord[]> {
  noStore();

  const members = await prisma.teamMember.findMany({
    where: {
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

  const member = await prisma.teamMember.findFirst({
    where: {
      id: memberId,
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