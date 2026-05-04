'use client';

import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoginValidationErrors {
  email?: string;
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

export function LoginForm(): ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [errors, setErrors] = useState<LoginValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          rememberMe,
        }),
      });
      const payload = readApiError(await response.json());

      if (!response.ok) {
        setErrors({
          email: payload.error?.details?.email,
          password: payload.error?.details?.password,
        });
        setSubmitError(payload.error?.message ?? 'Failed to sign in.');
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setSubmitError('Failed to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log In</CardTitle>
        <CardDescription>Use your email and password to access Team Sprint Monitor.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {submitError ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-100">
              {submitError}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              autoComplete="email"
              id="login-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              type="email"
              value={email}
            />
            {errors.email ? <p className="text-sm text-red-300">{errors.email}</p> : null}
          </div>

          <PasswordInput
            autoComplete="current-password"
            error={errors.password}
            label="Password"
            name="password"
            onChange={setPassword}
            value={password}
          />

          <label className="flex items-center gap-3 text-sm text-muted-foreground" htmlFor="remember-me">
            <Checkbox
              checked={rememberMe}
              id="remember-me"
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            Remember me for 14 days
          </label>

          <div className="flex justify-end">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Signing in...' : 'Log in'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}