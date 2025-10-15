"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCourseById = exports.getCourses = exports.createCourse = void 0;
const prisma_1 = require("../models/prisma");
const createCourse = async (req, res) => {
    try {
        const { title, code, price } = req.body;
        const course = await prisma_1.prisma.course.create({
            data: {
                title,
                code: code,
                price: parseFloat(price),
            },
        });
        res.status(201).json(course);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.createCourse = createCourse;
const getCourses = async (_req, res) => {
    const courses = await prisma_1.prisma.course.findMany();
    res.json(courses);
};
exports.getCourses = getCourses;
const getCourseById = async (req, res) => {
    const id = parseInt(req.params.id);
    const course = await prisma_1.prisma.course.findUnique({ where: { id } });
    if (!course)
        return res.status(404).json({ error: "Course not found" });
    res.json(course);
};
exports.getCourseById = getCourseById;
//# sourceMappingURL=courseController.js.map