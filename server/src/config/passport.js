import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/User.model.js";
import { Channel } from "../models/Channel.model.js";

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/v1/auth/google/callback",
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email) return done(new Error("No email returned from Google"), null);

                let user = await User.findOne({
                    $or: [{ googleId: profile.id }, { email }],
                });

                if (user) {
                    // Link googleId if this email existed as a password account
                    if (!user.googleId) {
                        user.googleId = profile.id;
                        user.isVerified = true;
                        await user.save({ validateBeforeSave: false });
                    }
                    return done(null, user);
                }

                // Brand new user — create user + channel
                user = await User.create({ email, googleId: profile.id, isVerified: true });

                const baseHandle = (profile.displayName || email.split("@")[0])
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "_")
                    .slice(0, 20);

                let handle = baseHandle;
                let suffix = 1;
                while (await Channel.findOne({ handle })) {
                    handle = `${baseHandle}_${suffix++}`;
                }

                await Channel.create({
                    owner: user._id,
                    handle,
                    displayName: profile.displayName || handle,
                    avatar: profile.photos?.[0]?.value || "",
                });

                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

export default passport;