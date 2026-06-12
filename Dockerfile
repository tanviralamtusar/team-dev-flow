# Build stage
FROM node:20-alpine AS build
# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++
WORKDIR /usr/src/app
COPY package.json package-lock.json tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server ./server
COPY assets ./assets
RUN npm ci
RUN npm run build

# Production stage
FROM node:20-alpine AS runtime
# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /usr/src/app
ENV NODE_ENV=production
# Default port for the container
ENV PORT=4000

COPY package.json package-lock.json tsconfig.json ./
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/server ./server
COPY --from=build /usr/src/app/src ./src
# Create empty directories — actual data lives in Docker volumes, not the image
RUN mkdir -p data uploads
RUN npm ci --production

EXPOSE 4000
CMD ["npx", "tsx", "server/index.ts"]
