import { Router } from "express";
import { protect } from "../middleware/user-middleware.js";
import { sendFriendRequest, acceptFriendRequest, listFriends } from "../controller/friend-controller.js";

const router: import("express").Router = Router();

router.use(protect);
router.post("/request", sendFriendRequest);
router.post("/accept", acceptFriendRequest);
router.get("/", listFriends);

export default router;
