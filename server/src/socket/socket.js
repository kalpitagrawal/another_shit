import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";
import { Channel } from "../models/Channel.model.js";
// import { ChatMessage } from "../models/ChatMessage.model.js";
// import { LiveStream } from "../models/LiveStream.model.js";
import { redis } from "../config/redis.js";
import { Subscription } from "../models/Subscription.model.js";

let io = null;

/**
 * Initialize Socket.io with JWT authentication.
 */
export const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:5173",
            credentials: true,
        },
    });

    // Store io instance on app
    server._app?.set?.("io", io);

    // ─── JWT Authentication Middleware ─────────────────────────────────
    io.use(async (socket, next) => {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace("Bearer ", "");

        if (!token) {
            // Allow anonymous viewers (read-only)
            socket.user = null;
            socket.channel = null;
            return next();
        }

        try {
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            const user = await User.findById(decoded._id).select("-password -refreshTokens");
            if (!user) {
                return next(new Error("User not found"));
            }

            const channel = await Channel.findOne({ owner: user._id });

            socket.user = user;
            socket.channel = channel;
            next();
        } catch (error) {
            // Allow connection but mark as unauthenticated
            socket.user = null;
            socket.channel = null;
            next();
        }
    });

    // ─── Connection Handler ────────────────────────────────────────────
    io.on("connection", (socket) => {
        console.log(
            `🔌 Socket connected: ${socket.id} (user: ${socket.user?.email || "anonymous"})`
        );

        // ─── JOIN STREAM ROOM ────────────────────────────────────────────
        socket.on("chat:join", async ({ streamId }) => {
            if (!streamId) return;

            const room = `stream:${streamId}`;
            socket.join(room);

            // Increment viewer count in Redis
            if (redis) {
                try {
                    const count = await redis.incr(`viewer:${streamId}`);
                    io.to(room).emit("stream:viewerCount", { count });

                    // Update sorted set for browse page
                    await redis.zadd("live:streams", count, streamId);
                } catch (err) {
                    console.error("Redis viewer count error:", err.message);
                }
            }

            // If streamer, join studio room
            if (socket.channel) {
                const stream = await LiveStream.findById(streamId);
                if (
                    stream &&
                    stream.channel.toString() === socket.channel._id.toString()
                ) {
                    socket.join(`studio:${streamId}`);
                }
            }
        });

        // ─── LEAVE STREAM ROOM ───────────────────────────────────────────
        socket.on("chat:leave", async ({ streamId }) => {
            if (!streamId) return;

            const room = `stream:${streamId}`;
            socket.leave(room);
            socket.leave(`studio:${streamId}`);

            // Decrement viewer count
            if (redis) {
                try {
                    const count = await redis.decr(`viewer:${streamId}`);
                    const safeCount = Math.max(0, count);
                    if (count < 0) await redis.set(`viewer:${streamId}`, 0);
                    io.to(room).emit("stream:viewerCount", { count: safeCount });

                    await redis.zadd("live:streams", safeCount, streamId);
                } catch (err) {
                    console.error("Redis viewer count error:", err.message);
                }
            }
        });

        // ─── SEND CHAT MESSAGE ───────────────────────────────────────────
        socket.on("chat:send", async ({ streamId, body }) => {
            if (!socket.user || !socket.channel) {
                socket.emit("error", { message: "You must be logged in to chat" });
                return;
            }

            if (!body || body.trim().length === 0) return;

            const stream = await LiveStream.findById(streamId);
            if (!stream || stream.status !== "live") return;

            // Check if chat is enabled
            if (!stream.chatEnabled) {
                socket.emit("error", { message: "Chat is disabled" });
                return;
            }

            // Check if user is banned
            if (redis) {
                const isBanned = await redis.get(
                    `chat:ban:${streamId}:${socket.user._id}`
                );
                if (isBanned) {
                    socket.emit("error", { message: "You are banned from this chat" });
                    return;
                }
            }

            // Check slow mode
            if (stream.slowModeSeconds > 0 && redis) {
                const lastMsg = await redis.get(
                    `rate:chat:${socket.user._id}:${streamId}`
                );
                if (lastMsg) {
                    socket.emit("error", {
                        message: `Slow mode: wait ${stream.slowModeSeconds}s between messages`,
                    });
                    return;
                }
                await redis.setex(
                    `rate:chat:${socket.user._id}:${streamId}`,
                    stream.slowModeSeconds,
                    "1"
                );
            }

            // Check members-only
            if (stream.membersOnlyChat) {
                const channel = await Channel.findById(stream.channel);
                const isOwner = channel?.owner.toString() === socket.user._id.toString();
                if (!isOwner) {
                    const isSubscribed = await Subscription.exists({
                        subscriber: socket.user._id,
                        channel: stream.channel,
                    });
                    if (!isSubscribed) {
                        socket.emit("error", {
                            message: "Members-only chat: you must be subscribed",
                        });
                        return;
                    }
                }
            }

            // Save message to DB
            const message = await ChatMessage.create({
                stream: streamId,
                sender: socket.channel._id,
                body: body.trim(),
                type: "message",
            });

            // Broadcast to room
            io.to(`stream:${streamId}`).emit("chat:message", {
                id: message._id,
                sender: {
                    _id: socket.channel._id,
                    handle: socket.channel.handle,
                    displayName: socket.channel.displayName,
                    avatar: socket.channel.avatar,
                },
                body: message.body,
                type: "message",
                timestamp: message.createdAt.toISOString(),
            });
        });

        // ─── MOD: BAN USER ───────────────────────────────────────────────
        socket.on("mod:ban", async ({ streamId, targetChannelId }) => {
            if (!socket.channel) return;

            const stream = await LiveStream.findById(streamId);
            if (!stream) return;

            const channel = await Channel.findById(stream.channel);
            if (
                !channel ||
                channel.owner.toString() !== socket.user._id.toString()
            ) {
                socket.emit("error", { message: "Only the streamer can ban users" });
                return;
            }

            // Set permanent ban in Redis (no TTL)
            if (redis) {
                await redis.set(`chat:ban:${streamId}:${targetChannelId}`, "1");
            }

            io.to(`stream:${streamId}`).emit("chat:userBanned", {
                channelId: targetChannelId,
            });
        });

        // ─── MOD: TIMEOUT USER ──────────────────────────────────────────
        socket.on("mod:timeout", async ({ streamId, targetChannelId, seconds }) => {
            if (!socket.channel) return;

            const stream = await LiveStream.findById(streamId);
            if (!stream) return;

            const channel = await Channel.findById(stream.channel);
            if (
                !channel ||
                channel.owner.toString() !== socket.user._id.toString()
            ) {
                return;
            }

            if (redis) {
                await redis.setex(
                    `chat:ban:${streamId}:${targetChannelId}`,
                    seconds || 300,
                    "1"
                );
            }

            io.to(`stream:${streamId}`).emit("chat:userBanned", {
                channelId: targetChannelId,
                duration: seconds,
            });
        });

        // ─── MOD: PIN MESSAGE ────────────────────────────────────────────
        socket.on("mod:pin", async ({ streamId, messageId }) => {
            if (!socket.channel) return;

            const stream = await LiveStream.findById(streamId);
            if (!stream) return;

            const channel = await Channel.findById(stream.channel);
            if (
                !channel ||
                channel.owner.toString() !== socket.user._id.toString()
            ) {
                return;
            }

            // Unpin previous
            if (stream.pinnedMessage) {
                await ChatMessage.findByIdAndUpdate(stream.pinnedMessage, {
                    isPinned: false,
                });
            }

            // Pin new message
            const message = await ChatMessage.findByIdAndUpdate(
                messageId,
                { isPinned: true },
                { new: true }
            ).populate("sender", "handle displayName avatar");

            stream.pinnedMessage = messageId;
            await stream.save();

            io.to(`stream:${streamId}`).emit("chat:pinned", {
                message: message
                    ? {
                        id: message._id,
                        sender: message.sender,
                        body: message.body,
                        timestamp: message.createdAt.toISOString(),
                    }
                    : null,
            });
        });

        // ─── MOD: SLOW MODE ─────────────────────────────────────────────
        socket.on("mod:slowMode", async ({ streamId, seconds }) => {
            if (!socket.channel) return;

            const stream = await LiveStream.findById(streamId);
            if (!stream) return;

            const channel = await Channel.findById(stream.channel);
            if (
                !channel ||
                channel.owner.toString() !== socket.user._id.toString()
            ) {
                return;
            }

            stream.slowModeSeconds = seconds;
            await stream.save();

            io.to(`stream:${streamId}`).emit("chat:slowMode", { seconds });
        });

        // ─── MOD: MEMBERS ONLY ──────────────────────────────────────────
        socket.on("mod:membersOnly", async ({ streamId, enabled }) => {
            if (!socket.channel) return;

            const stream = await LiveStream.findById(streamId);
            if (!stream) return;

            const channel = await Channel.findById(stream.channel);
            if (
                !channel ||
                channel.owner.toString() !== socket.user._id.toString()
            ) {
                return;
            }

            stream.membersOnlyChat = enabled;
            await stream.save();

            io.to(`stream:${streamId}`).emit("chat:membersOnly", { enabled });
        });

        // ─── DISCONNECTING — rooms still available ────────────────────
        socket.on("disconnecting", async () => {
            for (const room of socket.rooms) {
                if (room.startsWith("stream:")) {
                    const streamId = room.replace("stream:", "");
                    if (redis) {
                        try {
                            const count = await redis.decr(`viewer:${streamId}`);
                            const safeCount = Math.max(0, count);
                            if (count < 0) await redis.set(`viewer:${streamId}`, 0);
                            io.to(room).emit("stream:viewerCount", { count: safeCount });
                        } catch {
                            // silently handle
                        }
                    }
                }
            }
        });

        socket.on("disconnect", () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });

    // ─── Periodic viewer count sync to DB ──────────────────────────────
    setInterval(async () => {
        if (!redis) return;
        try {
            const liveStreams = await LiveStream.find({ status: "live" }).select("_id peakViewers");
            for (const stream of liveStreams) {
                const count = parseInt(await redis.get(`viewer:${stream._id}`)) || 0;
                const update = { viewerCount: count };
                if (count > stream.peakViewers) {
                    update.peakViewers = count;
                }
                await LiveStream.findByIdAndUpdate(stream._id, update);
            }
        } catch (err) {
            // Silently handle periodic sync errors
        }
    }, 30000); // Every 30 seconds

    console.log("✅ Socket.io initialized");
    return io;
};

export const getIO = () => io;
