# Use lightweight Node.js 20 Alpine base
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy frontend source code
COPY . .

EXPOSE 3000

ENV HOST=0.0.0.0
CMD ["npm", "run", "dev"]
