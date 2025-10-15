import { Router } from "express";
import {
  updateDiscountPrice,
  createTransaction,
  getTransactionByUsernameAndCourse,
  createQrCode

} from "../controllers/transactionController";

const router = Router();

router.post("/", createTransaction);
router.put("/updateDiscountPrice", updateDiscountPrice);
router.get("/check", getTransactionByUsernameAndCourse);
router.post("/createQrCode", createQrCode);

export default router;
