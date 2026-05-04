'use client';

import type { FormEvent, ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { AddSprintFormValues, ApiError, ApiSuccess, JiraSprintMetadata, SprintRecord, SprintValidationErrors, TeamOption } from '@/types';

interface AddSprintFormProps {
  teamId: string;
  teams: TeamOption[];
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

function isJiraSprintMetadata(value: unknown): value is JiraSprintMetadata {
  return isRecord(value)
    && typeof value.id === 'number'
    && typeof value.name === 'string'
    && typeof value.state === 'string';
}

function isAvailableSprintsSuccess(value: unknown): value is ApiSuccess<JiraSprintMetadata[]> {
  return isRecord(value)
    && Array.isArray(value.data)
    && value.data.every((entry) => isJiraSprintMetadata(entry));
}

export function AddSprintForm({ teamId, teams }: AddSprintFormProps): ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<AddSprintFormValues>({
    teamId,
    jiraSprintId: '',
  });
  const [errors, setErrors] = useState<SprintValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [availableSprints, setAvailableSprints] = useState<JiraSprintMetadata[]>([]);
  const [isLoadingSprints, setIsLoadingSprints] = useState<boolean>(true);

  useEffect(() => {
    let isActive = true;

    async function loadAvailableSprints(): Promise<void> {
      setIsLoadingSprints(true);
      setSubmitError(null);
      setErrors({});

      try {
        const response = await fetch(`/api/teams/${values.teamId}/sprints?scope=available`);
        const payload: unknown = await response.json();

        if (response.ok && isAvailableSprintsSuccess(payload)) {
          if (!isActive) {
            return;
          }

          setAvailableSprints(payload.data);
          setValues((current) => ({
            ...current,
            jiraSprintId: payload.data[0] ? String(payload.data[0].id) : '',
          }));
          return;
        }

        if (isApiError(payload) && isActive) {
          setSubmitError(payload.error.message);
          setAvailableSprints([]);
          setValues((current) => ({ ...current, jiraSprintId: '' }));
          return;
        }

        if (isActive) {
          setSubmitError('Failed to load available Jira sprints.');
          setAvailableSprints([]);
          setValues((current) => ({ ...current, jiraSprintId: '' }));
        }
      } catch {
        if (isActive) {
          setSubmitError('Failed to load available Jira sprints.');
          setAvailableSprints([]);
          setValues((current) => ({ ...current, jiraSprintId: '' }));
        }
      } finally {
        if (isActive) {
          setIsLoadingSprints(false);
        }
      }
    }

    void loadAvailableSprints();

    return () => {
      isActive = false;
    };
  }, [values.teamId]);

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

      if (isApiError(payload)) {
        if (response.status === 400) {
          setErrors({
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
          Pick any Jira sprint that is not yet attached to this team, including previous closed sprints, and import it as the source of truth for capacity planning.
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
            <Label htmlFor="jira-sprint-id">Available Jira sprints</Label>
            <Select
              disabled={isLoadingSprints || availableSprints.length === 0}
              id="jira-sprint-id"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  jiraSprintId: event.target.value,
                }))
              }
              value={values.jiraSprintId}
            >
              {availableSprints.length === 0 ? <option value="">No available sprints</option> : null}
              {availableSprints.map((sprint) => (
                <option key={sprint.id} value={String(sprint.id)}>
                  {sprint.name} ({sprint.state})
                </option>
              ))}
            </Select>
            <p className="text-sm text-muted-foreground">
              {isLoadingSprints
                ? 'Loading Jira sprints for the selected team...'
                : 'Only Jira sprints that are not already added for this team are shown here, including closed sprints.'}
            </p>
            {errors.jiraSprintId ? <p className="text-sm text-red-300">{errors.jiraSprintId}</p> : null}
          </div>

          <div className="flex justify-end">
            <Button disabled={isSaving || isLoadingSprints || values.jiraSprintId.length === 0} type="submit">
              {isSaving ? 'Adding sprint...' : 'Add sprint'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}