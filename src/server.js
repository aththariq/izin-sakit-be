require("dotenv").config();
const Hapi = require("@hapi/hapi");
const Inert = require("@hapi/inert");
const mongoose = require("mongoose");
const path = require('path');
const fs = require('fs');
const routes = require("./routes");

const init = async () => {
  try {
    const server = Hapi.server({
      port: process.env.PORT || 3000,
      host: process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost",
      routes: {
        cors: {
          origin: ["*"],
          headers: ["Accept", "Authorization", "Content-Type", "If-None-Match"],
          credentials: true
        },
        files: {
          relativeTo: path.join(__dirname, '../')
        }
      },
    });

    // Register inert plugin
    await server.register(Inert);

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)){
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Register routes
    server.route(routes);

    // Log registered routes
    console.log("\nRegistered Routes:");
    server.table().forEach(route => {
      console.log(`${route.method}\t${route.path}`);
    });

    await server.start();
    console.log(`Server running on ${server.info.uri}`);
  } catch (err) {
    console.error("Server initialization error:", err);
    process.exit(1);
  }
};

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});

init();
