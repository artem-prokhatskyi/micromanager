'use client';

import type { MouseEvent, ReactElement } from 'react';
import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SPECIALIZATION_LABELS } from '@/types';
import type { TeamMemberRecord } from '@/types';
import { cn, sortWorkingDays } from '@/lib/utils';

interface TeamMemberCardProps {
  member: TeamMemberRecord;
}

function formatSpecializations(specializations: TeamMemberRecord['specialization']): string | null {
  if (specializations.length === 0) {
    return null;
  }

  return specializations.map((specialization) => SPECIALIZATION_LABELS[specialization]).join(', ');
}

export function TeamMemberCard({ member }: TeamMemberCardProps): ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const sortedWorkingDays = sortWorkingDays(member.workingDays);

  async function handleDelete(event: MouseEvent<HTMLButtonElement>): Promise<void> {
    event.preventDefault();
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/teams/${member.teamId}/members/${member.id}`, {
        method: 'DELETE',
      });
      const payload = (await response.json()) as { error?: { message: string } };

      if (!response.ok) {
        toast({ title: payload.error?.message ?? 'Failed to remove member.', variant: 'destructive' });
        return;
      }

      toast({ title: `Removed ${member.name}` });
      router.refresh();
    } catch {
      toast({ title: 'Failed to remove member.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <article className="rounded-3xl border border-border/80 bg-card/70 p-6 shadow-2xl shadow-black/10 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{member.name}</h2>
          <p className="text-sm text-muted-foreground">{member.jiraEmail}</p>
        </div>
        <div className="flex gap-3">
          <Link className={buttonVariants({ size: 'sm', variant: 'outline' })} href={`/teams/${member.teamId}/members/${member.id}/edit`}>
            Edit
          </Link>
          <AlertDialog>
            <AlertDialogTrigger className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }), 'text-red-300 hover:bg-red-950/50 hover:text-red-100')}>
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {member.name} from the team?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will also remove their non-working day records. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={isDeleting} onClick={handleDelete}>
                  {isDeleting ? 'Removing...' : 'Remove member'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {sortedWorkingDays.map((day) => (
          <Badge key={day} variant="secondary">
            {day}
          </Badge>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-6 text-sm text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Focus factor</p>
          <p>{member.defaultFocusFactor.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium text-foreground">GitHub</p>
          <p>{member.githubUsername || 'Not set'}</p>
        </div>
        <div>
          <p className="font-medium text-foreground">Specialization</p>
          <p>{formatSpecializations(member.specialization) ?? 'Not set'}</p>
        </div>
      </div>
    </article>
  );
}