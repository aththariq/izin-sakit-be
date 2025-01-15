//src.server.js
const dotenv = require("dotenv");
const Hapi = require("@hapi/hapi");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const routes = require("./routes");
const Inert = require("@hapi/inert");

dotenv.config({
  path: path.resolve(
    __dirname,
    process.env.NODE_ENV === "production"
      ? ".env.production"
      : ".env.development"
  ),
});

const init = async () => {
  try {
    const existingServer = await checkPortInUse(process.env.PORT || 3000);
    if (existingServer) {
      console.log("Server is already running on port 3000");
      process.exit(1);
    }

    const server = Hapi.server({
      port: process.env.PORT || 3000,
      host: process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost",
      routes: {
        cors: {
          origin: [
            "https://www.izinsakit.site",
            "http://www.izinsakit.site",
            "https://izinsakit.site",
            "http://izinsakit.site",
            "https://izin-sakit.vercel.app",
            "http://localhost:5173",
          ],
          credentials: true,
          headers: ["Accept", "Content-Type", "Authorization"],
          additionalHeaders: ["X-Requested-With"],
        },
      },
    });

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    await server.register(Inert);

    server.route(routes);

    if (process.env.NODE_ENV !== "production") {
      console.log("\nRegistered Routes:");
      server.table().forEach((route) => {
        console.log(`${route.method}\t${route.path}`);
      });
    }

    await server.start();
    console.log(`Server running on ${server.info.uri}`);
  } catch (err) {
    console.error("Server initialization error:", err);
    process.exit(1);
  }
};

const checkPortInUse = (port) => {
  return new Promise((resolve) => {
    const net = require("net");
    const tester = net
      .createServer()
      .once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          resolve(true);
        }
      })
      .once("listening", () => {
        tester.once("close", () => resolve(false)).close();
      })
      .listen(port);
  });
};

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});

init();

