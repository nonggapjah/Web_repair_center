-- CreateTable
CREATE TABLE "repair_branch" (
    "BranchID" TEXT NOT NULL,
    "BranchName" TEXT NOT NULL,

    CONSTRAINT "repair_branch_pkey" PRIMARY KEY ("BranchID")
);

-- CreateTable
CREATE TABLE "repair_user" (
    "UserID" TEXT NOT NULL,
    "Username" TEXT NOT NULL,
    "Password" TEXT NOT NULL DEFAULT '1234',
    "PasswordHash" TEXT,
    "Role" TEXT NOT NULL DEFAULT 'User',
    "BranchID" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_user_pkey" PRIMARY KEY ("UserID")
);

-- CreateTable
CREATE TABLE "repair_repairticket" (
    "TicketID" TEXT NOT NULL,
    "UserID" TEXT NOT NULL,
    "BranchID" TEXT NOT NULL,
    "Product" TEXT NOT NULL,
    "Symptom" TEXT NOT NULL,
    "Description" TEXT,
    "ImageURL" TEXT,
    "Priority" TEXT NOT NULL DEFAULT 'Medium',
    "CurrentStatus" TEXT NOT NULL DEFAULT 'Open',
    "JobCategory" TEXT,
    "SupplierName" TEXT,
    "RequestDate" TIMESTAMP(3),
    "ActualDate" TIMESTAMP(3),
    "SLA_Deadline" TIMESTAMP(3),
    "TotalCost" DOUBLE PRECISION,
    "CSAT_Score" INTEGER,
    "Technician" TEXT,
    "AdminSignature" TEXT,
    "UserSignature" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_repairticket_pkey" PRIMARY KEY ("TicketID")
);

-- CreateTable
CREATE TABLE "repair_tickettechnician" (
    "id" TEXT NOT NULL,
    "TicketID" TEXT NOT NULL,
    "TechnicianName" TEXT NOT NULL,
    "AssignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_tickettechnician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_tickethistory" (
    "HistoryID" TEXT NOT NULL,
    "TicketID" TEXT NOT NULL,
    "Status" TEXT NOT NULL,
    "UpdatedBy" TEXT NOT NULL,
    "Note" TEXT,
    "Timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_tickethistory_pkey" PRIMARY KEY ("HistoryID")
);

-- CreateTable
CREATE TABLE "repair_ticketcomment" (
    "CommentID" TEXT NOT NULL,
    "TicketID" TEXT NOT NULL,
    "UserID" TEXT NOT NULL,
    "Message" TEXT NOT NULL,
    "ImageURL" TEXT,
    "Timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_ticketcomment_pkey" PRIMARY KEY ("CommentID")
);

-- CreateTable
CREATE TABLE "repair_notification" (
    "NotifID" TEXT NOT NULL,
    "TargetRole" TEXT,
    "TargetUser" TEXT,
    "Title" TEXT NOT NULL,
    "Message" TEXT NOT NULL,
    "TicketID" TEXT,
    "IsRead" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_notification_pkey" PRIMARY KEY ("NotifID")
);

-- CreateTable
CREATE TABLE "repair_auditlog" (
    "LogID" TEXT NOT NULL,
    "UserID" TEXT,
    "Action" TEXT NOT NULL,
    "EntityType" TEXT,
    "EntityID" TEXT,
    "Before" TEXT,
    "After" TEXT,
    "IPAddress" TEXT,
    "UserAgent" TEXT,
    "Timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_auditlog_pkey" PRIMARY KEY ("LogID")
);

-- CreateTable
CREATE TABLE "repair_failedloginattempt" (
    "AttemptID" TEXT NOT NULL,
    "Username" TEXT NOT NULL,
    "IPAddress" TEXT,
    "AttemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_failedloginattempt_pkey" PRIMARY KEY ("AttemptID")
);

-- CreateIndex
CREATE UNIQUE INDEX "repair_user_Username_key" ON "repair_user"("Username");

-- CreateIndex
CREATE INDEX "repair_repairticket_BranchID_idx" ON "repair_repairticket"("BranchID");

-- CreateIndex
CREATE INDEX "repair_repairticket_CurrentStatus_idx" ON "repair_repairticket"("CurrentStatus");

-- CreateIndex
CREATE INDEX "repair_repairticket_JobCategory_idx" ON "repair_repairticket"("JobCategory");

-- CreateIndex
CREATE INDEX "repair_repairticket_SupplierName_idx" ON "repair_repairticket"("SupplierName");

-- CreateIndex
CREATE INDEX "repair_tickettechnician_TicketID_idx" ON "repair_tickettechnician"("TicketID");

-- CreateIndex
CREATE INDEX "repair_tickettechnician_TechnicianName_idx" ON "repair_tickettechnician"("TechnicianName");

-- CreateIndex
CREATE UNIQUE INDEX "repair_tickettechnician_TicketID_TechnicianName_key" ON "repair_tickettechnician"("TicketID", "TechnicianName");

-- CreateIndex
CREATE INDEX "repair_auditlog_UserID_idx" ON "repair_auditlog"("UserID");

-- CreateIndex
CREATE INDEX "repair_auditlog_Action_idx" ON "repair_auditlog"("Action");

-- CreateIndex
CREATE INDEX "repair_auditlog_EntityType_EntityID_idx" ON "repair_auditlog"("EntityType", "EntityID");

-- CreateIndex
CREATE INDEX "repair_auditlog_Timestamp_idx" ON "repair_auditlog"("Timestamp");

-- CreateIndex
CREATE INDEX "repair_failedloginattempt_Username_AttemptedAt_idx" ON "repair_failedloginattempt"("Username", "AttemptedAt");

-- AddForeignKey
ALTER TABLE "repair_user" ADD CONSTRAINT "repair_user_BranchID_fkey" FOREIGN KEY ("BranchID") REFERENCES "repair_branch"("BranchID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_repairticket" ADD CONSTRAINT "repair_repairticket_UserID_fkey" FOREIGN KEY ("UserID") REFERENCES "repair_user"("UserID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "repair_repairticket" ADD CONSTRAINT "repair_repairticket_BranchID_fkey" FOREIGN KEY ("BranchID") REFERENCES "repair_branch"("BranchID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "repair_tickettechnician" ADD CONSTRAINT "repair_tickettechnician_TicketID_fkey" FOREIGN KEY ("TicketID") REFERENCES "repair_repairticket"("TicketID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_tickethistory" ADD CONSTRAINT "repair_tickethistory_TicketID_fkey" FOREIGN KEY ("TicketID") REFERENCES "repair_repairticket"("TicketID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_ticketcomment" ADD CONSTRAINT "repair_ticketcomment_TicketID_fkey" FOREIGN KEY ("TicketID") REFERENCES "repair_repairticket"("TicketID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "repair_ticketcomment" ADD CONSTRAINT "repair_ticketcomment_UserID_fkey" FOREIGN KEY ("UserID") REFERENCES "repair_user"("UserID") ON DELETE NO ACTION ON UPDATE NO ACTION;

