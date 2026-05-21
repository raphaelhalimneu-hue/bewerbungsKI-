import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import generateRouter from "./generate";
import documentsRouter from "./documents";
import checkoutRouter from "./checkout";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(generateRouter);
router.use(documentsRouter);
router.use(checkoutRouter);

export default router;
