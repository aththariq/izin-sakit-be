FROM node:18-alpine

# Install semua dependencies yang diperlukan
RUN apk add --no-cache \
    graphicsmagick \
    imagemagick \
    ghostscript \
    imagemagick-dev \
    ghostscript-fonts \
    msttcorefonts-installer \
    fontconfig \
    && update-ms-fonts \
    && fc-cache -f

# Konfigurasi ImageMagick policy
RUN mkdir -p /etc/ImageMagick-7 \
    && echo '<policymap> \
    <policy domain="coder" rights="read|write" pattern="PDF" /> \
    <policy domain="coder" rights="read|write" pattern="LABEL" /> \
    </policymap>' > /etc/ImageMagick-7/policy.xml

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
