FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY apps/web-portals/package*.json ./apps/web-portals/
RUN npm install --workspace=apps/web-portals

COPY apps/web-portals ./apps/web-portals
RUN npm run build -w apps/web-portals

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web-portals/dist /usr/share/nginx/html
COPY apps/web-portals/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
