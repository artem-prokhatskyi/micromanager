import type { HTMLAttributes, ReactElement, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {}
interface TableSectionProps extends HTMLAttributes<HTMLTableSectionElement> {}
interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {}
interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {}
interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}

export function Table({ className, ...props }: TableProps): ReactElement {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: TableSectionProps): ReactElement {
  return <thead className={cn('[&_tr]:border-b [&_tr]:border-border/60', className)} {...props} />;
}

export function TableBody({ className, ...props }: TableSectionProps): ReactElement {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({ className, ...props }: TableSectionProps): ReactElement {
  return <tfoot className={cn('border-t border-border/60 font-medium', className)} {...props} />;
}

export function TableRow({ className, ...props }: TableRowProps): ReactElement {
  return <tr className={cn('border-b border-border/60 transition-colors', className)} {...props} />;
}

export function TableHead({ className, ...props }: TableHeadProps): ReactElement {
  return (
    <th
      className={cn('h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground', className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TableCellProps): ReactElement {
  return <td className={cn('p-4 align-middle', className)} {...props} />;
}