-- CreateTable
CREATE TABLE "transaction" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "discount_code" TEXT,
    "course_price" DECIMAL(10,2) NOT NULL,
    "discount_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount" (
    "code" TEXT NOT NULL,
    "discount_price" DECIMAL(10,2) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "discount_pkey" PRIMARY KEY ("code")
);
