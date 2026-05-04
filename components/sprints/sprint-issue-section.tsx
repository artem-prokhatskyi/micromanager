'use client';

import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { DeveloperIssueTable } from '@/components/sprints/developer-issue-table';
import { IssueSkeleton } from '@/components/sprints/issue-skeleton';
import { JiraErrorBanner } from '@/components/sprints/jira-error-banner';
import { RefreshButton } from '@/components/sprints/refresh-button';
import { Select } from '@/components/ui/select';
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
    && typeof value.name === 'string';
}

function isProcessedIssue(value: unknown): boolean {
  return isRecord(value)
    && typeof value.key === 'string'
    && typeof value.title === 'string'
    && typeof value.url === 'string'
    && typeof value.label === 'string'
    && typeof value.status === 'string'
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
    && (typeof value.cachedAt === 'string' || value.cachedAt === null)
    && typeof value.isStale === 'boolean';
}

export function SprintIssueSection({ members, sprintId, teamId }: SprintIssueSectionProps): ReactElement {
  const [status, setStatus] = useState<IssueSectionStatus>('loading');
  const [groups, setGroups] = useState<DeveloperIssueGroup[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [selectedSpecialization, setSelectedSpecialization] = useState<Specialization | 'all'>('all');

  const membersById = useMemo(
    () => new Map<string, MemberCapacityData>(members.map((member) => [member.memberId, member])),
    [members],
  );
  const memberOptions = useMemo(
    () => groups.map((group) => ({ id: group.member.id, name: group.member.name })),
    [groups],
  );
  const specializationOptions = useMemo(
    () => SPECIALIZATIONS.filter((specialization) =>
      groups.some((group) => group.member.specialization.includes(specialization))),
    [groups],
  );
  const filteredGroups = useMemo(
    () => groups.filter((group) => {
      if (selectedMemberId !== 'all' && group.member.id !== selectedMemberId) {
        return false;
      }

      if (selectedSpecialization !== 'all' && !group.member.specialization.includes(selectedSpecialization)) {
        return false;
      }

      return true;
    }),
    [groups, selectedMemberId, selectedSpecialization],
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
        setCachedAt(payload.data.cachedAt);
        setErrorMessage(null);
        setStatus(payload.data.isStale ? 'stale' : 'success');
        return;
      }

      if (isApiError(payload)) {
        if (groups.length > 0) {
          setErrorMessage(payload.error.message);
          setStatus('stale');
          return;
        }

        setErrorMessage(payload.error.message);
        setStatus('error');
        return;
      }

      if (groups.length > 0) {
        setErrorMessage('Failed to refresh sprint issues.');
        setStatus('stale');
        return;
      }

      setErrorMessage('Failed to load sprint issues.');
      setStatus('error');
    } catch {
      if (groups.length > 0) {
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

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-card/50 p-4">
        <div className="min-w-[220px] flex-1 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground" htmlFor="issue-filter-person">
            Person
          </label>
          <Select id="issue-filter-person" onChange={(event) => setSelectedMemberId(event.target.value)} value={selectedMemberId}>
            <option value="all">All people</option>
            {memberOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[220px] flex-1 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground" htmlFor="issue-filter-specialization">
            Specialization
          </label>
          <Select
            id="issue-filter-specialization"
            onChange={(event) => setSelectedSpecialization(event.target.value as Specialization | 'all')}
            value={selectedSpecialization}
          >
            <option value="all">All specializations</option>
            {specializationOptions.map((specialization) => (
              <option key={specialization} value={specialization}>
                {SPECIALIZATION_LABELS[specialization]}
              </option>
            ))}
          </Select>
        </div>
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

            return <DeveloperIssueTable group={group} key={group.member.id} member={member} />;
          })
        : null}

      {status !== 'loading' && status !== 'error' && filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/30 px-5 py-8 text-center">
          <p className="text-sm font-medium text-foreground">No issue tables match the current filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">Adjust the person or specialization filter to see more results.</p>
        </div>
      ) : null}
    </section>
  );
}