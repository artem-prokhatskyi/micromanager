import { unstable_noStore as noStore } from 'next/cache';

import { prisma } from '@/lib/prisma';
import type { SettingsPageData } from '@/types';

export async function getSettingsPageData(): Promise<SettingsPageData> {
  noStore();

  const settings = await prisma.settings.findFirst({
    select: {
      jiraDomain: true,
      jiraEmail: true,
      storyPointsFieldId: true,
      jiraApiKey: true,
      githubApiKey: true,
    },
  });

  return {
    jiraDomain: settings?.jiraDomain ?? '',
    jiraEmail: settings?.jiraEmail ?? '',
    storyPointsFieldId: settings?.storyPointsFieldId ?? 'story_points',
    hasJiraKey: Boolean(settings?.jiraApiKey),
    hasGithubKey: Boolean(settings?.githubApiKey),
  };
}