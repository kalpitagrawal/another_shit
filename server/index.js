import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { connectDB } from "./src/config/db.js";
import { connectRedis } from "./src/config/redis.js";
import { configureCloudinary } from "./src/config/cloudinary.js";
import { configureS3 } from "./src/config/s3.js";
import { app } from "./src/app.js";
import { initializeSocket } from "./src/socket/socket.js";

const PORT = process.env.PORT || 8000;

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Connect to Redis (graceful — continues without it)
        connectRedis();

        // Configure Cloudinary
        configureCloudinary();

        // Configure S3/MinIO
        configureS3();

        // Create HTTP server
        const server = http.createServer(app);

        // Initialize Socket.io
        initializeSocket(server);

        // Start listening
        server.listen(PORT, () => {
            console.log(`server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
            console.log(`API: http://localhost:${PORT}/api/v1`);
            console.log(`Health: http://localhost:${PORT}/api/v1/health\n`);
});
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();