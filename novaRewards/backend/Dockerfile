# ── Stage 1: builder ──────────────────────────────────────────────────────────
# Installs ALL dependencies (including devDependencies) so tests/lint can run
# during CI if needed. The compiled output is just the JS source as-is.
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
# Install all deps (dev included) so the image can be used for CI too
RUN npm install --frozen-lockfile

COPY . .

# ── Stage 2: runner ───────────────────────────────────────────────────────────
# Minimal production image — only production deps + source files
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Copy package manifest and install production deps only
COPY package.json ./
RUN npm install --omit=dev --frozen-lockfile

# Copy application source from builder (no node_modules, no test files)
COPY --from=builder /app/server.js ./
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/db ./db
COPY --from=builder /app/middleware ./middleware

EXPOSE 3000

CMD ["node", "server.js"]
