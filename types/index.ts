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
  BOTH: 'both',
} as const;

export type Specialization = (typeof SPECIALIZATION)[keyof typeof SPECIALIZATION];

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    message: string;
    code?: string;
    details?: Record<string, string>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

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
  startDate: string;
  endDate: string;
  completeDate?: string;
  activatedDate?: string;
}

export interface JiraIssueAssignee {
  emailAddress: string;
  displayName: string;
}

export interface JiraIssuePriority {
  name: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
}

export interface JiraIssueHistoryItem {
  field: string;
  toString: string | null;
  fromString: string | null;
}

export interface JiraIssueHistory {
  created: string;
  items: JiraIssueHistoryItem[];
}

export interface JiraIssueFields {
  summary: string;
  assignee: JiraIssueAssignee | null;
  priority: JiraIssuePriority | null;
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
}

export interface TeamMemberRecord {
  id: string;
  teamId: string;
  name: string;
  jiraEmail: string;
  githubUsername: string;
  workingDays: WeekDay[];
  defaultFocusFactor: number;
  specialization: Specialization | null;
}

export interface TeamMemberFormValues {
  teamId: string;
  name: string;
  jiraEmail: string;
  githubUsername: string;
  workingDays: WeekDay[];
  defaultFocusFactor: string;
  frontendSpecialization: boolean;
  backendSpecialization: boolean;
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