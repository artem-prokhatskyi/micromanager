import { NextResponse } from 'next/server';

import { z } from 'zod';

import { encrypt } from '@/lib/encryption';
import { getCurrentUserOrNull } from '@/lib/auth';
import { validateJiraConnection } from '@/lib/jira';
import { prisma } from '@/lib/prisma';
import type { ApiResponse, SettingsResponseData } from '@/types';

const MASKED_SECRET = '••••••••';

const settingsSchema = z.object({
  jiraDomain: z.string().trim().min(1, 'Jira domain is required.'),
  jiraEmail: z.string().trim().email('Enter a valid Jira email address.'),
  jiraApiKey: z.string(),
  storyPointsFieldId: z.string(),
  githubApiKey: z.string().optional().default(''),
});

function normalizeDomain(domain: string): string {
  return domain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function mapValidationErrors(error: z.ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((accumulator, issue) => {
    const path = issue.path[0];

    if (typeof path === 'string' && !accumulator[path]) {
      accumulator[path] = issue.message;
    }

    return accumulator;
  }, {});
}

function toResponse(data: SettingsResponseData): NextResponse<ApiResponse<SettingsResponseData>> {
  return NextResponse.json({ data });
}

export async function GET(): Promise<NextResponse<ApiResponse<SettingsResponseData>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json(
        { error: { message: 'Authentication required.' } },
        { status: 401 },
      );
    }

    if (currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: { message: 'Admin access is required.' } },
        { status: 403 },
      );
    }

    const settings = await prisma.settings.findFirst({
      select: {
        jiraDomain: true,
        jiraEmail: true,
        jiraApiKey: true,
        storyPointsFieldId: true,
        githubApiKey: true,
      },
    });

    return toResponse({
      jiraDomain: settings?.jiraDomain ?? '',
      jiraEmail: settings?.jiraEmail ?? '',
      jiraApiKey: settings?.jiraApiKey ? MASKED_SECRET : '',
      storyPointsFieldId: settings?.storyPointsFieldId ?? 'story_points',
      githubApiKey: settings?.githubApiKey ? MASKED_SECRET : '',
      hasJiraKey: Boolean(settings?.jiraApiKey),
      hasGithubKey: Boolean(settings?.githubApiKey),
    });
  } catch (error) {
    console.error('[API /settings GET]', error);

    return NextResponse.json(
      { error: { message: 'Failed to load settings.' } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ success: true }>>> {
  try {
    const currentUser = await getCurrentUserOrNull();

    if (!currentUser) {
      return NextResponse.json(
        { error: { message: 'Authentication required.' } },
        { status: 401 },
      );
    }

    if (currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: { message: 'Admin access is required.' } },
        { status: 403 },
      );
    }

    const body = (await request.json()) as unknown;
    const result = settingsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid settings input.',
            code: 'VALIDATION_ERROR',
            details: mapValidationErrors(result.error),
          },
        },
        { status: 400 },
      );
    }

    const existingSettings = await prisma.settings.findFirst({
      select: {
        id: true,
        jiraApiKey: true,
        githubApiKey: true,
      },
    });

    const normalizedDomain = normalizeDomain(result.data.jiraDomain);
    const jiraApiKey = result.data.jiraApiKey.trim();
    const githubApiKey = result.data.githubApiKey.trim();
    const storyPointsFieldId = result.data.storyPointsFieldId.trim() || 'story_points';

    if (!jiraApiKey && !existingSettings?.jiraApiKey) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid settings input.',
            code: 'VALIDATION_ERROR',
            details: {
              jiraApiKey: 'Jira API key is required.',
            },
          },
        },
        { status: 400 },
      );
    }

    const data = {
      jiraDomain: normalizedDomain,
      jiraEmail: result.data.jiraEmail.trim(),
      jiraApiKey: jiraApiKey ? encrypt(jiraApiKey) : existingSettings?.jiraApiKey ?? '',
      storyPointsFieldId,
      githubApiKey: githubApiKey ? encrypt(githubApiKey) : existingSettings?.githubApiKey ?? '',
    };

    if (existingSettings) {
      await prisma.settings.update({
        where: {
          id: existingSettings.id,
        },
        data,
      });
    } else {
      await prisma.settings.create({
        data,
      });
    }

    const validationResult = await validateJiraConnection();

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            message: validationResult.message ?? 'Jira is currently unavailable.',
            code: 'JIRA_VALIDATION_FAILED',
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('[API /settings POST]', error);

    return NextResponse.json(
      { error: { message: 'Failed to save settings.' } },
      { status: 500 },
    );
  }
}