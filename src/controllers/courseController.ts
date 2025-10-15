import { Request, Response } from "express";
import { prisma } from "../models/prisma";

export const createCourse = async (req: Request, res: Response) => {
  try {
    const { title, code, price } = req.body;
    const course = await prisma.course.create({
      data: {
        title,
        code: code!,
        price: parseFloat(price),
      },
    });
    res.status(201).json(course);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getCourses = async (_req: Request, res: Response) => {
  const courses = await prisma.course.findMany();
  res.json(courses);
};

export const getCourseByCode = async (req: Request, res: Response) => {
  const code = req.params.code!;
  const course = await prisma.course.findUnique({ where: { code } });
  if (!course) return res.status(404).json({ error: "Course not found" });
  res.json(course);
};
