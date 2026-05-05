'use client';

import type { FormEvent, ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { ManagedUserRecord, TeamOption, UserStatus } from '@/types';

interface UserManagementPanelProps {
  currentUserEmail: string;
  currentUserId: string;
  initialUsers: ManagedUserRecord[];
  teams: TeamOption[];
}

interface ApiErrorPayload {
  error?: {
    details?: Record<string, string>;
    message?: string;
  };
}

interface NoticeState {
  kind: 'invite' | 'password';
  value: string;
}

function readApiError(payload: unknown): ApiErrorPayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  return payload as ApiErrorPayload;
}

function getStatusVariant(status: UserStatus): 'default' | 'destructive' | 'outline' | 'secondary' {
  if (status === 'active') {
    return 'default';
  }

  if (status === 'deactivated') {
    return 'destructive';
  }

  return 'outline';
}

export function UserManagementPanel({ currentUserEmail, currentUserId, initialUsers, teams }: UserManagementPanelProps): ReactElement {
  const [users, setUsers] = useState<ManagedUserRecord[]>(initialUsers);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState<boolean>(false);
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => left.email.localeCompare(right.email)),
    [users],
  );

  function setLoading(key: string, value: boolean): void {
    setLoadingKeys((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setInviteError(null);
    setNotice(null);
    setIsCreatingInvite(true);

    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
        }),
      });
      const payload = await response.json();
      const apiError = readApiError(payload);

      if (!response.ok) {
        setInviteError(apiError.error?.details?.email ?? apiError.error?.message ?? 'Failed to create invite.');
        return;
      }

      const inviteLink = `${window.location.origin}/register?token=${payload.data.inviteToken}`;

      setUsers((current) => [
        ...current,
        {
          assignedTeamIds: [],
          assignedTeams: [],
          email: inviteEmail.trim().toLowerCase(),
          id: payload.data.userId,
          invitedByEmail: currentUserEmail,
          role: 'user',
          status: 'pending',
        },
      ]);
      setInviteEmail('');
      setNotice({
        kind: 'invite',
        value: inviteLink,
      });
    } catch {
      setInviteError('Failed to create invite.');
    } finally {
      setIsCreatingInvite(false);
    }
  }

  async function handleRoleChange(userId: string, role: 'admin' | 'user'): Promise<void> {
    const key = `role:${userId}`;
    setLoading(key, true);

    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });
      const payload = await response.json();
      const apiError = readApiError(payload);

      if (!response.ok) {
        setNotice(null);
        setInviteError(apiError.error?.message ?? 'Failed to update role.');
        return;
      }

      setUsers((current) => current.map((user) => (user.id === userId ? { ...user, role } : user)));
    } catch {
      setInviteError('Failed to update role.');
    } finally {
      setLoading(key, false);
    }
  }

  async function handleAssignmentToggle(user: ManagedUserRecord, teamId: string, checked: boolean): Promise<void> {
    const key = `assign:${user.id}`;
    setLoading(key, true);
    setInviteError(null);

    const nextTeamIds = checked
      ? [...user.assignedTeamIds, teamId]
      : user.assignedTeamIds.filter((currentTeamId) => currentTeamId !== teamId);

    try {
      const response = await fetch(`/api/users/${user.id}/assignments`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teamIds: nextTeamIds }),
      });
      const payload = await response.json();
      const apiError = readApiError(payload);

      if (!response.ok) {
        setInviteError(apiError.error?.message ?? 'Failed to update assignments.');
        return;
      }

      setUsers((current) =>
        current.map((currentUser) =>
          currentUser.id === user.id
            ? {
                ...currentUser,
                assignedTeamIds: nextTeamIds,
                assignedTeams: teams.filter((team) => nextTeamIds.includes(team.id)),
              }
            : currentUser,
        ),
      );
    } catch {
      setInviteError('Failed to update assignments.');
    } finally {
      setLoading(key, false);
    }
  }

  async function handleReset(user: ManagedUserRecord): Promise<void> {
    const key = `reset:${user.id}`;
    setLoading(key, true);
    setInviteError(null);

    try {
      const response = await fetch(`/api/users/${user.id}/reset`, {
        method: 'POST',
      });
      const payload = await response.json();
      const apiError = readApiError(payload);

      if (!response.ok) {
        setInviteError(apiError.error?.message ?? 'Failed to reset user.');
        return;
      }

      if (payload.data.inviteToken) {
        setNotice({
          kind: 'invite',
          value: `${window.location.origin}/register?token=${payload.data.inviteToken}`,
        });
        return;
      }

      if (payload.data.temporaryPassword) {
        setNotice({
          kind: 'password',
          value: payload.data.temporaryPassword,
        });
      }
    } catch {
      setInviteError('Failed to reset user.');
    } finally {
      setLoading(key, false);
    }
  }

  async function handleDelete(userId: string): Promise<void> {
    const key = `delete:${userId}`;
    setLoading(key, true);
    setInviteError(null);

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      const payload = await response.json();
      const apiError = readApiError(payload);

      if (!response.ok) {
        setInviteError(apiError.error?.message ?? 'Failed to delete user.');
        return;
      }

      setUsers((current) => current.filter((user) => user.id !== userId));
    } catch {
      setInviteError('Failed to delete user.');
    } finally {
      setLoading(key, false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Invite</CardTitle>
          <CardDescription>Create a one-time registration link for a new user.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4 md:flex-row md:items-end" onSubmit={handleInvite}>
            <div className="flex-1 space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@company.com"
                type="email"
                value={inviteEmail}
              />
            </div>
            <Button disabled={isCreatingInvite} type="submit">
              {isCreatingInvite ? 'Generating...' : 'Generate invite'}
            </Button>
          </form>
          {inviteError ? <p className="mt-3 text-sm text-red-300">{inviteError}</p> : null}
          {notice ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-100">
              <p className="font-medium">
                {notice.kind === 'invite' ? 'One-time invite link' : 'Temporary password'}
              </p>
              <p className="mt-1 break-all">{notice.value}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sortedUsers.map((user) => {
          const isSelf = user.id === currentUserId;
          const isActive = user.status === 'active';
          const isPending = user.status === 'pending';
          const assignmentsSaving = Boolean(loadingKeys[`assign:${user.id}`]);
          const roleSaving = Boolean(loadingKeys[`role:${user.id}`]);
          const resetSaving = Boolean(loadingKeys[`reset:${user.id}`]);
          const deleteSaving = Boolean(loadingKeys[`delete:${user.id}`]);

          return (
            <Card key={user.id}>
              <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-lg">{user.email}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getStatusVariant(user.status)}>{user.status}</Badge>
                    <Badge variant="secondary">{user.role}</Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Invited by {user.invitedByEmail ?? 'system'}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label htmlFor={`role-${user.id}`}>Role</Label>
                    <Select
                      disabled={!isActive || isSelf || roleSaving}
                      id={`role-${user.id}`}
                      onChange={(event) => void handleRoleChange(user.id, event.target.value as 'admin' | 'user')}
                      value={user.role}
                    >
                      <option value="admin">admin</option>
                      <option value="user">user</option>
                    </Select>
                    {isSelf ? <p className="text-xs text-muted-foreground">You cannot change your own role.</p> : null}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Assigned teams</Label>
                      {assignmentsSaving ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
                    </div>
                    {isActive ? (
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {teams.map((team) => (
                          <label
                            className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/40 px-3 py-2 text-sm"
                            htmlFor={`team-${user.id}-${team.id}`}
                            key={team.id}
                          >
                            <input
                              checked={user.assignedTeamIds.includes(team.id)}
                              className="h-4 w-4 rounded border border-input bg-background"
                              disabled={assignmentsSaving}
                              id={`team-${user.id}-${team.id}`}
                              onChange={(event) => void handleAssignmentToggle(user, team.id, event.target.checked)}
                              type="checkbox"
                            />
                            <span>{team.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {isPending
                          ? 'Assignments become available after registration.'
                          : 'Assignments are disabled for deactivated users.'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button disabled={resetSaving || user.status === 'deactivated'} onClick={() => void handleReset(user)} type="button" variant="outline">
                    {resetSaving ? 'Resetting...' : 'Reset'}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:pointer-events-none disabled:opacity-50" disabled={deleteSaving || user.status === 'deactivated'}>
                      {deleteSaving ? 'Deleting...' : 'Delete'}
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete user?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently removes the user account, terminates active sessions, and deletes pending invites and assignments.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleDelete(user.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}