"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// Middleware autentikasi
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).send("Unauthorized");
};
// Profil pengguna
router.get("/", isAuthenticated, (req, res) => {
    res.json(req.user);
});
exports.default = router;
//# sourceMappingURL=profile.js.map