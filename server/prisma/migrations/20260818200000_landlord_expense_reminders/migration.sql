-- CreateTable
CREATE TABLE "landlord_expense_reminders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "recurrenceType" TEXT NOT NULL,
    "customIntervalDays" INTEGER,
    "anchorDate" TIMESTAMP(3) NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "remindDaysBefore" INTEGER NOT NULL DEFAULT 7,
    "lastReminderForDueDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landlord_expense_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landlord_expense_reminders_organizationId_idx" ON "landlord_expense_reminders"("organizationId");

-- CreateIndex
CREATE INDEX "landlord_expense_reminders_nextDueDate_idx" ON "landlord_expense_reminders"("nextDueDate");

-- AddForeignKey
ALTER TABLE "landlord_expense_reminders" ADD CONSTRAINT "landlord_expense_reminders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landlord_expense_reminders" ADD CONSTRAINT "landlord_expense_reminders_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landlord_expense_reminders" ADD CONSTRAINT "landlord_expense_reminders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
