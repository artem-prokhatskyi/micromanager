'use client';

import type { ChangeEvent, ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { NON_WORKING_DAY_TYPES } from '@/types';
import type {
  ApiError,
  CalendarMemberOption,
  CalendarNonWorkingDayRecord,
  NonWorkingDayFormValues,
  NonWorkingDayValidationErrors,
} from '@/types';

interface NonWorkingDayPopupProps {
  date: string;
  existingRecords: CalendarNonWorkingDayRecord[];
  members: CalendarMemberOption[];
  onCreated: (records: CalendarNonWorkingDayRecord[]) => void;
  onDeleted: (recordId: string) => void;
  onOpenChange: (open: boolean) => void;
  onUpdated: (record: CalendarNonWorkingDayRecord) => void;
  open: boolean;
  teamId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && isRecord(value.error) && typeof value.error.message === 'string';
}

function isCalendarRecord(value: unknown): value is CalendarNonWorkingDayRecord {
  return (
    isRecord(value)
    && typeof value.id === 'string'
    && typeof value.memberId === 'string'
    && typeof value.memberName === 'string'
    && typeof value.teamId === 'string'
    && typeof value.date === 'string'
    && typeof value.type === 'string'
    && typeof value.halfDay === 'boolean'
  );
}

function isCalendarRecordArray(value: unknown): value is CalendarNonWorkingDayRecord[] {
  return Array.isArray(value) && value.every((entry) => isCalendarRecord(entry));
}

function getDefaultValues(date: string): NonWorkingDayFormValues {
  return {
    memberIds: [],
    date,
    type: 'holiday',
    halfDay: false,
  };
}

function isNonWorkingDayType(value: string): value is NonWorkingDayFormValues['type'] {
  return NON_WORKING_DAY_TYPES.some((type) => type === value);
}

function getClientErrors(values: NonWorkingDayFormValues): NonWorkingDayValidationErrors {
  const errors: NonWorkingDayValidationErrors = {};

  if (values.memberIds.length === 0) {
    errors.memberIds = 'Select at least one team member.';
  }

  return errors;
}

function formatPopupDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function NonWorkingDayPopup({
  date,
  existingRecords,
  members,
  onCreated,
  onDeleted,
  onOpenChange,
  onUpdated,
  open,
  teamId,
}: NonWorkingDayPopupProps): ReactElement {
  const { toast } = useToast();
  const [values, setValues] = useState<NonWorkingDayFormValues>(getDefaultValues(date));
  const [errors, setErrors] = useState<NonWorkingDayValidationErrors>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  const editingRecord = useMemo(
    () => existingRecords.find((record) => record.id === editingRecordId) ?? null,
    [editingRecordId, existingRecords],
  );

  useEffect(() => {
    if (!open) {
      setEditingRecordId(null);
      setConfirmDelete(false);
      setSubmitError(null);
      setErrors({});
      setValues(getDefaultValues(date));
      return;
    }

    setValues(getDefaultValues(date));
    setEditingRecordId(null);
    setConfirmDelete(false);
    setSubmitError(null);
    setErrors({});
  }, [date, open]);

  useEffect(() => {
    if (!editingRecord) {
      return;
    }

    setValues({
      memberIds: [editingRecord.memberId],
      date: editingRecord.date,
      type: editingRecord.type,
      halfDay: editingRecord.halfDay,
    });
    setErrors({});
    setSubmitError(null);
    setConfirmDelete(false);
  }, [editingRecord]);

  function handleToggleMember(memberId: string): void {
    if (editingRecord) {
      return;
    }

    setValues((current) => ({
      ...current,
      memberIds: current.memberIds.includes(memberId)
        ? current.memberIds.filter((id) => id !== memberId)
        : [...current.memberIds, memberId],
    }));
  }

  async function handleCreate(): Promise<void> {
    const clientErrors = getClientErrors(values);

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setIsSaving(true);
    setErrors({});
    setSubmitError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/non-working-days`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const payload: unknown = await response.json();

      if (response.ok && isRecord(payload) && isCalendarRecordArray(payload.data)) {
        onCreated(payload.data);
        toast({ title: 'Non-working day saved.' });
        onOpenChange(false);
        return;
      }

      if (isApiError(payload)) {
        if (response.status === 400) {
          setErrors({
            memberIds: payload.error.details?.memberIds,
            date: payload.error.details?.date,
            type: payload.error.details?.type,
          });
        }

        if (response.status === 409) {
          setErrors({ conflicts: payload.error.conflicts ?? [] });
        }

        setSubmitError(payload.error.message);
        return;
      }

      setSubmitError('Failed to save non-working day.');
    } catch {
      setSubmitError('Failed to save non-working day.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(): Promise<void> {
    if (!editingRecord) {
      return;
    }

    setIsSaving(true);
    setErrors({});
    setSubmitError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/non-working-days/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: values.type,
          halfDay: values.halfDay,
        }),
      });
      const payload: unknown = await response.json();

      if (response.ok && isRecord(payload) && isCalendarRecord(payload.data)) {
        onUpdated(payload.data);
        toast({ title: 'Non-working day updated.' });
        onOpenChange(false);
        return;
      }

      if (isApiError(payload)) {
        if (response.status === 400) {
          setErrors({
            type: payload.error.details?.type,
            halfDay: payload.error.details?.halfDay,
          });
        }

        setSubmitError(payload.error.message);
        return;
      }

      setSubmitError('Failed to update non-working day.');
    } catch {
      setSubmitError('Failed to update non-working day.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!editingRecord) {
      return;
    }

    setIsDeleting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/non-working-days/${editingRecord.id}`, {
        method: 'DELETE',
      });
      const payload: unknown = await response.json();

      if (response.ok) {
        onDeleted(editingRecord.id);
        toast({ title: 'Non-working day deleted.' });
        onOpenChange(false);
        return;
      }

      if (isApiError(payload)) {
        setSubmitError(payload.error.message);
        return;
      }

      setSubmitError('Failed to delete non-working day.');
    } catch {
      setSubmitError('Failed to delete non-working day.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingRecord ? 'Edit Non-Working Day' : 'Add Non-Working Day'}</DialogTitle>
          <DialogDescription>
            {formatPopupDate(date)}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {existingRecords.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Existing Records</h3>
                {editingRecord ? (
                  <Button onClick={() => setEditingRecordId(null)} type="button" variant="outline">
                    Back to add
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
                {existingRecords.map((record) => (
                  <button
                    className="flex w-full items-center justify-between rounded-2xl border border-border/80 bg-background/60 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                    key={record.id}
                    onClick={() => setEditingRecordId(record.id)}
                    type="button"
                  >
                    <div>
                      <p className="font-medium text-foreground">{record.memberName}</p>
                      <p className="text-sm text-muted-foreground">
                        {record.type}
                        {record.halfDay ? ' (half day)' : ''}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">Edit</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {submitError ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-100">
              {submitError}
            </div>
          ) : null}

          {errors.conflicts && errors.conflicts.length > 0 ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
              {errors.conflicts.join(', ')} already have a record on this date.
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="non-working-day-type">Type</Label>
            <Select
              id="non-working-day-type"
              onChange={(event) => {
                const nextType = event.target.value;

                if (!isNonWorkingDayType(nextType)) {
                  return;
                }

                setValues((current) => ({
                  ...current,
                  type: nextType,
                }));
              }}
              value={values.type}
            >
              {NON_WORKING_DAY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            {errors.type ? <p className="text-sm text-red-300">{errors.type}</p> : null}
          </div>

          {editingRecord ? (
            <div className="space-y-2">
              <Label>Team member</Label>
              <div className="rounded-2xl border border-border/80 bg-background/60 px-4 py-3 text-sm text-foreground">
                {editingRecord.memberName}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label>Team members</Label>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-border/80 bg-background/60 p-3">
                {members.map((member) => (
                  <label className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground hover:bg-accent/30" key={member.id}>
                    <Checkbox
                      checked={values.memberIds.includes(member.id)}
                      onChange={(_event: ChangeEvent<HTMLInputElement>) => handleToggleMember(member.id)}
                    />
                    <span>{member.name}</span>
                  </label>
                ))}
              </div>
              {errors.memberIds ? <p className="text-sm text-red-300">{errors.memberIds}</p> : null}
            </div>
          )}

          <label className="flex items-center gap-3 text-sm text-foreground">
            <Checkbox
              checked={values.halfDay}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  halfDay: event.target.checked,
                }))
              }
            />
            <span>Half day</span>
          </label>
        </div>

        <DialogFooter className="mt-8">
          {editingRecord ? (
            <div className="mr-auto flex items-center gap-3">
              {confirmDelete ? (
                <>
                  <span className="text-sm text-muted-foreground">Remove this record?</span>
                  <Button disabled={isDeleting} onClick={() => void handleDelete()} type="button" variant="ghost">
                    {isDeleting ? 'Removing...' : 'Confirm delete'}
                  </Button>
                  <Button onClick={() => setConfirmDelete(false)} type="button" variant="outline">
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setConfirmDelete(true)} type="button" variant="ghost">
                  Delete record
                </Button>
              )}
            </div>
          ) : null}
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isSaving || isDeleting} onClick={() => void (editingRecord ? handleUpdate() : handleCreate())} type="button">
            {isSaving ? 'Saving...' : editingRecord ? 'Save changes' : 'Save records'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}