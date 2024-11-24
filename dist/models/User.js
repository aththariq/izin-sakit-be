"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserSchema = new mongoose_1.Schema({
    googleId: { type: String },
    displayName: { type: String },
    email: { type: String, unique: true }, // Ensure email is unique
    avatar: { type: String },
    username: { type: String, unique: true },
    password: { type: String },
});
exports.default = (0, mongoose_1.model)("User", UserSchema);
//# sourceMappingURL=User.js.map