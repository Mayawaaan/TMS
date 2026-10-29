FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY apps/api-core/package*.json ./apps/api-core/
RUN npm install --workspace=apps/api-core

COPY apps/api-core ./apps/api-core
RUN npm run build -w apps/api-core

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/api-core/package*.json ./apps/api-core/
RUN npm install --omit=dev --workspace=apps/api-core

COPY --from=builder /app/apps/api-core/dist ./apps/api-core/dist
WORKDIR /app/apps/api-core

EXPOSE 4000
CMD ["node", "dist/server.js"]
