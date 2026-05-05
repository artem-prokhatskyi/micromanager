import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { PASSWORD_REQUIREMENTS_MESSAGE } from '@/lib/auth-shared';
import { prisma } from '@/lib/prisma';

const scrypt = promisify(nodeScrypt);

const PASSWORD_HASH_BYTES = 64;
const PASSWORD_SALT_BYTES = 16;
const SESSION_COOKIE_NAME = 'team-sprint-monitor.session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 8;
const REMEMBER_ME_DURATION_MS = 1000 * 60 * 60 * 24 * 14;
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;
const NUMBER_PATTERN = /\d/;

export interface AuthenticatedUser {
  email: string;
  id: string;
  invitedByEmail: string | null;
  mustChangePassword: boolean;
  role: UserRole;
  status: UserStatus;
}

export interface RegistrationState {
  bootstrapRegistrationOpen: boolean;
  invitedEmail: string | null;
  inviteTokenValid: boolean;
  requiresInvite: boolean;
}

function getSessionLifetime(rememberMe: boolean): number {
  return rememberMe ? REMEMBER_ME_DURATION_MS : SESSION_DURATION_MS;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createPasswordHashParts(password: string, salt: Buffer): Promise<Buffer> {
  return scrypt(password, salt, PASSWORD_HASH_BYTES) as Promise<Buffer>;
}

function toAuthenticatedUser(user: {
  email: string;
  id: string;
  invitedBy: { email: string } | null;
  mustChangePassword: boolean;
  role: UserRole;
  status: UserStatus;
}): AuthenticatedUser {
  return {
    email: user.email,
    id: user.id,
    invitedByEmail: user.invitedBy?.email ?? null,
    mustChangePassword: user.mustChangePassword,
    role: user.role,
    status: user.status,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getPasswordValidationErrors(password: string): string[] {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  if (!NUMBER_PATTERN.test(password)) {
    errors.push('Password must include at least one number.');
  }

  if (!SPECIAL_CHARACTER_PATTERN.test(password)) {
    errors.push('Password must include at least one special character.');
  }

  return errors;
}

export function isPasswordValid(password: string): boolean {
  return getPasswordValidationErrors(password).length === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const derivedKey = await createPasswordHashParts(password, salt);

  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');

  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  const actualHash = await createPasswordHashParts(password, salt);

  if (expectedHash.length !== actualHash.length) {
    return false;
  }

  return timingSafeEqual(expectedHash, actualHash);
}

export function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const specialCharacters = '!@#$%^&*';
  const allCharacters = `${alphabet}${digits}${specialCharacters}`;
  const requiredCharacters = [
    alphabet[randomBytes(1)[0] % alphabet.length],
    digits[randomBytes(1)[0] % digits.length],
    specialCharacters[randomBytes(1)[0] % specialCharacters.length],
  ];

  while (requiredCharacters.length < 12) {
    requiredCharacters.push(allCharacters[randomBytes(1)[0] % allCharacters.length]);
  }

  for (let index = requiredCharacters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomBytes(1)[0] % (index + 1);
    const currentValue = requiredCharacters[index] ?? '';

    requiredCharacters[index] = requiredCharacters[swapIndex] ?? currentValue;
    requiredCharacters[swapIndex] = currentValue;
  }

  return requiredCharacters.join('');
}

export function buildAccessibleTeamWhere(user: Pick<AuthenticatedUser, 'id' | 'role'>): Prisma.TeamWhereInput {
  if (user.role === UserRole.admin) {
    return {};
  }

  return {
    OR: [
      {
        createdByUserId: user.id,
      },
      {
        userAssignments: {
          some: {
            userId: user.id,
          },
        },
      },
    ],
  };
}

export async function getAccessibleTeamId(
  teamId: string,
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): Promise<{ id: string } | null> {
  return prisma.team.findFirst({
    where: {
      ...buildAccessibleTeamWhere(user),
      id: teamId,
    },
    select: {
      id: true,
    },
  });
}

async function readSessionUser(rawToken: string): Promise<AuthenticatedUser | null> {
  const session = await prisma.userSession.findUnique({
    where: {
      tokenHash: hashToken(rawToken),
    },
    select: {
      expiresAt: true,
      user: {
        select: {
          email: true,
          id: true,
          invitedBy: {
            select: {
              email: true,
            },
          },
          mustChangePassword: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || session.user.status !== UserStatus.active) {
    return null;
  }

  return toAuthenticatedUser(session.user);
}

export const getCurrentUserOrNull = cache(async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  return readSessionUser(rawToken);
});

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const currentUser = await getCurrentUserOrNull();

  if (!currentUser) {
    redirect('/login');
  }

  return currentUser;
}

export async function requireAdminUser(): Promise<AuthenticatedUser> {
  const currentUser = await requireAuthenticatedUser();

  if (currentUser.role !== UserRole.admin) {
    redirect('/');
  }

  return currentUser;
}

export async function createSessionForUser(userId: string, rememberMe: boolean): Promise<void> {
  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + getSessionLifetime(rememberMe));

  await prisma.userSession.create({
    data: {
      expiresAt,
      tokenHash: hashToken(rawToken),
      userId,
    },
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    expires: expiresAt,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    await prisma.userSession.deleteMany({
      where: {
        tokenHash: hashToken(rawToken),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  await prisma.userSession.deleteMany({
    where: {
      userId,
    },
  });
}

export async function authenticateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: {
      email: normalizeEmail(email),
    },
    select: {
      email: true,
      id: true,
      invitedBy: {
        select: {
          email: true,
        },
      },
      mustChangePassword: true,
      passwordHash: true,
      role: true,
      status: true,
    },
  });

  if (!user || user.status !== UserStatus.active) {
    return null;
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return toAuthenticatedUser(user);
}

export async function getRegistrationState(inviteToken?: string): Promise<RegistrationState> {
  const totalUsers = await prisma.user.count();

  if (totalUsers === 0) {
    return {
      bootstrapRegistrationOpen: true,
      invitedEmail: null,
      inviteTokenValid: true,
      requiresInvite: false,
    };
  }

  if (!inviteToken) {
    return {
      bootstrapRegistrationOpen: false,
      invitedEmail: null,
      inviteTokenValid: false,
      requiresInvite: true,
    };
  }

  const invite = await prisma.inviteToken.findUnique({
    where: {
      tokenHash: hashToken(inviteToken),
    },
    select: {
      usedAt: true,
      user: {
        select: {
          email: true,
          status: true,
        },
      },
    },
  });

  if (!invite || invite.usedAt || invite.user.status !== UserStatus.pending) {
    return {
      bootstrapRegistrationOpen: false,
      invitedEmail: null,
      inviteTokenValid: false,
      requiresInvite: true,
    };
  }

  return {
    bootstrapRegistrationOpen: false,
    invitedEmail: invite.user.email,
    inviteTokenValid: true,
    requiresInvite: true,
  };
}

export async function registerFirstUser(email: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (transaction) => {
    const totalUsers = await transaction.user.count();

    if (totalUsers > 0) {
      throw new Error('INVITE_REQUIRED');
    }

    await transaction.user.create({
      data: {
        email: normalizeEmail(email),
        passwordHash,
        passwordUpdatedAt: new Date(),
        role: UserRole.admin,
        status: UserStatus.active,
      },
    });
  });
}

export async function registerInvitedUser(inviteToken: string, email: string, password: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (transaction) => {
    const invite = await transaction.inviteToken.findUnique({
      where: {
        tokenHash: hashToken(inviteToken),
      },
      select: {
        id: true,
        usedAt: true,
        user: {
          select: {
            email: true,
            id: true,
            status: true,
          },
        },
      },
    });

    if (!invite || invite.usedAt || invite.user.status !== UserStatus.pending) {
      throw new Error('INVALID_INVITE');
    }

    if (normalizeEmail(invite.user.email) !== normalizedEmail) {
      throw new Error('INVITE_EMAIL_MISMATCH');
    }

    await transaction.user.update({
      where: {
        id: invite.user.id,
      },
      data: {
        mustChangePassword: false,
        passwordHash,
        passwordUpdatedAt: new Date(),
        status: UserStatus.active,
      },
    });

    await transaction.inviteToken.update({
      where: {
        id: invite.id,
      },
      data: {
        usedAt: new Date(),
      },
    });
  });
}

export async function createInviteForUser(email: string, invitedById: string): Promise<{ token: string; userId: string }> {
  const normalizedEmail = normalizeEmail(email);
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  const createdUser = await prisma.$transaction(async (transaction) => {
    const existingUser = await transaction.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existingUser) {
      throw new Error(existingUser.status === UserStatus.pending ? 'PENDING_USER_EXISTS' : 'USER_ALREADY_EXISTS');
    }

    const user = await transaction.user.create({
      data: {
        email: normalizedEmail,
        invitedById,
        role: UserRole.user,
        status: UserStatus.pending,
      },
      select: {
        id: true,
      },
    });

    await transaction.inviteToken.create({
      data: {
        tokenHash,
        userId: user.id,
      },
    });

    return user;
  });

  return {
    token: rawToken,
    userId: createdUser.id,
  };
}

export async function resetPendingInvite(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.pending) {
      throw new Error('USER_NOT_PENDING');
    }

    await transaction.inviteToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await transaction.inviteToken.create({
      data: {
        tokenHash,
        userId,
      },
    });
  });

  return rawToken;
}

export async function resetActiveUserPassword(userId: string): Promise<string> {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.active) {
      throw new Error('USER_NOT_ACTIVE');
    }

    await transaction.user.update({
      where: {
        id: userId,
      },
      data: {
        mustChangePassword: true,
        passwordHash,
      },
    });

    await transaction.userSession.deleteMany({
      where: {
        userId,
      },
    });
  });

  return temporaryPassword;
}

export async function updateUserRole(userId: string, role: UserRole, actorUserId: string): Promise<void> {
  if (userId === actorUserId) {
    throw new Error('CANNOT_CHANGE_OWN_ROLE');
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      status: true,
    },
  });

  if (!user || user.status !== UserStatus.active) {
    throw new Error('USER_NOT_ACTIVE');
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      role,
    },
  });
}

export async function updateUserTeamAssignments(userId: string, teamIds: string[]): Promise<void> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      status: true,
    },
  });

  if (!user || user.status !== UserStatus.active) {
    throw new Error('USER_NOT_ACTIVE');
  }

  const uniqueTeamIds = [...new Set(teamIds)];

  if (uniqueTeamIds.length > 0) {
    const existingTeams = await prisma.team.findMany({
      where: {
        id: {
          in: uniqueTeamIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingTeams.length !== uniqueTeamIds.length) {
      throw new Error('INVALID_TEAM_ASSIGNMENTS');
    }
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.userTeamAssignment.deleteMany({
      where: {
        userId,
      },
    });

    if (uniqueTeamIds.length === 0) {
      return;
    }

    await transaction.userTeamAssignment.createMany({
      data: uniqueTeamIds.map((teamId) => ({
        teamId,
        userId,
      })),
    });
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    await transaction.user.delete({
      where: {
        id: userId,
      },
    });
  });
}

export async function changeUserPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      mustChangePassword: false,
      passwordHash,
      passwordUpdatedAt: new Date(),
    },
  });
}