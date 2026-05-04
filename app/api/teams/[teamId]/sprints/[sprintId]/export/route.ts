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

function createCapacityRows(input: {
  members: MemberCapacityData[];
  sprint: {
    isOverdue: boolean;
  };
  totals: {
    actualCapacity: number | null;
    plannedCapacity: number;
  };
}): string[] {
  const header = toCsvRow([
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
  ]);

  const rows = input.members.map((member) =>
    toCsvRow([
      member.name,
      member.specialization ?? '',
      member.plannedWorkingDays,
      member.focusFactor,
      member.plannedCapacity,
      input.sprint.isOverdue ? member.actualWorkingDays : null,
      input.sprint.isOverdue ? member.actualCapacity : null,
      member.absenceSummary.holiday,
      member.absenceSummary.vacation,
      member.absenceSummary.sickleave,
    ]),
  );

  rows.push(
    toCsvRow([
      'Totals',
      '',
      '',
      '',
      input.totals.plannedCapacity,
      '',
      input.sprint.isOverdue ? input.totals.actualCapacity : null,
      '',
      '',
      '',
    ]),
  );

  return ['Capacity', header, ...rows];
}

function createIssueSectionRows(input: {
  issueGroups: DeveloperIssueGroup[];
  issuesExportStatus: string;
}): string[] {
  if (input.issuesExportStatus !== 'included') {
    return ['Sprint issues', toCsvRow(['status', input.issuesExportStatus])];
  }

  const issueTableHeader = toCsvRow([
    'key',
    'title',
    'story_points',
    'priority',
    'status',
  ]);

  const rows: string[] = ['Sprint issues'];

  for (const group of input.issueGroups) {
    const plannedIssues = group.issues.filter((issue) => issue.label === 'planned');
    const unplannedIssues = group.issues.filter((issue) => issue.label === 'unplanned');

    rows.push('');
    rows.push(toCsvRow(['developer', group.member.name]));
    rows.push(toCsvRow(['developer_jira_email', group.member.jiraEmail]));
    rows.push(toCsvRow(['total_story_points', group.totalStoryPoints]));

    if (plannedIssues.length > 0) {
      rows.push('');
      rows.push('Planned issues');
      rows.push(issueTableHeader);
      rows.push(...plannedIssues.map(toIssueRow));
    }

    if (unplannedIssues.length > 0) {
      rows.push('');
      rows.push('Unplanned issues');
      rows.push(issueTableHeader);
      rows.push(...unplannedIssues.map(toIssueRow));
    }
  }

  return rows;
}

function toIssueRow(issue: ProcessedIssue): string {
  return toCsvRow([
    issue.key,
    issue.title,
    issue.storyPoints,
    issue.priority,
    issue.status,
  ]);
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
        estimateInHours: issuesContext.team.estimateInHours,
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

  const metadataRows = [
    toCsvRow(['team_name', dashboardData.team.name]),
    toCsvRow(['sprint_name', dashboardData.sprint.name]),
    toCsvRow(['planned_start', toIsoDate(dashboardData.sprint.plannedStart)]),
    toCsvRow(['planned_end', toIsoDate(dashboardData.sprint.plannedEnd)]),
    toCsvRow(['actual_end', toIsoDate(dashboardData.sprint.actualEnd)]),
    toCsvRow(['is_overdue', dashboardData.sprint.isOverdue]),
  ];
  const capacityRows = createCapacityRows({
    members: dashboardData.members,
    sprint: {
      isOverdue: dashboardData.sprint.isOverdue,
    },
    totals: dashboardData.totals,
  });
  const issueRows = createIssueSectionRows({
    issueGroups,
    issuesExportStatus,
  });
  const fileName = `${sanitizeFilePart(dashboardData.team.name)}-${sanitizeFilePart(dashboardData.sprint.name)}-dashboard.csv`;
  const csv = [...metadataRows, '', ...capacityRows, '', ...issueRows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}