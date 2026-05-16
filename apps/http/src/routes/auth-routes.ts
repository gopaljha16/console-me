import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { googleLogin, logout } from "../controller/auth-controller.js";

const authRoutes: ExpressRouter = Router();

authRoutes.post("/google", googleLogin);
authRoutes.post("/logout", logout);

export default authRoutes;
