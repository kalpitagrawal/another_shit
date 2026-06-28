import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: { type: Schema.Types.ObjectId, ref: "User" },
    channel: { type: Schema.Types.ObjectId, ref: "Channel" },
}, { timestamps: true });

// compound unique index — ek user ek channel ko ek baar hi subscribe kare
subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);