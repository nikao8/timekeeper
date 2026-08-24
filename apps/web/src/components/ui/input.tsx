import * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-sm font-medium', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-24 w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2',
        className,
      )}
      {...props}
    />
  );
}
