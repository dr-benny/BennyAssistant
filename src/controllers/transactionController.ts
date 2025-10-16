import { Request, Response } from "express";
import { prisma } from "../models/prisma";
import * as generatePayload from "promptpay-qr";

export const updateDiscountPrice = async (req: Request, res: Response) => {
  try {
    const { code, price, username, courseCode } = req.body;
    const transaction = await prisma.transaction.findFirst({
      where: {
        username: username,
        discount_code: null,
        courseCode: courseCode,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: "ไม่พบรายการนี้" });
    }

    const newPrice = Number(transaction.price) - price;
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        discount_code: code,
        discount_price: price,
        price: newPrice,
      },
    });

    res.json(updatedTransaction);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const { username, courseCode, price } = req.body;
    const transaction = await prisma.transaction.create({
      data: {
        username: username,
        courseCode: courseCode,
        price: parseFloat(price),
        course_price: parseFloat(price),
      },
    });
    res.status(201).json(transaction);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  const transactions = await prisma.transaction.findMany();
  res.json(transactions);
};
export const CheckTransactionByUsernameAndCourseThereExists = async (
  req: Request,
  res: Response
) => {
  const username = req.query.username as string;
  const courseCode = req.query.courseCode as string;
  const transaction = await prisma.transaction.findFirst({
    where: { username: username, courseCode: courseCode },
  });
  if (transaction?.paid == true)
    return res
      .status(409)
      .json({ error: "You already have a transaction for this course" });
  else if (transaction?.paid == false && transaction.discount_code == null)
    return res
      .status(408)

      .json({ message: "You have a pending transaction for this course" });
  else if (transaction?.paid == false && transaction.discount_code != null)
    return res.status(407).json({
      message: "You have a pending transaction with discount",
      transaction: transaction,
    });
  return res.status(200).json({ message: "No existing transaction" });
};

export const createQrCode = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: "Transaction ID is required" });
    }
    const transaction = await prisma.transaction.findUnique({
      where: { id: String(transactionId) },
    });
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (transaction.paid) {
      return res.status(400).json({ error: "Transaction already paid" });
    }
    const qrCodeData = generatePayload("006660045808238", {
      amount: Number(transaction.price),
    });
    res.json({ qrCodeData: qrCodeData });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getTransactionByUsernameAndCourse = async (
  req: Request,
  res: Response
) => {
  const username = req.query.username as string;
  const courseCode = req.query.courseCode as string;
  const transaction = await prisma.transaction.findFirst({
    where: { username: username, courseCode: courseCode },
  });
  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }
  res.json(transaction);
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id, paid } = req.body;
    const transaction = await prisma.transaction.findUnique({
      where: { id: String(id) },
    });
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    const updatedTransaction = await prisma.transaction.update({
      where: { id: String(id) },
      data: { paid: paid },
    });
    res.json(updatedTransaction);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
