ALTER TABLE "TeamMember"
ALTER COLUMN "specialization" DROP DEFAULT;

ALTER TABLE "TeamMember"
ALTER COLUMN "specialization" TYPE "Specialization"[]
USING CASE
  WHEN "specialization" IS NULL THEN ARRAY[]::"Specialization"[]
  WHEN "specialization" = 'both' THEN ARRAY['frontend', 'backend']::"Specialization"[]
  ELSE ARRAY["specialization"]
END;

ALTER TABLE "TeamMember"
ALTER COLUMN "specialization" SET DEFAULT ARRAY[]::"Specialization"[];

ALTER TABLE "TeamMember"
ALTER COLUMN "specialization" SET NOT NULL;