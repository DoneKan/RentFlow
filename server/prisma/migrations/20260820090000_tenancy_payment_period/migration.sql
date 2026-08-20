-- AlterTable
ALTER TABLE "tenancies" ADD COLUMN "paymentPeriod" TEXT;
ALTER TABLE "tenancies" ADD COLUMN "customIntervalMonths" INTEGER;

-- Backfill from the unit's own payment period at migration time — every
-- existing tenancy's billing cadence, until now, was always effectively
-- "whatever the unit currently says", so this is a safe, non-lossy
-- snapshot (unlike the tenantName/tenantPhone backfill, there is no
-- shared/collided source here: a unit's paymentPeriod was never shared
-- across unrelated tenancies).
UPDATE "tenancies" t
SET "paymentPeriod" = u."paymentPeriod"
FROM "units" u
WHERE u."id" = t."unitId";

ALTER TABLE "tenancies" ALTER COLUMN "paymentPeriod" SET NOT NULL;
