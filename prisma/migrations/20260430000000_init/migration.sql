-- CreateEnum
CREATE TYPE "WeekDay" AS ENUM ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');

-- CreateEnum
CREATE TYPE "Specialization" AS ENUM ('frontend', 'backend', 'both');

-- CreateEnum
CREATE TYPE "NonWorkingDayType" AS ENUM ('holiday', 'vacation', 'sickleave');

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "jiraDomain" TEXT NOT NULL DEFAULT '',
    "jiraEmail" TEXT NOT NULL DEFAULT '',
    "jiraApiKey" TEXT NOT NULL DEFAULT '',
    "storyPointsFieldId" TEXT NOT NULL DEFAULT 'story_points',
    "githubApiKey" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jiraSpace" TEXT NOT NULL,
    "githubRepositories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jiraEmail" TEXT NOT NULL,
    "githubUsername" TEXT NOT NULL DEFAULT '',
    "workingDays" "WeekDay"[],
    "defaultFocusFactor" DOUBLE PRECISION NOT NULL,
    "specialization" "Specialization",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonWorkingDay" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "NonWorkingDayType" NOT NULL,
    "halfDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NonWorkingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "jiraSprintId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "actualEnd" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintFocusFactor" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "focusFactor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintFocusFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintIssueCache" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintIssueCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NonWorkingDay_memberId_date_key" ON "NonWorkingDay"("memberId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SprintFocusFactor_sprintId_memberId_key" ON "SprintFocusFactor"("sprintId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintIssueCache_sprintId_key" ON "SprintIssueCache"("sprintId");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonWorkingDay" ADD CONSTRAINT "NonWorkingDay_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonWorkingDay" ADD CONSTRAINT "NonWorkingDay_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintFocusFactor" ADD CONSTRAINT "SprintFocusFactor_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintFocusFactor" ADD CONSTRAINT "SprintFocusFactor_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintIssueCache" ADD CONSTRAINT "SprintIssueCache_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;