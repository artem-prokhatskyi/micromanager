import type { ReactElement } from 'react';

import { UserManagementPanel } from '@/components/users/user-management-panel';
import { requireAdminUser } from '@/lib/auth';
import { getAllTeamOptionsForAdmin, getManagedUsers } from '@/lib/data/user';

export default async function UsersPage(): Promise<ReactElement> {
  const currentUser = await requireAdminUser();
  const [users, teams] = await Promise.all([
    getManagedUsers(),
    getAllTeamOptionsForAdmin(),
  ]);

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">User Management</h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          Manage invites, roles, and team assignments for active, pending, and deactivated users.
        </p>
      </div>
      <UserManagementPanel currentUserEmail={currentUser.email} currentUserId={currentUser.id} initialUsers={users} teams={teams} />
    </section>
  );
}