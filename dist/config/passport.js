"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const User_1 = __importDefault(require("../models/User"));
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET);
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5001/auth/google/callback", // Updated to fully qualified URL
}, async (_, refreshToken, profile, done) => {
    try {
        let user = await User_1.default.findOne({ googleId: profile.id });
        if (!user) {
            user = await User_1.default.create({
                googleId: profile.id,
                displayName: profile.displayName,
                email: profile.emails?.[0].value,
                avatar: profile.photos?.[0].value,
            });
        }
        done(null, user);
    }
    catch (err) {
        done(err, null);
    }
}));
// Serialize & Deserialize user
passport_1.default.serializeUser((user, done) => done(null, user.id));
passport_1.default.deserializeUser(async (id, done) => {
    try {
        const user = await User_1.default.findById(id);
        done(null, user);
    }
    catch (err) {
        done(err, null);
    }
});
exports.default = passport_1.default;
//# sourceMappingURL=passport.js.map