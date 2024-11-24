"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
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
const swaggerSpec = (0, swagger_jsdoc_1.default)(options);
exports.default = swaggerSpec;
//# sourceMappingURL=swagger.js.map