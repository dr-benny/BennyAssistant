import { Request, Response } from "express";
import { prisma } from "../models/prisma";

export const getDiscountByCode = async (req: Request, res: Response) => {
  const code = req.params.code!;
  const discount = await prisma.discount.findUnique({ where: { code } });
  if (!discount) return res.status(404).json({ error: "Discount not found" });
  res.json(discount);
};

export const updateDiscountStatus = async (req: Request, res: Response) => {
    try {
        const { code, used } = req.body;
        const discount = await prisma.discount.update({
            where: { code },
            data: { used },
        });
        res.json(discount);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}
