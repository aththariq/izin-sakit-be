//src.server.js
const dotenv = require("dotenv");
const Hapi = require("@hapi/hapi");
const Inert = require("@hapi/inert");
const Vision = require("@hapi/vision");
const HapiSwagger = require("hapi-swagger");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const routes = require("./routes");
const Pack = require("../package.json");
const corsMiddleware = require("./middleware/cors");

// Load environment variables based on NODE_ENV
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
    // Aktifkan mode debugging Mongoose
    mongoose.set('debug', process.env.NODE_ENV !== "production");

    // Add check for existing server
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
        payload: {
          maxBytes: 50 * 1024 * 1024, // 50MB
          timeout: 900000, // 15 menit
          output: "data", // Ubah dari 'stream' ke 'data' jika perlu
          parse: true,      // Pastikan parsing aktif
          failAction: async (request, h, err) => {
            console.error("Payload validation error:", err.message);
            throw Boom.badRequest(`Invalid request payload input: ${err.message}`);
          },
        },
        timeout: {
          server: 900000, // 15 menit
          socket: 920000, // 15 menit + 20 detik
        },
      },
      debug: process.env.NODE_ENV !== "production" ? { request: ['error'] } : false, // Tambahkan baris ini
    });

    const swaggerOptions = {
      info: {
        title: "Izin Sakit API Documentation",
        version: Pack.version,
        description: "Documentation for the Izin Sakit REST API",
      },
      securityDefinitions: {
        jwt: {
          type: "apiKey",
          name: "Authorization",
          in: "header",
          description: "Use format: Bearer <token>",
        },
      },
      security: [{ jwt: [] }],
      documentationPath: "/documentation",
      swaggerUI: true,
      jsonPath: "/swagger.json",
      sortEndpoints: "ordered",
    };

    await server.register([
      Inert,
      Vision,
      {
        plugin: HapiSwagger,
        options: swaggerOptions,
      },
      corsMiddleware, // Add this line
    ]);

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    // Register routes
    server.route(routes);

    // Log registered routes
    if (process.env.NODE_ENV !== "production") {
      console.log("\nRegistered Routes:");
      server.table().forEach((route) => {
        console.log(`${route.method}\t${route.path}`);
      });
    }

    await server.start();
    console.log(`Server running on ${server.info.uri}`);
    if (process.env.NODE_ENV !== "production") {
      console.log("Documentation available at: /documentation");
    }
  } catch (err) {
    console.error("Server initialization error:", err);
    process.exit(1);
  }
};

// Add utility function to check if port is in use
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
