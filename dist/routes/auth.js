"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const router = (0, express_1.Router)();
/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Login with Google
 *     description: Initiates login with Google OAuth.
 *     responses:
 *       302:
 *         description: Redirects to Google OAuth login page.
 */
router.get("/google", passport_1.default.authenticate("google", { scope: ["profile", "email"] }));
/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     description: Handles Google OAuth callback and redirects to the frontend.
 *     responses:
 *       302:
 *         description: Redirects to the dashboard on success, or login page on failure.
 */
router.get("/google/callback", passport_1.default.authenticate("google", {
    failureRedirect: "http://localhost:5173/login",
}), (req, res) => {
    // Redirect to dashboard on successful authentication
    res.redirect("http://localhost:5173/dashboard");
});
/**
 * @swagger
 * /auth/current_user:
 *   get:
 *     summary: Check current logged-in user
 *     description: Returns the currently logged-in user's information.
 *     responses:
 *       200:
 *         description: User information if logged in.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "12345"
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *       401:
 *         description: Not logged in.
 */
router.get("/current_user", (req, res) => {
    if (req.user) {
        res.json({ user: req.user });
    }
    else {
        res.status(401).json({ error: "Not logged in" });
    }
});
/**
 * @swagger
 * /auth/logout:
 *   get:
 *     summary: Logout user
 *     description: Logs out the current user and redirects to the login page.
 *     responses:
 *       302:
 *         description: Redirects to login page.
 *       500:
 *         description: Error during logout.
 */
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