-- CreateIndex
CREATE UNIQUE INDEX "users_organizationId_id_key" ON "users"("organizationId", "id");

-- CreateTable
CREATE TABLE "changelog_acknowledgments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sectionIdentity" TEXT NOT NULL,

    CONSTRAINT "changelog_acknowledgments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "changelog_acknowledgments_sectionIdentity_check" CHECK (length("sectionIdentity") > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "changelog_acknowledgments_organizationId_userId_sectionIdentity_key"
ON "changelog_acknowledgments"("organizationId", "userId", "sectionIdentity");

-- AddForeignKey
ALTER TABLE "changelog_acknowledgments"
ADD CONSTRAINT "changelog_acknowledgments_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changelog_acknowledgments"
ADD CONSTRAINT "changelog_acknowledgments_organizationId_userId_fkey"
FOREIGN KEY ("organizationId", "userId") REFERENCES "users"("organizationId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;
