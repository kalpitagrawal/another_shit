import mongoose, { Schema } from "mongoose";

const channelSchema = new Schema(
    {
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        handle: {
            type: String,
            required: [true, "Handle is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^[a-z0-9_]+$/,
                "Handle can only contain lowercase letters, numbers, and underscores",
            ],
        },
        displayName: {
            type: String,
            required: [true, "Display name is required"],
            trim: true,
            maxlength: 50,
        },
        bio: {
            type: String,
            default: "",
            maxlength: 500,
        },
        avatar: {
            type: String,
            default: "",
        },
        banner: {
            type: String,
            default: "",
        },
        subscriberCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        isLive: {
            type: Boolean,
            default: false,
        },
        currentStream: {
            type: Schema.Types.ObjectId,
            ref: "LiveStream",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// fast browse: live channels sorted by popularity
channelSchema.index({ isLive: 1, subscriberCount: -1 });

export const Channel = mongoose.model("Channel", channelSchema);