'use client';

import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { DeveloperIssueTable } from '@/components/sprints/developer-issue-table';
import { IssueSkeleton } from '@/components/sprints/issue-skeleton';
import { JiraErrorBanner } from '@/components/sprints/jira-error-banner';
import { RefreshButton } from '@/components/sprints/refresh-button';
import { Checkbox } from '@/components/ui/checkbox';
import { SPECIALIZATION_LABELS, SPECIALIZATIONS } from '@/types';
import type { ApiError, DeveloperIssueGroup, MemberCapacityData, Specialization, SprintIssuesResponseData } from '@/types';

interface SprintIssueSectionProps {
  members: MemberCapacityData[];
  sprintId: string;
  teamId: string;
}

type IssueSectionStatus = 'loading' | 'success' | 'stale' | 'error';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && isRecord(value.error) && typeof value.error.message === 'string';
}

function isIssueGroupMember(value: unknown): value is DeveloperIssueGroup['member'] {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.jiraEmail === 'string'
    && typeof value.name === 'string'
    && Array.isArray(value.specialization);
}

function isProcessedIssue(value: unknown): boolean {
  return isRecord(value)
    && typeof value.key === 'string'
    && typeof value.title === 'string'
    && typeof value.url === 'string'
    && (typeof value.issueType === 'string' || value.issueType === null)
    && typeof value.label === 'string'
    && typeof value.status === 'string'
    && typeof value.statusAtSprintStart === 'string'
    && typeof value.statusAtSprintEnd === 'string'
    && (typeof value.devTimeHours === 'number' || value.devTimeHours === null)
    && (typeof value.totalDevTimeHours === 'number' || value.totalDevTimeHours === null)
    && (typeof value.totalQaTimeHours === 'number' || value.totalQaTimeHours === null)
    && (typeof value.devQaRatio === 'number' || value.devQaRatio === null)
    && (typeof value.testingTimeHours === 'number' || value.testingTimeHours === null)
    && typeof value.assigneeEmail === 'string';
}

function isDeveloperIssueGroup(value: unknown): value is DeveloperIssueGroup {
  return isRecord(value)
    && isIssueGroupMember(value.member)
    && Array.isArray(value.externalInProgressIssues)
    && value.externalInProgressIssues.every((issue) => isProcessedIssue(issue))
    && Array.isArray(value.issues)
    && value.issues.every((issue) => isProcessedIssue(issue))
    && typeof value.totalStoryPoints === 'number';
}

function isSprintIssuesResponseData(value: unknown): value is SprintIssuesResponseData {
  return isRecord(value)
    && Array.isArray(value.groups)
    && value.groups.every((group) => isDeveloperIssueGroup(group))
    && Array.isArray(value.qaGroups)
    && value.qaGroups.every((group) => isDeveloperIssueGroup(group))
    && (typeof value.cachedAt === 'string' || value.cachedAt === null)
    && typeof value.isStale === 'boolean';
}

function toggleSelection<T extends string>(current: T[], value: T): T[] {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
}

function formatFilterSummary(label: string, selectedCount: number, totalCount: number): string {
  if (selectedCount === 0) {
    return `${label}: all`;
  }

  return `${label}: ${selectedCount}/${totalCount}`;
}

export function SprintIssueSection({ members, sprintId, teamId }: SprintIssueSectionProps): ReactElement {
  const [status, setStatus] = useState<IssueSectionStatus>('loading');
  const [groups, setGroups] = useState<DeveloperIssueGroup[]>([]);
  const [qaGroups, setQaGroups] = useState<DeveloperIssueGroup[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [areFiltersExpanded, setAreFiltersExpanded] = useState<boolean>(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem(`sprint-filter-members:${sprintId}`);

      return stored ? JSON.parse(stored) as string[] : [];
    } catch {
      return [];
    }
  });
  const [selectedSpecializations, setSelectedSpecializations] = useState<Specialization[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem(`sprint-filter-specializations:${sprintId}`);

      return stored ? JSON.parse(stored) as Specialization[] : [];
    } catch {
      return [];
    }
  });

  function updateSelectedMemberIds(updater: string[] | ((current: string[]) => string[])): void {
    setSelectedMemberIds((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;

      localStorage.setItem(`sprint-filter-members:${sprintId}`, JSON.stringify(next));

      return next;
    });
  }

  function updateSelectedSpecializations(updater: Specialization[] | ((current: Specialization[]) => Specialization[])): void {
    setSelectedSpecializations((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;

      localStorage.setItem(`sprint-filter-specializations:${sprintId}`, JSON.stringify(next));

      return next;
    });
  }

  const membersById = useMemo(
    () => new Map<string, MemberCapacityData>(members.map((member) => [member.memberId, member])),
    [members],
  );
  const memberOptions = useMemo(
    () => [...new Map([...groups, ...qaGroups].map((group) => [group.member.id, { id: group.member.id, name: group.member.name }])).values()],
    [groups, qaGroups],
  );
  const specializationOptions = useMemo(
    () => SPECIALIZATIONS.filter((specialization) =>
      [...groups, ...qaGroups].some((group) => group.member.specialization.includes(specialization))),
    [groups, qaGroups],
  );
  const filteredGroups = useMemo(
    () => groups.filter((group) => {
      if (selectedMemberIds.length > 0 && !selectedMemberIds.includes(group.member.id)) {
        return false;
      }

      if (
        selectedSpecializations.length > 0
        && !selectedSpecializations.some((specialization) => group.member.specialization.includes(specialization))
      ) {
        return false;
      }

      return true;
    }),
    [groups, selectedMemberIds, selectedSpecializations],
  );
  const filteredQaGroups = useMemo(
    () => qaGroups.filter((group) => {
      if (selectedMemberIds.length > 0 && !selectedMemberIds.includes(group.member.id)) {
        return false;
      }

      if (
        selectedSpecializations.length > 0
        && !selectedSpecializations.some((specialization) => group.member.specialization.includes(specialization))
      ) {
        return false;
      }

      return true;
    }),
    [qaGroups, selectedMemberIds, selectedSpecializations],
  );
  const filtersSummary = useMemo(
    () => [
      formatFilterSummary('People', selectedMemberIds.length, memberOptions.length),
      formatFilterSummary('Specializations', selectedSpecializations.length, specializationOptions.length),
    ].join(' · '),
    [memberOptions.length, selectedMemberIds.length, selectedSpecializations.length, specializationOptions.length],
  );

  async function loadIssues(method: 'GET' | 'POST' = 'GET'): Promise<void> {
    if (method === 'POST') {
      setIsRefreshing(true);
    } else {
      setStatus('loading');
    }

    try {
      const response = await fetch(`/api/teams/${teamId}/sprints/${sprintId}/issues`, {
        method,
      });
      const payload: unknown = await response.json();

      if (response.ok && isRecord(payload) && isSprintIssuesResponseData(payload.data)) {
        setGroups(payload.data.groups);
        setQaGroups(payload.data.qaGroups);
        setCachedAt(payload.data.cachedAt);
        setErrorMessage(null);
        setStatus(payload.data.isStale ? 'stale' : 'success');
        return;
      }

      if (isApiError(payload)) {
        if (groups.length > 0 || qaGroups.length > 0) {
          setErrorMessage(payload.error.message);
          setStatus('stale');
          return;
        }

        setErrorMessage(payload.error.message);
        setStatus('error');
        return;
      }

      if (groups.length > 0 || qaGroups.length > 0) {
        setErrorMessage('Failed to refresh sprint issues.');
        setStatus('stale');
        return;
      }

      setErrorMessage('Failed to load sprint issues.');
      setStatus('error');
    } catch {
      if (groups.length > 0 || qaGroups.length > 0) {
        setErrorMessage('Failed to refresh sprint issues.');
        setStatus('stale');
        return;
      }

      setErrorMessage('Failed to load sprint issues.');
      setStatus('error');
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadIssues();
  }, [sprintId, teamId]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Sprint Issues</h2>
          <p className="text-sm text-muted-foreground">Grouped by the latest assignee state available for this sprint.</p>
        </div>
        <RefreshButton
          isRefreshing={isRefreshing}
          lastRefreshedAt={cachedAt}
          onRefresh={() => void loadIssues('POST')}
        />
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
        <button
          aria-expanded={areFiltersExpanded}
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setAreFiltersExpanded((current) => !current)}
          type="button"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Filters</p>
            <p className={`text-sm ${selectedMemberIds.length > 0 || selectedSpecializations.length > 0 ? 'font-medium text-amber-300' : 'text-muted-foreground'}`}>{filtersSummary}</p>
          </div>
          <span className="text-sm font-medium text-foreground">{areFiltersExpanded ? 'Hide filters' : 'Show filters'}</span>
        </button>

        {areFiltersExpanded ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Person
              </label>
              <div className="space-y-2 rounded-xl border border-border/70 bg-background/60 p-3">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={selectedMemberIds.length === 0}
                    onChange={() => updateSelectedMemberIds([])}
                  />
                  <span>All people</span>
                </label>
                <div className="grid max-h-48 gap-2 overflow-y-auto pr-1">
                  {memberOptions.map((member) => (
                    <label className="flex items-center gap-2 text-sm text-foreground" key={member.id}>
                      <Checkbox
                        checked={selectedMemberIds.includes(member.id)}
                        onChange={() => updateSelectedMemberIds((current) => toggleSelection(current, member.id))}
                      />
                      <span>{member.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="min-w-0 space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Specialization
              </label>
              <div className="space-y-2 rounded-xl border border-border/70 bg-background/60 p-3">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={selectedSpecializations.length === 0}
                    onChange={() => updateSelectedSpecializations([])}
                  />
                  <span>All specializations</span>
                </label>
                <div className="grid gap-2">
                  {specializationOptions.map((specialization) => (
                    <label className="flex items-center gap-2 text-sm text-foreground" key={specialization}>
                      <Checkbox
                        checked={selectedSpecializations.includes(specialization)}
                        onChange={() => updateSelectedSpecializations((current) => toggleSelection(current, specialization))}
                      />
                      <span>{SPECIALIZATION_LABELS[specialization]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {status === 'loading' ? <IssueSkeleton /> : null}
      {status === 'stale' ? <JiraErrorBanner cachedAt={cachedAt} message={errorMessage ?? undefined} onRetry={() => void loadIssues('POST')} type="stale" /> : null}
      {status === 'error' ? <JiraErrorBanner message={errorMessage ?? undefined} onRetry={() => void loadIssues('POST')} type="error" /> : null}

      {status !== 'loading' && status !== 'error'
        ? filteredGroups.map((group) => {
            const member = membersById.get(group.member.id);

            if (!member) {
              return null;
            }

            return <DeveloperIssueTable group={group} key={group.member.id} member={member} showDevTime showTotalDevTime sprintId={sprintId} />;
          })
        : null}

      {status !== 'loading' && status !== 'error' && filteredQaGroups.length > 0 ? (
        <div className="space-y-4 pt-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">QA Issues</h3>
            <p className="text-sm text-muted-foreground">For members with QA specialization, matched by assignee and customfield_11325.</p>
          </div>
          {filteredQaGroups.map((group) => {
            const member = membersById.get(group.member.id);

            if (!member) {
              return null;
            }

            return <DeveloperIssueTable group={group} key={`qa-${group.member.id}`} member={member} showCapacitySummary={false} showTestingTime showTotalQaTime sprintId={sprintId} storyPointsLabel="Dev SP" />;
          })}
        </div>
      ) : null}

      {status !== 'loading' && status !== 'error' && filteredGroups.length === 0 && filteredQaGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/30 px-5 py-8 text-center">
          <p className="text-sm font-medium text-foreground">No issue tables match the current filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">Adjust the selected people or specializations to see more results.</p>
        </div>
      ) : null}
    </section>
  );
}