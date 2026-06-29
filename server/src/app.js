import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import passport from "./config/passport.js";

const app = express();

// ─── SECURITY ────────────────────────────────────────────────────────────────
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        // contentSecurityPolicy: false, // Disable CSP for development
        contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    })
);

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(passport.initialize());


// ── Routes ────────────────────────────────────────────────────────────────────
import authRouter from "./routes/auth.routes.js";
app.use("/api/v1/auth", authRouter);

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get("/api/v1/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: err.errors || [],
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
});

export { app };