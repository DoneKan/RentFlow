-- AlterTable
ALTER TABLE "tenancies" ADD COLUMN "tenantName" TEXT;
ALTER TABLE "tenancies" ADD COLUMN "tenantPhone" TEXT;

-- Backfill from the linked user's current name/phone so existing tenancies
-- keep displaying what they show today; new/edited tenancies diverge from
-- here on.
UPDATE "tenancies" t
SET "tenantName" = u."name",
    "tenantPhone" = u."phone"
FROM "users" u
WHERE u."id" = t."tenantId";

ALTER TABLE "tenancies" ALTER COLUMN "tenantName" SET NOT NULL;
