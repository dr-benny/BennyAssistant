import { Router } from "express";
import { createCourse, getCourses,getCourseByCode } from "../controllers/courseController";

const router = Router();

router.post("/", createCourse);
router.get("/", getCourses);
router.get("/:code", getCourseByCode);

export default router;
