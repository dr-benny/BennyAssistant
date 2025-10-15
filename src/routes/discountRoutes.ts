import { Router } from "express";
import { getDiscountByCode , updateDiscountStatus } from "../controllers/discountController";

const router = Router();

router.get("/:code", getDiscountByCode);
router.put("/", updateDiscountStatus);

export default router;
