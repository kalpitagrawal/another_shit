import { User } from "../models/User.model.js";
import { Channel } from "../models/Channel.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateAccessAndRefreshTokens } from "../utils/generateTokens.js";
import jwt from "jsonwebtoken";

// ─── Cookie Options ───────────────────────────────────────────────────────────
const baseCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
};

const accessCookieOptions = {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000, // 15 min
};

const refreshCookieOptions = {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ─── REGISTER ────────────────────────────────────────────────────────────────
export const register = asyncHandler(async (req, res) => {
    const { email, password, handle, displayName } = req.body;

    if (!email || !password || !handle || !displayName) {
        throw new ApiError(400, "Email, password, handle and displayName are required");
    }

    const HANDLE_REGEX = /^[a-z0-9_]+$/;
    if (!HANDLE_REGEX.test(handle)) {
        throw new ApiError(400, "Handle can only contain lowercase letters, numbers, and underscores");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(409, "An account with this email already exists");
    }

    const existingHandle = await Channel.findOne({ handle });
    if (existingHandle) {
        throw new ApiError(409, "Handle already taken");
    }

    const user = await User.create({ email, password });

    const channel = await Channel.create({
        owner: user._id,
        handle,
        displayName: displayName.trim(),
    });

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user);

    const createdUser = await User.findById(user._id).select("-password -refreshTokens");

    return res
        .status(201)
        .cookie("accessToken", accessToken, accessCookieOptions)
        .cookie("refreshToken", refreshToken, refreshCookieOptions)
        .json(
            new ApiResponse(201, {
                user: createdUser,
                channel,
                accessToken,
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
        .cookie("accessToken", accessToken, accessCookieOptions)
        .cookie("refreshToken", refreshToken, refreshCookieOptions)
        .json(
            new ApiResponse(200, {
                user: loggedInUser,
                channel,
                accessToken,
            }, "Login successful")
        );
});

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshToken) {
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { refreshTokens: { token: refreshToken } },
        });
    }

    return res
        .status(200)
        .clearCookie("accessToken", baseCookieOptions)
        .clearCookie("refreshToken", baseCookieOptions)
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

        const tokenExists = user.refreshTokens.some(
            (rt) => rt.token === incomingRefreshToken
        );
        if (!tokenExists) {
            throw new ApiError(401, "Refresh token expired or already used");
        }

        // rotate — remove old, issue new
        user.refreshTokens = user.refreshTokens.filter(
            (rt) => rt.token !== incomingRefreshToken
        );
        await user.save({ validateBeforeSave: false });

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user);

        const loggedInUser = await User.findById(user._id).select("-password -refreshTokens");
        const channel = await Channel.findOne({ owner: user._id });

        return res
            .status(200)
            .cookie("accessToken", accessToken, accessCookieOptions)
            .cookie("refreshToken", refreshToken, refreshCookieOptions)
            .json(
                new ApiResponse(200, {
                    user: loggedInUser,
                    channel,
                    accessToken,
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

// ─── GOOGLE OAUTH CALLBACK ───────────────────────────────────────────────────
export const googleCallback = asyncHandler(async (req, res) => {
    const user = req.user;

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user);

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    return res
        .cookie("accessToken", accessToken, accessCookieOptions)
        .cookie("refreshToken", refreshToken, refreshCookieOptions)
        .redirect(`${clientUrl}/?auth=success`);
});