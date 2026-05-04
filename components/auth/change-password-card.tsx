'use client';

import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PASSWORD_REQUIREMENTS_MESSAGE } from '@/lib/auth-shared';

interface ChangePasswordCardProps {
  description?: string;
  title?: string;
}

interface ApiErrorPayload {
  error?: {
    details?: Record<string, string>;
    message?: string;
  };
}

function readApiError(payload: unknown): ApiErrorPayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  return payload as ApiErrorPayload;
}

export function ChangePasswordCard({
  description = 'Set a new password for your account. You do not need to enter the current one.',
  title = 'Change Password',
}: ChangePasswordCardProps): ReactElement {
  const [password, setPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setPasswordError(null);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
        }),
      });
      const payload = readApiError(await response.json());

      if (!response.ok) {
        setPasswordError(payload.error?.details?.password ?? null);
        setSubmitError(payload.error?.message ?? 'Failed to update password.');
        return;
      }

      setPassword('');
      setSubmitSuccess('Password updated successfully.');
    } catch {
      setSubmitError('Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {submitError ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-100">
              {submitError}
            </div>
          ) : null}
          {submitSuccess ? (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-100">
              {submitSuccess}
            </div>
          ) : null}
          <PasswordInput
            autoComplete="new-password"
            description={PASSWORD_REQUIREMENTS_MESSAGE}
            error={passwordError ?? undefined}
            label="New password"
            name="new-password"
            onChange={setPassword}
            value={password}
          />
          <div className="flex justify-end">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Updating...' : 'Update password'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}