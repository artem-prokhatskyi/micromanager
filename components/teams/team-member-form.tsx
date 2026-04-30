'use client';

import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { WorkingDaysToggle } from '@/components/teams/working-days-toggle';
import { useToast } from '@/hooks/use-toast';
import { SPECIALIZATION, WEEK_DAYS } from '@/types';
import type {
  ApiError,
  ApiSuccess,
  TeamMemberFormValues,
  TeamMemberRecord,
  TeamMemberValidationErrors,
  TeamOption,
} from '@/types';

interface TeamMemberFormProps {
  initialValues?: TeamMemberRecord;
  mode: 'create' | 'edit';
  teams: TeamOption[];
  teamId: string;
}

interface TeamMemberFormResponse extends TeamMemberRecord {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && isRecord(value.error) && typeof value.error.message === 'string';
}

function isApiSuccess(value: unknown): value is ApiSuccess<TeamMemberFormResponse> {
  return isRecord(value) && isRecord(value.data) && typeof value.data.id === 'string';
}

function getDefaultValues(initialValues: TeamMemberRecord | undefined, teamId: string): TeamMemberFormValues {
  return {
    teamId: initialValues?.teamId ?? teamId,
    name: initialValues?.name ?? '',
    jiraEmail: initialValues?.jiraEmail ?? '',
    githubUsername: initialValues?.githubUsername ?? '',
    workingDays: initialValues?.workingDays ?? [...WEEK_DAYS],
    defaultFocusFactor: initialValues ? String(initialValues.defaultFocusFactor) : '0.8',
    frontendSpecialization:
      initialValues?.specialization === SPECIALIZATION.FRONTEND ||
      initialValues?.specialization === SPECIALIZATION.BOTH,
    backendSpecialization:
      initialValues?.specialization === SPECIALIZATION.BACKEND ||
      initialValues?.specialization === SPECIALIZATION.BOTH,
  };
}

function toSpecialization(values: TeamMemberFormValues): TeamMemberRecord['specialization'] {
  if (values.frontendSpecialization && values.backendSpecialization) {
    return SPECIALIZATION.BOTH;
  }

  if (values.frontendSpecialization) {
    return SPECIALIZATION.FRONTEND;
  }

  if (values.backendSpecialization) {
    return SPECIALIZATION.BACKEND;
  }

  return null;
}

function getClientValidationErrors(values: TeamMemberFormValues): TeamMemberValidationErrors {
  const errors: TeamMemberValidationErrors = {};
  const focusFactor = Number(values.defaultFocusFactor);

  if (!values.name.trim()) {
    errors.name = 'Name is required.';
  }

  if (!values.jiraEmail.trim()) {
    errors.jiraEmail = 'Jira email is required.';
  }

  if (values.workingDays.length === 0) {
    errors.workingDays = 'Select at least one working day.';
  }

  if (!Number.isFinite(focusFactor) || focusFactor <= 0 || focusFactor > 1) {
    errors.defaultFocusFactor = 'Must be between 0 and 1';
  }

  if (!values.teamId) {
    errors.teamId = 'Team is required.';
  }

  return errors;
}

export function TeamMemberForm({ initialValues, mode, teamId, teams }: TeamMemberFormProps): ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<TeamMemberFormValues>(getDefaultValues(initialValues, teamId));
  const [errors, setErrors] = useState<TeamMemberValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const clientErrors = getClientValidationErrors(values);

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSaving(true);

    try {
      const payload = {
        name: values.name,
        jiraEmail: values.jiraEmail,
        githubUsername: values.githubUsername,
        workingDays: values.workingDays,
        defaultFocusFactor: Number(values.defaultFocusFactor),
        specialization: toSpecialization(values),
      };

      const response = await fetch(
        mode === 'create'
          ? `/api/teams/${values.teamId}/members`
          : `/api/teams/${teamId}/members/${initialValues?.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      const result: unknown = await response.json();

      if (response.ok && isApiSuccess(result)) {
        toast({ title: mode === 'create' ? `Added ${result.data.name}` : `Updated ${result.data.name}` });
        router.push(`/teams/${values.teamId}/members`);
        router.refresh();
        return;
      }

      if (isApiError(result)) {
        if (response.status === 400) {
          setErrors({
            teamId: result.error.details?.teamId,
            name: result.error.details?.name,
            jiraEmail: result.error.details?.jiraEmail,
            githubUsername: result.error.details?.githubUsername,
            workingDays: result.error.details?.workingDays,
            defaultFocusFactor: result.error.details?.defaultFocusFactor,
            specialization: result.error.details?.specialization,
          });
        }

        setSubmitError(result.error.message);
        return;
      }

      setSubmitError('Failed to save team member.');
    } catch {
      setSubmitError('Failed to save team member.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Add Team Member' : 'Edit Team Member'}</CardTitle>
        <CardDescription>
          Configure Jira identity, working week, and focus factor so sprint capacity and issue filtering have a reliable source of truth.
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
            <Label htmlFor="team-member-name">Name</Label>
            <Input
              id="team-member-name"
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              value={values.name}
            />
            {errors.name ? <p className="text-sm text-red-300">{errors.name}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-member-email">Jira email</Label>
            <Input
              id="team-member-email"
              onChange={(event) => setValues((current) => ({ ...current, jiraEmail: event.target.value }))}
              type="email"
              value={values.jiraEmail}
            />
            {errors.jiraEmail ? <p className="text-sm text-red-300">{errors.jiraEmail}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>Working days</Label>
            <WorkingDaysToggle
              error={errors.workingDays}
              onChange={(workingDays) => setValues((current) => ({ ...current, workingDays }))}
              value={values.workingDays}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-member-focus-factor">Default focus factor</Label>
            <Input
              id="team-member-focus-factor"
              max="1"
              min="0"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  defaultFocusFactor: event.target.value,
                }))
              }
              placeholder="0.8"
              step="0.01"
              type="number"
              value={values.defaultFocusFactor}
            />
            {errors.defaultFocusFactor ? <p className="text-sm text-red-300">{errors.defaultFocusFactor}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-member-github-username">GitHub username</Label>
            <Input
              id="team-member-github-username"
              onChange={(event) => setValues((current) => ({ ...current, githubUsername: event.target.value }))}
              value={values.githubUsername}
            />
          </div>

          <div className="space-y-3">
            <Label>Specialization</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={values.frontendSpecialization}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      frontendSpecialization: event.target.checked,
                    }))
                  }
                />
                <span>Frontend</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={values.backendSpecialization}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      backendSpecialization: event.target.checked,
                    }))
                  }
                />
                <span>Backend</span>
              </label>
            </div>
            {errors.specialization ? <p className="text-sm text-red-300">{errors.specialization}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-member-team-id">Team</Label>
            <Select
              disabled={mode === 'edit'}
              id="team-member-team-id"
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

          <div className="flex justify-end">
            <Button disabled={isSaving} type="submit">
              {isSaving ? 'Saving...' : mode === 'create' ? 'Add member' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}