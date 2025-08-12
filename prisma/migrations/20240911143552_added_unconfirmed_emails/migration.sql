-- CreateTable
CREATE TABLE "UnconfirmedEmail" (
    "email" TEXT NOT NULL,
    "confirmationToken" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UnconfirmedEmail_confirmationToken_key" ON "UnconfirmedEmail"("confirmationToken");
