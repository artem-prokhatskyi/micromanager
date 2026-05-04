'use client';

import type { ChangeEvent, ReactElement } from 'react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PasswordInputProps {
  autoComplete?: string;
  description?: string;
  error?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}

export function PasswordInput({
  autoComplete = 'current-password',
  description,
  error,
  label,
  name,
  onChange,
  placeholder,
  value,
}: PasswordInputProps): ReactElement {
  const inputId = useId();
  const [visible, setVisible] = useState<boolean>(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          autoComplete={autoComplete}
          id={inputId}
          name={name}
          onChange={handleChange}
          placeholder={placeholder}
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <Button
          className="absolute right-1 top-1"
          onClick={() => setVisible((current) => !current)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {visible ? 'Hide' : 'Show'}
        </Button>
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}