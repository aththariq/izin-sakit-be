const corsMiddleware = {
  name: 'cors',
  register: async function (server) {
    server.ext('onPreResponse', (request, h) => {
      const response = request.response;
      if (response.isBoom) {
        response.output.headers['Access-Control-Allow-Origin'] = '*';
        response.output.headers['Access-Control-Allow-Credentials'] = 'true';
        response.output.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        response.output.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, X-Requested-With';
      }
      return h.continue;
    });
  }
};

module.exports = corsMiddleware;
