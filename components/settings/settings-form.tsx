'use client';

import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type {
  ApiError,
  ApiSuccess,
  SettingsFormValues,
  SettingsPageData,
  SettingsValidationErrors,
} from '@/types';

interface SettingsFormProps {
  initialValues: SettingsPageData;
}

interface SaveSuccess {
  success: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiError(value: unknown): value is ApiError {
  if (!isRecord(value) || !isRecord(value.error)) {
    return false;
  }

  return typeof value.error.message === 'string';
}

function isApiSuccess(value: unknown): value is ApiSuccess<SaveSuccess> {
  if (!isRecord(value) || !isRecord(value.data)) {
    return false;
  }

  return value.data.success === true;
}

function getErrorDetails(error: ApiError): SettingsValidationErrors {
  const details = error.error.details;

  if (!details) {
    return {};
  }

  return {
    jiraDomain: details.jiraDomain,
    jiraEmail: details.jiraEmail,
    jiraApiKey: details.jiraApiKey,
    storyPointsFieldId: details.storyPointsFieldId,
    githubApiKey: details.githubApiKey,
  };
}

export function SettingsForm({ initialValues }: SettingsFormProps): ReactElement {
  const { toast } = useToast();
  const [values, setValues] = useState<SettingsFormValues>({
    jiraDomain: initialValues.jiraDomain,
    jiraEmail: initialValues.jiraEmail,
    jiraApiKey: '',
    storyPointsFieldId: initialValues.storyPointsFieldId,
    githubApiKey: '',
  });
  const [errors, setErrors] = useState<SettingsValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasJiraKey, setHasJiraKey] = useState<boolean>(initialValues.hasJiraKey);
  const [hasGithubKey, setHasGithubKey] = useState<boolean>(initialValues.hasGithubKey);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setErrors({});
    setSubmitError(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const payload: unknown = await response.json();

      if (response.ok && isApiSuccess(payload)) {
        setHasJiraKey(hasJiraKey || values.jiraApiKey.trim().length > 0);
        setHasGithubKey(hasGithubKey || values.githubApiKey.trim().length > 0);
        setValues((current) => ({
          ...current,
          jiraApiKey: '',
          githubApiKey: '',
        }));
        toast({ title: 'Connected to Jira successfully' });
        return;
      }

      if (isApiError(payload)) {
        if (response.status === 400) {
          setErrors(getErrorDetails(payload));
          setSubmitError(payload.error.message);
          return;
        }

        if (response.status === 502) {
          setHasJiraKey(hasJiraKey || values.jiraApiKey.trim().length > 0);
          setHasGithubKey(hasGithubKey || values.githubApiKey.trim().length > 0);
          setValues((current) => ({
            ...current,
            jiraApiKey: '',
            githubApiKey: '',
          }));
          setSubmitError(`Jira credentials saved but connection failed: ${payload.error.message}`);
          return;
        }

        setSubmitError(payload.error.message);
        return;
      }

      setSubmitError('Failed to save settings.');
    } catch {
      setSubmitError('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  }

  function updateValue<K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]): void {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jira Connection</CardTitle>
        <CardDescription>
          Save global Jira credentials for sprint imports and issue synchronization. Secrets stay on the server and are masked on subsequent edits.
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
            <Label htmlFor="jira-domain">Jira domain</Label>
            <Input
              autoComplete="off"
              id="jira-domain"
              onChange={(event) => updateValue('jiraDomain', event.target.value)}
              placeholder="your-domain.atlassian.net"
              value={values.jiraDomain}
            />
            {errors.jiraDomain ? <p className="text-sm text-red-300">{errors.jiraDomain}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="jira-email">Jira email</Label>
            <Input
              autoComplete="email"
              id="jira-email"
              onChange={(event) => updateValue('jiraEmail', event.target.value)}
              placeholder="name@company.com"
              type="email"
              value={values.jiraEmail}
            />
            {errors.jiraEmail ? <p className="text-sm text-red-300">{errors.jiraEmail}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="jira-api-key">Jira API key</Label>
            <Input
              autoComplete="new-password"
              id="jira-api-key"
              onChange={(event) => updateValue('jiraApiKey', event.target.value)}
              placeholder={hasJiraKey ? 'Leave blank to keep existing key' : 'Paste Jira API key'}
              type="password"
              value={values.jiraApiKey}
            />
            {hasJiraKey ? <p className="text-sm text-muted-foreground">A Jira API key is already stored. Leave this blank to keep it.</p> : null}
            {errors.jiraApiKey ? <p className="text-sm text-red-300">{errors.jiraApiKey}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="story-points-field-id">Story points field ID</Label>
            <Input
              id="story-points-field-id"
              onChange={(event) => updateValue('storyPointsFieldId', event.target.value)}
              placeholder="story_points"
              value={values.storyPointsFieldId}
            />
            {errors.storyPointsFieldId ? <p className="text-sm text-red-300">{errors.storyPointsFieldId}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="github-api-key">GitHub API key</Label>
            <Input
              autoComplete="new-password"
              id="github-api-key"
              onChange={(event) => updateValue('githubApiKey', event.target.value)}
              placeholder={hasGithubKey ? 'Leave blank to keep existing key' : 'Stored for future use'}
              type="password"
              value={values.githubApiKey}
            />
            {hasGithubKey ? <p className="text-sm text-muted-foreground">A GitHub API key is already stored. Leave this blank to keep it.</p> : null}
            {errors.githubApiKey ? <p className="text-sm text-red-300">{errors.githubApiKey}</p> : null}
          </div>

          <div className="flex justify-end">
            <Button disabled={isSaving} type="submit">
              {isSaving ? 'Saving...' : 'Save settings'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}