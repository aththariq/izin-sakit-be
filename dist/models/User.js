"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserSchema = new mongoose_1.Schema({
    googleId: { type: String, required: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true },
    avatar: { type: String },
});
exports.default = (0, mongoose_1.model)("User", UserSchema);
//# sourceMappingURL=User.js.map