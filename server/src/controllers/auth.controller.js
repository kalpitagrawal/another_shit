
import { Channel } from "../models/Channel.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateAccessAndRefreshTokens } from "../utils/generateTokens.js";
import jwt from "jsonwebtoken";

// Cookie options for tokens
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Generate a unique handle from email prefix.
 * Appends random digits if handle already exists.
 */
const generateUniqueHandle = async (email) => {
    let handle = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (handle.length < 3) handle = handle + "user";

    let uniqueHandle = handle;
    let counter = 1;
    while (await Channel.findOne({ handle: uniqueHandle })) {
        uniqueHandle = `${handle}${Math.floor(Math.random() * 9000) + 1000}`;
        counter++;
        if (counter > 10) {
            uniqueHandle = `${handle}${Date.now().toString().slice(-6)}`;
            break;
        }
    }
    return uniqueHandle;
};

// ─── REGISTER ────────────────────────────────────────────────────────────────
export const register = asyncHandler(async (req, res) => {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(409, "An account with this email already exists");
    }

    // Create user
    const user = await User.create({
        email,
        password,
    });

    // Auto-create channel
    const handle = await generateUniqueHandle(email);
    const channel = await Channel.create({
        owner: user._id,
        handle,
        displayName: displayName || email.split("@")[0],
    });

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user);

    // Get user without sensitive fields
    const createdUser = await User.findById(user._id).select("-password -refreshTokens");

    return res
        .status(201)
        .cookie("accessToken", accessToken, cookieOptions)
        // .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(201, {
                user: createdUser,
                channel,
                accessToken,
                refreshToken,
            }, "Registration successful")
        );
});

// ─── LOGIN ───────────────────────────────────────────────────────────────────
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(401, "Invalid email or password");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid email or password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user);

    const loggedInUser = await User.findById(user._id).select("-password -refreshTokens");
    const channel = await Channel.findOne({ owner: user._id });

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        // .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(200, {
                user: loggedInUser,
                channel,
                accessToken,
                refreshToken,
            }, "Login successful")
        );
});

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshToken) {
        // Remove this specific refresh token
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { refreshTokens: { token: refreshToken } },
        });
    }

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "Logged out successfully"));
});

// ─── REFRESH TOKEN ───────────────────────────────────────────────────────────
export const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is required");
    }

    try {
        const decoded = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decoded._id);
        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        // Check if this refresh token exists in user's tokens
        const tokenExists = user.refreshTokens.some(
            (rt) => rt.token === incomingRefreshToken
        );

        if (!tokenExists) {
            throw new ApiError(401, "Refresh token expired or already used");
        }

        // Remove the old refresh token (rotation)
        user.refreshTokens = user.refreshTokens.filter(
            (rt) => rt.token !== incomingRefreshToken
        );
        await user.save({ validateBeforeSave: false });

        // Generate new tokens
        const { accessToken, refreshToken } =
            await generateAccessAndRefreshTokens(user);

        const loggedInUser = await User.findById(user._id).select("-password -refreshTokens");
        const channel = await Channel.findOne({ owner: user._id });

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            // .cookie("refreshToken", refreshToken, cookieOptions)
            .json(
                new ApiResponse(200, {
                    user: loggedInUser,
                    channel,
                    accessToken,
                    refreshToken,
                }, "Token refreshed successfully")
            );
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(401, "Invalid refresh token");
    }
});

// ─── GET CURRENT USER ────────────────────────────────────────────────────────
export const getCurrentUser = asyncHandler(async (req, res) => {
    const channel = await Channel.findOne({ owner: req.user._id });

    return res
        .status(200)
        .json(
            new ApiResponse(200, {
                user: req.user,
                channel,
            }, "Current user fetched")
        );
});

// ─── GOOGLE OAUTH CALLBACK ──────────────────────────────────────────────────
export const googleCallback = asyncHandler(async (req, res) => {
    // After passport authenticates, req.user is set
    const user = req.user;

    const { accessToken, refreshToken } =
        await generateAccessAndRefreshTokens(user);

    // Redirect to client with tokens
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    return res
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .redirect(`${clientUrl}/?auth=success`);
});
