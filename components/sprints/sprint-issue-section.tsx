'use client';

import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { DeveloperIssueTable } from '@/components/sprints/developer-issue-table';
import { IssueSkeleton } from '@/components/sprints/issue-skeleton';
import { JiraErrorBanner } from '@/components/sprints/jira-error-banner';
import { RefreshButton } from '@/components/sprints/refresh-button';
import type { ApiError, DeveloperIssueGroup, MemberCapacityData, SprintIssuesResponseData } from '@/types';

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

  const membersById = useMemo(
    () => new Map<string, MemberCapacityData>(members.map((member) => [member.memberId, member])),
    [members],
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

      {status === 'loading' ? <IssueSkeleton /> : null}
      {status === 'stale' ? <JiraErrorBanner cachedAt={cachedAt} message={errorMessage ?? undefined} onRetry={() => void loadIssues('POST')} type="stale" /> : null}
      {status === 'error' ? <JiraErrorBanner message={errorMessage ?? undefined} onRetry={() => void loadIssues('POST')} type="error" /> : null}

      {status !== 'loading' && status !== 'error'
        ? groups.map((group) => {
            const member = membersById.get(group.member.id);

            if (!member) {
              return null;
            }

            return <DeveloperIssueTable group={group} key={group.member.id} member={member} />;
          })
        : null}
    </section>
  );
}