import { Router } from "express";
import {
    register,
    login,
    logout,
    refreshAccessToken,
    getCurrentUser,
    googleCallback,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
// import { authLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshAccessToken);

// Protected routes
router.post("/logout", verifyJWT, logout);
router.get("/me", verifyJWT, getCurrentUser);

// Google OAuth (stubbed — requires passport setup with credentials)
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport.authenticate("google", { session: false }), googleCallback);

export default router;
