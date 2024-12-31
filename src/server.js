require("dotenv").config();
const Hapi = require("@hapi/hapi");
const mongoose = require("mongoose");
const routes = require("./routes");

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3000,
    host: process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost",
    routes: {
      cors: {
        origin: ["*"],
        headers: ["Accept", "Authorization", "Content-Type", "If-None-Match"],
      },
    },
  });

  // Connect to MongoDB
  mongoose
    .connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((err) => {
      console.error("Failed to connect to MongoDB", err);
    });

  server.route(routes);

  // Tambahkan logging untuk melihat semua route yang terdaftar
  server.table().forEach(route => {
    console.log(`${route.method}\t${route.path}`);
  });

  await server.start();
  console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", (err) => {
  console.log(err);
  process.exit(1);
});

init();
