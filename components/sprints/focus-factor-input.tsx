'use client';

import type { KeyboardEvent, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FocusFactorInputProps {
  memberId: string;
  value: number;
  onCommit: (memberId: string, nextValue: number, previousValue: number) => Promise<void>;
}

export function FocusFactorInput({ memberId, onCommit, value }: FocusFactorInputProps): ReactElement {
  const [draft, setDraft] = useState<string>(value.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value.toFixed(2));
    }
  }, [isEditing, value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function commit(): Promise<void> {
    if (isSaving) {
      return;
    }

    const nextValue = Number(draft);

    if (!Number.isFinite(nextValue) || nextValue <= 0 || nextValue > 1) {
      setError('Enter a value between 0 and 1.');
      return;
    }

    if (nextValue === value) {
      setError(null);
      setIsEditing(false);
      setDraft(value.toFixed(2));
      return;
    }

    setError(null);
    setIsSaving(true);

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(async () => {
      try {
        await onCommit(memberId, nextValue, value);
        setIsEditing(false);
      } catch (commitError) {
        setError(commitError instanceof Error ? commitError.message : 'Failed to save focus factor.');
      } finally {
        setIsSaving(false);
      }
    }, 300);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commit();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setError(null);
      setIsEditing(false);
      setDraft(value.toFixed(2));
    }
  }

  if (!isEditing) {
    return (
      <button
        className={cn(
          'rounded-lg border border-transparent px-2 py-1 text-left text-sm font-medium text-foreground transition-colors hover:border-border hover:bg-accent/60',
          isSaving && 'opacity-70',
        )}
        onClick={() => setIsEditing(true)}
        type="button"
      >
        {value.toFixed(2)}
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        autoFocus
        className="h-9 w-24"
        max="1"
        min="0"
        onBlur={() => {
          void commit();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        step="0.01"
        type="number"
        value={draft}
      />
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}