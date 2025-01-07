FROM node:18-alpine

# Install system dependencies for pdf2pic
RUN apk add --no-cache imagemagick ghostscript

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

EXPOSE 3000

# Use production environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "src/server.js"]
