'use client';

import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { AddSprintFormValues, ApiError, ApiSuccess, JiraSprintMetadata, SprintOption, SprintRecord, SprintValidationErrors, TeamOption } from '@/types';

interface AddSprintFormProps {
  teamId: string;
  teams: TeamOption[];
}

interface MultipleSprintMatches {
  multiple: true;
  options: JiraSprintMetadata[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && isRecord(value.error) && typeof value.error.message === 'string';
}

function isSprintSuccess(value: unknown): value is ApiSuccess<SprintRecord> {
  return isRecord(value) && isRecord(value.data) && typeof value.data.id === 'string';
}

function isMultipleMatchSuccess(value: unknown): value is ApiSuccess<MultipleSprintMatches> {
  return (
    isRecord(value) &&
    isRecord(value.data) &&
    value.data.multiple === true &&
    Array.isArray(value.data.options)
  );
}

export function AddSprintForm({ teamId, teams }: AddSprintFormProps): ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<AddSprintFormValues>({
    teamId,
    sprintName: '',
    jiraSprintId: '',
  });
  const [errors, setErrors] = useState<SprintValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [matches, setMatches] = useState<JiraSprintMetadata[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrors({});
    setSubmitError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/teams/${values.teamId}/sprints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sprintName: values.sprintName,
          jiraSprintId: values.jiraSprintId ? Number(values.jiraSprintId) : undefined,
        }),
      });
      const payload: unknown = await response.json();

      if (response.ok && isSprintSuccess(payload)) {
        toast({ title: `Added sprint ${payload.data.name}` });
        router.push(`/teams/${values.teamId}/sprints/${payload.data.id}`);
        router.refresh();
        return;
      }

      if (response.ok && isMultipleMatchSuccess(payload)) {
        setMatches(payload.data.options);
        setValues((current) => ({
          ...current,
          jiraSprintId: String(payload.data.options[0]?.id ?? ''),
        }));
        return;
      }

      if (isApiError(payload)) {
        if (response.status === 400) {
          setErrors({
            sprintName: payload.error.details?.sprintName,
            jiraSprintId: payload.error.details?.jiraSprintId,
          });
        }

        setSubmitError(payload.error.message);
        return;
      }

      setSubmitError('Failed to add sprint.');
    } catch {
      setSubmitError('Failed to add sprint.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Sprint</CardTitle>
        <CardDescription>
          Look up a sprint by name in Jira and attach it to the selected team so capacity can be calculated automatically.
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
            <Label htmlFor="sprint-team-id">Team</Label>
            <Select
              id="sprint-team-id"
              onChange={(event) => setValues((current) => ({ ...current, teamId: event.target.value }))}
              value={values.teamId}
            >
              {teams.map((teamOption) => (
                <option key={teamOption.id} value={teamOption.id}>
                  {teamOption.name}
                </option>
              ))}
            </Select>
            {errors.teamId ? <p className="text-sm text-red-300">{errors.teamId}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sprint-name">Sprint name</Label>
            <Input
              id="sprint-name"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sprintName: event.target.value,
                }))
              }
              placeholder="Sprint 42"
              value={values.sprintName}
            />
            {errors.sprintName ? <p className="text-sm text-red-300">{errors.sprintName}</p> : null}
          </div>

          {matches.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="jira-sprint-id">Matching Jira sprints</Label>
              <Select
                id="jira-sprint-id"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    jiraSprintId: event.target.value,
                  }))
                }
                value={values.jiraSprintId}
              >
                {matches.map((match) => (
                  <option key={match.id} value={String(match.id)}>
                    {match.name} ({match.state})
                  </option>
                ))}
              </Select>
              <p className="text-sm text-muted-foreground">
                Jira returned multiple sprints with this name. Pick the exact sprint to import.
              </p>
              {errors.jiraSprintId ? <p className="text-sm text-red-300">{errors.jiraSprintId}</p> : null}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button disabled={isSaving} type="submit">
              {isSaving ? 'Searching Jira...' : matches.length > 0 ? 'Add selected sprint' : 'Find in Jira'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}