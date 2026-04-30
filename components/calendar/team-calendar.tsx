'use client';

import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { CalendarMonth } from '@/components/calendar/calendar-month';
import { MemberFilterBar } from '@/components/calendar/member-filter-bar';
import { NonWorkingDayPopup } from '@/components/calendar/non-working-day-popup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { addUtcMonths, formatUtcDate, getCalendarRange, parseUtcDate } from '@/lib/date';
import type { ApiError, CalendarNonWorkingDayRecord, TeamCalendarData } from '@/types';

interface TeamCalendarProps {
  initialData: TeamCalendarData;
  initialMonth: string;
  teamId: string;
}

interface PopupState {
  date: string;
  open: boolean;
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

function sortRecords(records: CalendarNonWorkingDayRecord[]): CalendarNonWorkingDayRecord[] {
  return [...records].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return left.memberName.localeCompare(right.memberName);
  });
}

export function TeamCalendar({ initialData, initialMonth, teamId }: TeamCalendarProps): ReactElement {
  const { toast } = useToast();
  const initialRange = useMemo(() => getCalendarRange(new Date(initialMonth)), [initialMonth]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(initialMonth));
  const [records, setRecords] = useState<CalendarNonWorkingDayRecord[]>(initialData.nonWorkingDays);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    initialData.members.map((member) => member.id),
  );
  const [popupState, setPopupState] = useState<PopupState>({
    date: formatUtcDate(new Date(initialMonth)),
    open: false,
  });
  const [isLoadingRange, setIsLoadingRange] = useState<boolean>(false);
  const [loadedRangeKey, setLoadedRangeKey] = useState<string>(() =>
    `${formatUtcDate(initialRange.start)}:${formatUtcDate(initialRange.end)}`,
  );

  const selectedMemberIdSet = useMemo(() => new Set(selectedMemberIds), [selectedMemberIds]);
  const displayedMonths = useMemo(
    () => [addUtcMonths(currentMonth, -1), currentMonth, addUtcMonths(currentMonth, 1)],
    [currentMonth],
  );
  const visibleRecords = useMemo(
    () => records.filter((record) => selectedMemberIdSet.has(record.memberId)),
    [records, selectedMemberIdSet],
  );
  const popupRecords = useMemo(
    () => records.filter((record) => record.date === popupState.date),
    [popupState.date, records],
  );

  useEffect(() => {
    const range = getCalendarRange(currentMonth);
    const rangeKey = `${formatUtcDate(range.start)}:${formatUtcDate(range.end)}`;

    if (rangeKey === loadedRangeKey) {
      return;
    }

    let isCancelled = false;

    async function loadRange(): Promise<void> {
      setIsLoadingRange(true);

      try {
        const response = await fetch(
          `/api/teams/${teamId}/non-working-days?start=${formatUtcDate(range.start)}&end=${formatUtcDate(range.end)}`,
        );
        const payload: unknown = await response.json();

        if (isCancelled) {
          return;
        }

        if (response.ok && isRecord(payload) && isCalendarRecordArray(payload.data)) {
          setRecords(sortRecords(payload.data));
          setLoadedRangeKey(rangeKey);
          return;
        }

        if (isApiError(payload)) {
          toast({ title: payload.error.message, variant: 'destructive' });
          return;
        }

        toast({ title: 'Failed to load non-working days.', variant: 'destructive' });
      } catch {
        if (!isCancelled) {
          toast({ title: 'Failed to load non-working days.', variant: 'destructive' });
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingRange(false);
        }
      }
    }

    void loadRange();

    return () => {
      isCancelled = true;
    };
  }, [currentMonth, loadedRangeKey, teamId, toast]);

  function handleToggleMember(memberId: string): void {
    setSelectedMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  }

  function handleOpenDay(date: Date): void {
    setPopupState({
      date: formatUtcDate(date),
      open: true,
    });
  }

  function handleCreate(recordsToAdd: CalendarNonWorkingDayRecord[]): void {
    setRecords((current) => sortRecords([...current, ...recordsToAdd]));
  }

  function handleUpdate(updatedRecord: CalendarNonWorkingDayRecord): void {
    setRecords((current) =>
      sortRecords(current.map((record) => (record.id === updatedRecord.id ? updatedRecord : record))),
    );
  }

  function handleDelete(recordId: string): void {
    setRecords((current) => current.filter((record) => record.id !== recordId));
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{initialData.team.name}</p>
              <p className="text-sm text-muted-foreground">Three months centered on the selected month.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setCurrentMonth((current) => addUtcMonths(current, -1))} type="button" variant="outline">
                Back
              </Button>
              <Button onClick={() => setCurrentMonth((current) => addUtcMonths(current, 1))} type="button" variant="outline">
                Forward
              </Button>
            </div>
          </div>
          <MemberFilterBar members={initialData.members} onToggle={handleToggleMember} selectedIds={selectedMemberIds} />
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingRange ? <Skeleton className="h-3 w-44" /> : null}
          <div className="grid gap-4 xl:grid-cols-3">
            {displayedMonths.map((month) => (
              <CalendarMonth
                key={month.toISOString()}
                month={month}
                nonWorkingDays={visibleRecords}
                onDayClick={handleOpenDay}
                sprints={initialData.sprints}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      <NonWorkingDayPopup
        date={popupState.date}
        existingRecords={popupRecords}
        members={initialData.members}
        onCreated={handleCreate}
        onDeleted={handleDelete}
        onOpenChange={(open) => setPopupState((current) => ({ ...current, open }))}
        onUpdated={handleUpdate}
        open={popupState.open}
        teamId={teamId}
      />
    </>
  );
}