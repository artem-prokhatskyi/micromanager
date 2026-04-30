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
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;