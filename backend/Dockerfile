# Multi-stage build for Node.js backend
# Stage 1: Dependencies
FROM node:20-alpine AS dependencies
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# Stage 2: Prisma preparation
FROM dependencies AS prisma-builder
WORKDIR /app
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm exec prisma generate

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm

# Copy user context (non-root)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from builder
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application
COPY --chown=nodejs:nodejs package.json pnpm-lock.yaml ./
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs prisma ./prisma
COPY --chown=nodejs:nodejs prisma.config.ts ./

# Ensure runtime-writable upload folders exist for non-root user
RUN mkdir -p /app/uploads/fotos && chown -R nodejs:nodejs /app/uploads

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 4000

CMD ["node", "src/server.js"]
