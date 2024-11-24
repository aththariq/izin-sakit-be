import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Laundry App API",
    version: "1.0.0",
    description: "API documentation for the Laundry App Backend",
  },
  servers: [
    {
      url: "http://localhost:5001", 
    },
    {
      url: "https://your-backend.up.railway.app", 
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ["./src/routes/*.ts"], 
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
