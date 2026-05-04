'use client';

import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PASSWORD_REQUIREMENTS_MESSAGE } from '@/lib/auth-shared';

interface ForcedPasswordChangeDialogProps {
  open: boolean;
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

export function ForcedPasswordChangeDialog({ open }: ForcedPasswordChangeDialogProps): ReactElement | null {
  const router = useRouter();
  const [password, setPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setPasswordError(null);
    setSubmitError(null);

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

      router.refresh();
    } catch {
      setSubmitError('Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 py-8">
      <Card className="w-full max-w-lg border-border/80 shadow-2xl shadow-black/40">
        <CardHeader>
          <CardTitle>Password reset required</CardTitle>
          <CardDescription>
            Your administrator reset your password. You must set a new one before you can use the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {submitError ? (
              <div className="rounded-2xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-100">
                {submitError}
              </div>
            ) : null}
            <PasswordInput
              autoComplete="new-password"
              description={PASSWORD_REQUIREMENTS_MESSAGE}
              error={passwordError ?? undefined}
              label="New password"
              name="forced-new-password"
              onChange={setPassword}
              value={password}
            />
            <div className="flex justify-end">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Saving...' : 'Save password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}