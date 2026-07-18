# Use lightweight Node.js 20 Alpine base
FROM node:20-alpine

WORKDIR /app

# Install dependencies for local development
COPY package.json package-lock.json ./
RUN npm ci

# Copy the application source files
COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]
