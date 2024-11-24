import { Router, Request, Response, NextFunction } from "express";

const router = Router();

// Middleware autentikasi
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.user) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Profil pengguna
router.get("/", isAuthenticated, (req: Request, res: Response) => {
  const { id, username } = req.session.user!;
  res.json({ id, username });
});

export default router;
