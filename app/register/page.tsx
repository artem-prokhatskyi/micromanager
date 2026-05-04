import type { ReactElement } from 'react';

import { RegisterForm } from '@/components/auth/register-form';
import { getRegistrationState } from '@/lib/auth';

interface RegisterPageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps): Promise<ReactElement> {
  const { token } = await searchParams;
  const registrationState = await getRegistrationState(typeof token === 'string' ? token : undefined);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
      <RegisterForm inviteToken={typeof token === 'string' ? token : null} registrationState={registrationState} />
    </section>
  );
}