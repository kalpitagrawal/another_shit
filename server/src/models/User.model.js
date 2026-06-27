import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new Schema(
    {
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        password: {
            type: String,
            minlength: [6, "Password must be at least 6 characters"],
            // Not required for Google OAuth users
        },
        googleId: {
            type: String,
            sparse: true,
            unique: true,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        refreshTokens: [
            {
                token: String,
                device: { type: String, default: "web" },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Hash password before saving
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    if (!this.password) return;
    this.password = await bcrypt.hash(this.password, 12);
});

// Instance method to check password
userSchema.methods.isPasswordCorrect = async function (password) {
    if (!this.password) return false;
    return await bcrypt.compare(password, this.password);
};

export const User = mongoose.model("User", userSchema);
