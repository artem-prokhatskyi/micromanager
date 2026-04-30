'use client';

import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { ApiError, ApiSuccess, CreateTeamValues, TeamValidationErrors } from '@/types';

interface CreateTeamResponse {
  id: string;
  name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && isRecord(value.error) && typeof value.error.message === 'string';
}

function isApiSuccess(value: unknown): value is ApiSuccess<CreateTeamResponse> {
  return isRecord(value) && isRecord(value.data) && typeof value.data.id === 'string';
}

function parseRepositories(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function CreateTeamForm(): ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<CreateTeamValues>({
    name: '',
    jiraSpace: '',
    githubRepositories: '',
  });
  const [errors, setErrors] = useState<TeamValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrors({});
    setSubmitError(null);
    setIsSaving(true);

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          jiraSpace: values.jiraSpace,
          githubRepositories: parseRepositories(values.githubRepositories),
        }),
      });
      const payload: unknown = await response.json();

      if (response.ok && isApiSuccess(payload)) {
        toast({ title: `Created team ${payload.data.name}` });
        router.push(`/teams/${payload.data.id}/members/new`);
        router.refresh();
        return;
      }

      if (isApiError(payload)) {
        if (response.status === 400) {
          setErrors({
            name: payload.error.details?.name,
            jiraSpace: payload.error.details?.jiraSpace,
            githubRepositories: payload.error.details?.githubRepositories,
          });
        }

        setSubmitError(payload.error.message);
        return;
      }

      setSubmitError('Failed to create team.');
    } catch {
      setSubmitError('Failed to create team.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Team</CardTitle>
        <CardDescription>
          Add a Jira-backed team so member management, sprint imports, and capacity views can anchor to a real project key.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {submitError ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-100">
              {submitError}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="Platform"
              value={values.name}
            />
            {errors.name ? <p className="text-sm text-red-300">{errors.name}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="jira-space">Jira space / project key</Label>
            <Input
              id="jira-space"
              onChange={(event) => setValues((current) => ({ ...current, jiraSpace: event.target.value }))}
              placeholder="PROJ"
              value={values.jiraSpace}
            />
            {errors.jiraSpace ? <p className="text-sm text-red-300">{errors.jiraSpace}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="github-repositories">GitHub repositories</Label>
            <Input
              id="github-repositories"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  githubRepositories: event.target.value,
                }))
              }
              placeholder="repo-one, repo-two"
              value={values.githubRepositories}
            />
            <p className="text-sm text-muted-foreground">Optional. Use commas to separate multiple repositories.</p>
            {errors.githubRepositories ? <p className="text-sm text-red-300">{errors.githubRepositories}</p> : null}
          </div>

          <div className="flex justify-end">
            <Button disabled={isSaving} type="submit">
              {isSaving ? 'Creating...' : 'Create team'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}