# Use lightweight Node.js 20 Alpine base
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source files
COPY . .

EXPOSE 4000

CMD ["node", "server.js"]
