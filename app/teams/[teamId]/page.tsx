import { redirect } from 'next/navigation';

interface TeamPageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default async function TeamPage({ params }: TeamPageProps): Promise<never> {
  const { teamId } = await params;

  redirect(`/teams/${teamId}/sprints`);
}