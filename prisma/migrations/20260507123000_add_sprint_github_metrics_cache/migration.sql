CREATE TABLE "SprintGithubMetricsCache" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintGithubMetricsCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SprintGithubMetricsCache_sprintId_key" ON "SprintGithubMetricsCache"("sprintId");

ALTER TABLE "SprintGithubMetricsCache" ADD CONSTRAINT "SprintGithubMetricsCache_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;