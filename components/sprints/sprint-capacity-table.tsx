'use client';

import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { calculateCapacity } from '@/lib/capacity';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CapacityRow } from '@/components/sprints/capacity-row';
import { SprintHeader } from '@/components/sprints/sprint-header';
import { SprintSelector } from '@/components/sprints/sprint-selector';
import { useToast } from '@/hooks/use-toast';
import type { MemberCapacityData, SprintOption } from '@/types';

interface SprintCapacityTableProps {
  teamId: string;
  sprint: {
    id: string;
    name: string;
    plannedStart: string;
    plannedEnd: string;
    actualEnd: string | null;
    isOverdue: boolean;
  };
  sprints: SprintOption[];
  members: MemberCapacityData[];
}

function updateMemberCapacity(member: MemberCapacityData, nextFocusFactor: number): MemberCapacityData {
  return {
    ...member,
    focusFactor: nextFocusFactor,
    plannedCapacity: calculateCapacity(member.plannedWorkingDays, nextFocusFactor),
    actualCapacity:
      member.actualWorkingDays === null
        ? null
        : calculateCapacity(member.actualWorkingDays, nextFocusFactor),
  };
}

export function SprintCapacityTable({ members, sprint, sprints, teamId }: SprintCapacityTableProps): ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<MemberCapacityData[]>(members);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const totals = useMemo(
    () => ({
      plannedCapacity: rows.reduce((total, member) => total + member.plannedCapacity, 0),
      actualCapacity: sprint.isOverdue
        ? rows.reduce((total, member) => total + (member.actualCapacity ?? 0), 0)
        : null,
    }),
    [rows, sprint.isOverdue],
  );

  async function handleCommitFocusFactor(memberId: string, nextValue: number, previousValue: number): Promise<void> {
    setRows((currentRows) =>
      currentRows.map((member) =>
        member.memberId === memberId ? updateMemberCapacity(member, nextValue) : member,
      ),
    );

    try {
      const response = await fetch(`/api/teams/${teamId}/sprints/${sprint.id}/focus-factors`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId, focusFactor: nextValue }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? 'Failed to update focus factor.');
      }
    } catch (error) {
      setRows((currentRows) =>
        currentRows.map((member) =>
          member.memberId === memberId ? updateMemberCapacity(member, previousValue) : member,
        ),
      );

      throw (error instanceof Error ? error : new Error('Failed to update focus factor.'));
    }
  }

  async function handleSyncSprint(): Promise<void> {
    setIsSyncing(true);

    try {
      const response = await fetch(`/api/teams/${teamId}/sprints/${sprint.id}`, {
        method: 'PUT',
      });
      const payload = (await response.json()) as { error?: { message?: string } };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? 'Failed to sync sprint.');
      }

      toast({ title: 'Sprint synced from Jira.' });
      router.refresh();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to sync sprint.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDeleteSprint(): Promise<void> {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/teams/${teamId}/sprints/${sprint.id}`, {
        method: 'DELETE',
      });
      const payload = (await response.json()) as { error?: { message?: string } };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? 'Failed to delete sprint.');
      }

      toast({ title: `Deleted ${sprint.name}` });
      router.push(`/teams/${teamId}/sprints`);
      router.refresh();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to delete sprint.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SprintSelector currentSprintId={sprint.id} sprints={sprints} teamId={teamId} />
          <div className="flex flex-wrap gap-3">
            <a className={buttonVariants({ variant: 'outline' })} href={`/api/teams/${teamId}/sprints/${sprint.id}/export`}>
              Export CSV
            </a>
            <Button disabled={isSyncing} onClick={() => void handleSyncSprint()} type="button" variant="outline">
              {isSyncing ? 'Syncing...' : 'Sync from Jira'}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500">
                Delete sprint
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {sprint.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This also removes per-sprint focus factors and cached issue data for the sprint, including GitHub metrics.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={isDeleting} onClick={() => void handleDeleteSprint()}>
                    {isDeleting ? 'Deleting...' : 'Delete sprint'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <SprintHeader
          actualEnd={sprint.actualEnd}
          isOverdue={sprint.isOverdue}
          name={sprint.name}
          plannedEnd={sprint.plannedEnd}
          plannedStart={sprint.plannedStart}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Planned working days</TableHead>
              <TableHead>Focus factor</TableHead>
              <TableHead>Planned capacity</TableHead>
              {sprint.isOverdue ? (
                <>
                  <TableHead>Actual working days</TableHead>
                  <TableHead>Actual capacity</TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((member) => (
              <CapacityRow
                isOverdue={sprint.isOverdue}
                key={member.memberId}
                member={member}
                onCommitFocusFactor={handleCommitFocusFactor}
              />
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold text-foreground">Totals</TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="font-semibold text-foreground">{totals.plannedCapacity.toFixed(1)} SP</TableCell>
              {sprint.isOverdue ? (
                <>
                  <TableCell />
                  <TableCell className="font-semibold text-foreground">{(totals.actualCapacity ?? 0).toFixed(1)} SP</TableCell>
                </>
              ) : null}
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}