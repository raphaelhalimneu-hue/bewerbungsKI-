import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import generateRouter from "./generate";
import documentsRouter from "./documents";
import checkoutRouter from "./checkout";
import downloadRouter from "./download";
import adminRouter from "./admin";
import profileRouter from "./profile";
import docxRouter from "./docx";
import pdfRouter from "./pdf";
import parseLinkedinRouter from "./parse-linkedin";
import analyzeRouter from "./analyze";
import extractRouter from "./extract";
import ratingsRouter from "./ratings";
import verifyRouter from "./verify";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(generateRouter);
router.use(documentsRouter);
router.use(checkoutRouter);
router.use(downloadRouter);
router.use(adminRouter);
router.use(profileRouter);
router.use(docxRouter);
router.use(pdfRouter);
router.use(parseLinkedinRouter);
router.use(analyzeRouter);
router.use(extractRouter);
router.use(ratingsRouter);
router.use(verifyRouter);

export default router;
