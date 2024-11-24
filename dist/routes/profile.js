"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// Middleware autentikasi
const isAuthenticated = (req, res, next) => {
    if (req.session?.user) {
        return next();
    }
    res.status(401).json({ message: "Unauthorized" });
};
// Profil pengguna
router.get("/", isAuthenticated, (req, res) => {
    const { id, username } = req.session.user;
    res.json({ id, username });
});
exports.default = router;
//# sourceMappingURL=profile.js.map