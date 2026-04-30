import { NextResponse } from 'next/server';

import { fetchSprintIssues, JiraRequestError } from '@/lib/jira';
import { getSprintDashboardData, getSprintIssuesContext, upsertSprintIssueCache } from '@/lib/data/sprint';
import { processSprintIssues } from '@/lib/issue-pipeline';
import type { DeveloperIssueGroup, MemberCapacityData, ProcessedIssue } from '@/types';

interface SprintExportRouteProps {
  params: Promise<{
    teamId: string;
    sprintId: string;
  }>;
}

function escapeCsvValue(value: string | number | boolean | null): string {
  if (value === null) {
    return '';
  }

  const normalizedValue = String(value);

  if (/[,"\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replaceAll('"', '""')}"`;
  }

  return normalizedValue;
}

function toIsoDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : '';
}

function toCsvRow(values: Array<string | number | boolean | null>): string {
  return values.map((value) => escapeCsvValue(value)).join(',');
}

function sanitizeFilePart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function createExportRows(input: {
  issueGroups: DeveloperIssueGroup[];
  issuesExportStatus: string;
  members: MemberCapacityData[];
  sprint: {
    actualEnd: Date | null;
    isOverdue: boolean;
    name: string;
    plannedEnd: Date;
    plannedStart: Date;
  };
  teamName: string;
}): string[] {
  const issueGroupsByMemberId = new Map<string, ProcessedIssue[]>(
    input.issueGroups.map((group) => [group.member.id, group.issues]),
  );

  return input.members.flatMap((member) => {
    const issues = issueGroupsByMemberId.get(member.memberId) ?? [];

    if (issues.length === 0) {
      return [
        toCsvRow([
          input.teamName,
          input.sprint.name,
          toIsoDate(input.sprint.plannedStart),
          toIsoDate(input.sprint.plannedEnd),
          toIsoDate(input.sprint.actualEnd),
          input.sprint.isOverdue,
          member.name,
          member.specialization ?? '',
          member.plannedWorkingDays,
          member.focusFactor,
          member.plannedCapacity,
          member.actualWorkingDays,
          member.actualCapacity,
          member.absenceSummary.holiday,
          member.absenceSummary.vacation,
          member.absenceSummary.sickleave,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          issues.length === 0 ? input.issuesExportStatus : 'included',
        ]),
      ];
    }

    return issues.map((issue) =>
      toCsvRow([
        input.teamName,
        input.sprint.name,
        toIsoDate(input.sprint.plannedStart),
        toIsoDate(input.sprint.plannedEnd),
        toIsoDate(input.sprint.actualEnd),
        input.sprint.isOverdue,
        member.name,
        member.specialization ?? '',
        member.plannedWorkingDays,
        member.focusFactor,
        member.plannedCapacity,
        member.actualWorkingDays,
        member.actualCapacity,
        member.absenceSummary.holiday,
        member.absenceSummary.vacation,
        member.absenceSummary.sickleave,
        issue.key,
        issue.title,
        issue.label,
        issue.storyPoints,
        issue.status,
        issue.priority,
        issue.url,
        'included',
      ]),
    );
  });
}

export async function GET(
  _request: Request,
  { params }: SprintExportRouteProps,
): Promise<Response> {
  const { sprintId, teamId } = await params;
  const dashboardData = await getSprintDashboardData(teamId, sprintId);

  if (!dashboardData) {
    return NextResponse.json({ error: { message: 'Sprint not found.' } }, { status: 404 });
  }

  let issueGroups: DeveloperIssueGroup[] = [];
  let issuesExportStatus = 'not_requested';

  try {
    const issuesContext = await getSprintIssuesContext(teamId, sprintId);

    if (issuesContext) {
      const issues = issuesContext.cache
        ? issuesContext.cache.data
        : await fetchSprintIssues(issuesContext.sprint.jiraSprintId);

      if (!issuesContext.cache) {
        await upsertSprintIssueCache(issuesContext.sprint.id, issues);
      }

      issueGroups = processSprintIssues(issues, {
        actualEnd: issuesContext.sprint.actualEnd,
        activatedAt: issuesContext.sprint.activatedAt,
        jiraDomain: issuesContext.team.jiraDomain,
        plannedStart: issuesContext.sprint.plannedStart,
        sprintJiraId: issuesContext.sprint.jiraSprintId,
        sprintName: issuesContext.sprint.name,
        storyPointsFieldId: issuesContext.storyPointsFieldId,
      }, issuesContext.members);
      issuesExportStatus = 'included';
    } else {
      issuesExportStatus = 'not_available';
    }
  } catch (error) {
    if (error instanceof JiraRequestError) {
      issuesExportStatus = 'jira_unavailable';
    } else {
      issuesExportStatus = 'failed';
    }
  }

  const header = toCsvRow([
    'team_name',
    'sprint_name',
    'planned_start',
    'planned_end',
    'actual_end',
    'is_overdue',
    'member_name',
    'member_specialization',
    'planned_working_days',
    'focus_factor',
    'planned_capacity',
    'actual_working_days',
    'actual_capacity',
    'holiday_days',
    'vacation_days',
    'sickleave_days',
    'issue_key',
    'issue_title',
    'issue_label',
    'issue_story_points',
    'issue_status',
    'issue_priority',
    'issue_url',
    'issues_export_status',
  ]);

  const rows = createExportRows({
    issueGroups,
    issuesExportStatus,
    members: dashboardData.members,
    sprint: {
      actualEnd: dashboardData.sprint.actualEnd,
      isOverdue: dashboardData.sprint.isOverdue,
      name: dashboardData.sprint.name,
      plannedEnd: dashboardData.sprint.plannedEnd,
      plannedStart: dashboardData.sprint.plannedStart,
    },
    teamName: dashboardData.team.name,
  });
  const fileName = `${sanitizeFilePart(dashboardData.team.name)}-${sanitizeFilePart(dashboardData.sprint.name)}-dashboard.csv`;
  const csv = [header, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}