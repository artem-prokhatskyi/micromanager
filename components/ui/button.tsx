import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

import Link from 'next/link';

import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'ghost' | 'outline';
type ButtonSize = 'default' | 'sm' | 'icon';

interface ButtonStyleOptions {
  size?: ButtonSize;
  variant?: ButtonVariant;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  children: ReactNode;
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement>, ButtonStyleOptions {
  children: ReactNode;
  href: string;
}

export function buttonVariants({ size = 'default', variant = 'default' }: ButtonStyleOptions): string {
  const variantClassName = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    ghost: 'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
    outline: 'border border-border bg-card/40 text-foreground hover:bg-accent hover:text-accent-foreground',
  } satisfies Record<ButtonVariant, string>;

  const sizeClassName = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-9 px-3 text-sm',
    icon: 'h-10 w-10 p-0',
  } satisfies Record<ButtonSize, string>;

  return cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
    variantClassName[variant],
    sizeClassName[size],
  );
}

export function Button({ className, size, variant, ...props }: ButtonProps): ReactElement {
  return <button className={cn(buttonVariants({ size, variant }), className)} {...props} />;
}

export function ButtonLink({ className, href, size, variant, ...props }: ButtonLinkProps): ReactElement {
  return <Link className={cn(buttonVariants({ size, variant }), className)} href={href} {...props} />;
}