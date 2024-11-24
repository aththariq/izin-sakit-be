"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const router = (0, express_1.Router)();
// Login dengan Google
router.get("/google", passport_1.default.authenticate("google", { scope: ["profile", "email"] }));
// Callback dari Google
router.get("/google/callback", passport_1.default.authenticate("google", { failureRedirect: "/" }), (req, res) => {
    res.redirect("http://localhost:5173/login?success=true");
});
// Logout
router.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        res.redirect("http://localhost:5173/login");
    });
});
exports.default = router;
//# sourceMappingURL=auth.js.map