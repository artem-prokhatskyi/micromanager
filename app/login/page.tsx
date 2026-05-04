import type { ReactElement } from 'react';

import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage(): ReactElement {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
      <LoginForm />
    </section>
  );
}