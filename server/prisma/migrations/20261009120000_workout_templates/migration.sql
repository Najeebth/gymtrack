-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateExercise" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "muscleGroup" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "sets" JSONB NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "TemplateExercise_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateExercise" ADD CONSTRAINT "TemplateExercise_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

