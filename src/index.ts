import dotenv from "dotenv";
dotenv.config();
import express, { Express, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import session from "express-session";
import passport from "./config/passport";
import cors from "cors";
import bcrypt from "bcrypt";
import User from "./models/User";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";

declare module "express-session" {
  export interface SessionData {
    user: { id: string; username: string };
  }
}

const app: Express = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173", // Sesuaikan dengan frontend Anda
    credentials: true,
  })
);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 hari
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Swagger documentation
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Validasi environment variables
if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is not defined in environment variables");
}

// Koneksi MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to Laundry App Backend!");
});

// Jalankan server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
