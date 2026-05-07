export const WEEK_DAY = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
} as const;

export type WeekDay = (typeof WEEK_DAY)[keyof typeof WEEK_DAY];

export const WEEK_DAYS: WeekDay[] = [
  WEEK_DAY.MON,
  WEEK_DAY.TUE,
  WEEK_DAY.WED,
  WEEK_DAY.THU,
  WEEK_DAY.FRI,
  WEEK_DAY.SAT,
  WEEK_DAY.SUN,
];

export const NON_WORKING_DAY_TYPE = {
  HOLIDAY: 'holiday',
  VACATION: 'vacation',
  SICKLEAVE: 'sickleave',
} as const;

export type NonWorkingDayType =
  (typeof NON_WORKING_DAY_TYPE)[keyof typeof NON_WORKING_DAY_TYPE];

export const NON_WORKING_DAY_TYPES: NonWorkingDayType[] = [
  NON_WORKING_DAY_TYPE.HOLIDAY,
  NON_WORKING_DAY_TYPE.VACATION,
  NON_WORKING_DAY_TYPE.SICKLEAVE,
];

export const SPECIALIZATION = {
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  TEAM_LEADER: 'team_leader',
  QA: 'qa',
} as const;

export type Specialization = (typeof SPECIALIZATION)[keyof typeof SPECIALIZATION];

export const SPECIALIZATIONS: Specialization[] = [
  SPECIALIZATION.FRONTEND,
  SPECIALIZATION.BACKEND,
  SPECIALIZATION.TEAM_LEADER,
  SPECIALIZATION.QA,
];

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  [SPECIALIZATION.FRONTEND]: 'Frontend',
  [SPECIALIZATION.BACKEND]: 'Backend',
  [SPECIALIZATION.TEAM_LEADER]: 'Team Leader',
  [SPECIALIZATION.QA]: 'QA',
};

export const SPECIALIZATION_SHORT_LABELS: Record<Specialization, string> = {
  [SPECIALIZATION.FRONTEND]: 'FE',
  [SPECIALIZATION.BACKEND]: 'BE',
  [SPECIALIZATION.TEAM_LEADER]: 'TL',
  [SPECIALIZATION.QA]: 'QA',
};

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    message: string;
    code?: string;
    conflicts?: string[];
    details?: Record<string, string>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const USER_ROLE = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const USER_STATUS = {
  ACTIVE: 'active',
  DEACTIVATED: 'deactivated',
  PENDING: 'pending',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export interface AuthenticatedUserRecord {
  email: string;
  id: string;
  invitedByEmail: string | null;
  mustChangePassword: boolean;
  role: UserRole;
  status: UserStatus;
}

export interface RegistrationPageState {
  bootstrapRegistrationOpen: boolean;
  invitedEmail: string | null;
  inviteTokenValid: boolean;
  requiresInvite: boolean;
}

export interface ManagedUserRecord {
  assignedTeamIds: string[];
  assignedTeams: TeamOption[];
  email: string;
  id: string;
  invitedByEmail: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface SettingsFormValues {
  jiraDomain: string;
  jiraEmail: string;
  jiraApiKey: string;
  storyPointsFieldId: string;
  githubApiKey: string;
}

export interface SettingsPageData {
  jiraDomain: string;
  jiraEmail: string;
  storyPointsFieldId: string;
  hasJiraKey: boolean;
  hasGithubKey: boolean;
}

export interface SettingsValidationErrors {
  jiraDomain?: string;
  jiraEmail?: string;
  jiraApiKey?: string;
  storyPointsFieldId?: string;
  githubApiKey?: string;
}

export interface SettingsResponseData extends SettingsPageData {
  jiraApiKey: string;
  githubApiKey: string;
}

export interface JiraConnectionResult {
  success: boolean;
  message?: string;
}

export interface JiraSprintMetadata {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  activatedDate?: string;
}

export interface JiraIssueAssignee {
  emailAddress: string;
  displayName: string;
}

export interface JiraIssuePriority {
  name: 'David Jackson' | 'Critical' | 'High' | 'Medium' | 'Low' | 'Lowest';
}

export interface JiraIssueHistoryItem {
  field: string;
  fieldId?: string;
  toString: string | null;
  fromString: string | null;
}

export interface JiraIssueHistory {
  created: string;
  items: JiraIssueHistoryItem[];
}

export interface JiraIssueFields {
  created: string;
  summary: string;
  assignee: JiraIssueAssignee | null;
  priority: JiraIssuePriority | null;
  issuetype?: {
    name: string;
  } | null;
  status: {
    name: string;
  };
  [storyPointsField: string]: unknown;
}

export interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
  changelog: {
    histories: JiraIssueHistory[];
  };
}

export interface CreateTeamValues {
  name: string;
  jiraSpace: string;
  githubRepositories: string;
  estimateInHours: boolean;
}

export interface TeamValidationErrors {
  name?: string;
  jiraSpace?: string;
  githubRepositories?: string;
}

export interface TeamOption {
  id: string;
  name: string;
}

export interface TeamDetail {
  id: string;
  name: string;
  jiraSpace: string;
  githubRepositories: string[];
  estimateInHours: boolean;
}

export interface TeamMemberRecord {
  id: string;
  teamId: string;
  name: string;
  jiraEmail: string;
  githubUsername: string;
  workingDays: WeekDay[];
  defaultFocusFactor: number;
  specialization: Specialization[];
}

export interface TeamMemberFormValues {
  teamId: string;
  name: string;
  jiraEmail: string;
  githubUsername: string;
  workingDays: WeekDay[];
  defaultFocusFactor: string;
  specialization: Specialization[];
}

export interface TeamMemberValidationErrors {
  teamId?: string;
  name?: string;
  jiraEmail?: string;
  githubUsername?: string;
  workingDays?: string;
  defaultFocusFactor?: string;
  specialization?: string;
}

export interface NonWorkingDayRecord {
  id: string;
  memberId: string;
  teamId: string;
  date: string;
  type: NonWorkingDayType;
  halfDay: boolean;
}

export interface CalendarNonWorkingDayRecord extends NonWorkingDayRecord {
  memberName: string;
}

export interface CalendarMemberOption {
  id: string;
  name: string;
}

export interface CalendarSprintBand {
  id: string;
  name: string;
  activatedAt: string | null;
  plannedStart: string;
  plannedEnd: string;
  actualEnd: string | null;
  isOverdue: boolean;
}

export interface TeamCalendarData {
  team: TeamDetail;
  members: CalendarMemberOption[];
  sprints: CalendarSprintBand[];
  nonWorkingDays: CalendarNonWorkingDayRecord[];
}

export interface NonWorkingDayFormValues {
  memberIds: string[];
  date: string;
  type: NonWorkingDayType;
  halfDay: boolean;
}

export interface NonWorkingDayValidationErrors {
  memberIds?: string;
  date?: string;
  type?: string;
  halfDay?: string;
  conflicts?: string[];
}

export interface SprintRecord {
  id: string;
  teamId: string;
  jiraSprintId: number;
  name: string;
  plannedStart: Date;
  plannedEnd: Date;
  actualEnd: Date | null;
  activatedAt: Date | null;
}

export interface SprintListItem extends SprintRecord {
  isOverdue: boolean;
}

export interface SprintOption {
  id: string;
  name: string;
}

export interface AddSprintFormValues {
  teamId: string;
  jiraSprintId: string;
}

export interface SprintValidationErrors {
  teamId?: string;
  jiraSprintId?: string;
}

export interface AbsenceSummary {
  holiday: number;
  vacation: number;
  sickleave: number;
}

export interface GithubSprintMetrics {
  averageReviewTimeHours: number | null;
  averageCommentsPerPullRequest: number | null;
  mergedPullRequests: number;
  openedPullRequests: number;
  approvedPullRequests: number;
  submittedReviews: number;
}

export interface MemberCapacityData {
  memberId: string;
  name: string;
  specialization: Specialization[];
  plannedWorkingDays: number;
  focusFactor: number;
  plannedCapacity: number;
  actualWorkingDays: number | null;
  actualCapacity: number | null;
  absenceSummary: AbsenceSummary;
  githubMetrics: GithubSprintMetrics | null;
}

export interface SprintCapacityTotals {
  plannedCapacity: number;
  actualCapacity: number | null;
}

export interface SprintDashboardData {
  team: TeamDetail;
  sprint: SprintListItem;
  sprints: SprintOption[];
  members: MemberCapacityData[];
  totals: SprintCapacityTotals;
}

export interface IssueGroupMember {
  id: string;
  jiraEmail: string;
  name: string;
  specialization: Specialization[];
}

export interface ProcessedIssue {
  key: string;
  title: string;
  url: string;
  issueType: string | null;
  label: 'planned' | 'unplanned' | 'external';
  storyPoints: number | null;
  status: string;
  statusAtSprintStart: string;
  statusAtSprintEnd: string;
  priority: JiraIssuePriority['name'] | null;
  assigneeEmail: string;
  testingTimeHours: number | null;
}

export interface DeveloperIssueGroup {
  member: IssueGroupMember;
  externalInProgressIssues: ProcessedIssue[];
  issues: ProcessedIssue[];
  totalStoryPoints: number;
}

export interface SprintIssuesResponseData {
  groups: DeveloperIssueGroup[];
  qaGroups: DeveloperIssueGroup[];
  cachedAt: string | null;
  isStale: boolean;
}