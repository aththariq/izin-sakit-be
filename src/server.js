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
    const server = Hapi.server({
      port: process.env.PORT || 3000,
      host: process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost",
      routes: {
        cors: {
          origin: ["https://www.izinsakit.site", "https://izinsakit.site"],
          headers: [
            "Accept",
            "Authorization",
            "Content-Type",
            "If-None-Match",
            "Accept-language",
          ],
          additionalHeaders: [
            "cache-control",
            "x-requested-with",
            "access-control-allow-origin",
          ],
          exposedHeaders: ["Accept"],
          maxAge: 86400,
          credentials: true,
        },
        routes: {
          payload: {
            maxBytes: 10485760, // 10MB
            timeout: 300000, // 5 menit
          },
        },
      },
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

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});

init();
