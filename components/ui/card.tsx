import type { HTMLAttributes, ReactElement } from 'react';

import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps): ReactElement {
  return (
    <div
      className={cn(
        'rounded-3xl border border-border/80 bg-card/70 text-card-foreground shadow-2xl shadow-black/10 backdrop-blur',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardHeaderProps): ReactElement {
  return <div className={cn('flex flex-col gap-2 p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }: CardTitleProps): ReactElement {
  return <h2 className={cn('text-xl font-semibold tracking-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: CardDescriptionProps): ReactElement {
  return <p className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: CardContentProps): ReactElement {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}