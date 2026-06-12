# Build stage
FROM node:20-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /usr/src/app
COPY package.json package-lock.json tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server ./server
RUN npm ci
RUN npm run build

# Production stage
FROM node:20-alpine AS runtime
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PORT=4000

# Copy built frontend, server source, and pre-compiled node_modules from build stage
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/server ./server
COPY --from=build /usr/src/app/src ./src
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/tsconfig.json ./tsconfig.json

# Data and uploads live in Docker volumes — just create the empty dirs
RUN mkdir -p data uploads

EXPOSE 4000
CMD ["npx", "tsx", "server/index.ts"]
