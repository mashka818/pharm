-- CreateTable
CREATE TABLE "unconfirmed_customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "patronymic" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmationToken" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "role" "CustomerRole" NOT NULL,

    CONSTRAINT "unconfirmed_customers_pkey" PRIMARY KEY ("id")
);
