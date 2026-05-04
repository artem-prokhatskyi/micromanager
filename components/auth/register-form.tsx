'use client';

import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PASSWORD_REQUIREMENTS_MESSAGE } from '@/lib/auth-shared';
import type { RegistrationPageState } from '@/types';

interface RegisterFormProps {
  inviteToken: string | null;
  registrationState: RegistrationPageState;
}

interface RegisterValidationErrors {
  email?: string;
  inviteToken?: string;
  password?: string;
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

export function RegisterForm({ inviteToken, registrationState }: RegisterFormProps): ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState<string>(registrationState.invitedEmail ?? '');
  const [password, setPassword] = useState<string>('');
  const [errors, setErrors] = useState<RegisterValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const registrationBlocked = !registrationState.bootstrapRegistrationOpen && !registrationState.inviteTokenValid;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (registrationBlocked) {
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const requestBody: { email: string; inviteToken?: string; password: string } = {
        email,
        password,
      };

      if (inviteToken) {
        requestBody.inviteToken = inviteToken;
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      const payload = readApiError(await response.json());

      if (!response.ok) {
        setErrors({
          email: payload.error?.details?.email,
          inviteToken: payload.error?.details?.inviteToken,
          password: payload.error?.details?.password,
        });
        setSubmitError(payload.error?.message ?? 'Failed to register user.');
        return;
      }

      router.replace('/login');
      router.refresh();
    } catch {
      setSubmitError('Failed to register user.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{registrationState.bootstrapRegistrationOpen ? 'Create Admin Account' : 'Register User'}</CardTitle>
        <CardDescription>
          {registrationState.bootstrapRegistrationOpen
            ? 'This one-time setup creates the first admin account for the workspace.'
            : 'Complete your invited account registration using the email linked to your invite.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {registrationBlocked ? (
          <div className="space-y-4 rounded-3xl border border-border/80 bg-card/40 p-5">
            <p className="text-sm leading-6 text-muted-foreground">
              {registrationState.requiresInvite
                ? 'Registration is closed unless you use a valid invite link from an admin.'
                : 'Registration is currently unavailable.'}
            </p>
            <Link className="text-sm font-medium text-foreground underline underline-offset-4" href="/login">
              Back to login
            </Link>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            {submitError ? (
              <div className="rounded-2xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-100">
                {submitError}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input
                autoComplete="email"
                disabled={Boolean(registrationState.invitedEmail)}
                id="register-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                type="email"
                value={email}
              />
              {errors.email ? <p className="text-sm text-red-300">{errors.email}</p> : null}
            </div>

            <PasswordInput
              autoComplete="new-password"
              description={PASSWORD_REQUIREMENTS_MESSAGE}
              error={errors.password}
              label="Password"
              name="password"
              onChange={setPassword}
              value={password}
            />

            {errors.inviteToken ? <p className="text-sm text-red-300">{errors.inviteToken}</p> : null}

            <div className="flex items-center justify-between gap-3">
              <Link className="text-sm text-muted-foreground underline underline-offset-4" href="/login">
                Back to login
              </Link>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Creating account...' : 'Register'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}