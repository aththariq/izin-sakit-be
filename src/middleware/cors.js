const corsMiddleware = {
  name: "cors",
  register: async function (server) {
    server.ext("onPreResponse", (request, h) => {
      const response = request.response;
      const origin = request.headers.origin;

      // Daftar allowed origins
      const allowedOrigins = [
        "https://www.izinsakit.site",
        "http://localhost:5173",
      ];

      if (response.isBoom || !response.isBoom) {
        const headers = response.output
          ? response.output.headers
          : response.headers;

        // Set origin spesifik
        headers["Access-Control-Allow-Origin"] = allowedOrigins.includes(origin)
          ? origin
          : allowedOrigins[0];
        headers["Access-Control-Allow-Credentials"] = "true";
        headers["Access-Control-Allow-Methods"] =
          "GET, POST, PUT, DELETE, OPTIONS";
        headers["Access-Control-Allow-Headers"] =
          "Accept, Authorization, Content-Type, Origin, X-Requested-With";
        headers["Access-Control-Expose-Headers"] =
          "Content-Length, X-Requested-With";
        headers["Access-Control-Max-Age"] = "86400";
      }

      return h.continue;
    });
  },
};

module.exports = corsMiddleware;
