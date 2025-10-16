import { Router } from "express";
import {
  updateDiscountPrice,
  createTransaction,
  CheckTransactionByUsernameAndCourseThereExists,
  createQrCode,
  getTransactionByUsernameAndCourse,
  updatePaymentStatus,

} from "../controllers/transactionController";

const router = Router();

router.post("/", createTransaction);
router.put("/updateDiscountPrice", updateDiscountPrice);
router.get("/check", CheckTransactionByUsernameAndCourseThereExists);
router.post("/createQrCode", createQrCode);
router.get("/getTransactionByUsernameAndCourse", getTransactionByUsernameAndCourse);
router.put("/updatePaymentStatus", updatePaymentStatus);

export default router;
