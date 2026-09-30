import { Router, type IRouter } from "express";
import healthRouter from "./health";
import menuRouter from "./menu";
import feedbackRouter from "./feedback";
import summaryRouter from "./summary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(menuRouter);
router.use(feedbackRouter);
router.use(summaryRouter);

export default router;
