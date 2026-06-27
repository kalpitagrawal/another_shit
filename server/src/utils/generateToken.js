import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

/**
 * Generate access and refresh tokens for a user.
 * Stores the refresh token in the user's refreshTokens array.
 */
const generateAccessAndRefreshTokens = async (user) => {
    const accessToken = jwt.sign(
        {
            _id: user._id,
            email: user.email,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
        }
    );

    const refreshToken = jwt.sign(
        {
            _id: user._id,
            tokenId: uuidv4(),
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
        }
    );

    // Store refresh token in user document
    user.refreshTokens.push({
        token: refreshToken,
        device: "web",
        createdAt: new Date(),
    });

    // Keep only the last 5 refresh tokens per user
    if (user.refreshTokens.length > 5) {
        user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
};

export { generateAccessAndRefreshTokens };
