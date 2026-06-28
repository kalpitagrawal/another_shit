import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Middleware to verify JWT access token.
 * Extracts token from cookies or Authorization header.
 * Attaches the user document to req.user.
 */
export const verifyJWT = asyncHandler(async (req, _res, next) => {
    const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new ApiError(401, "Unauthorized — no access token provided");
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decoded._id).select(
            "-password -refreshTokens"
        );

        if (!user) {
            throw new ApiError(401, "Unauthorized — user not found");
        }

        req.user = user;
        next();
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(401, "Unauthorized — invalid or expired access token");
    }
});
