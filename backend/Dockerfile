FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

COPY package*.json tsconfig.json ./
RUN npm ci

COPY knexfile.ts ./
COPY src ./src

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY knexfile.ts ./
COPY --from=builder /app/dist ./dist
COPY src/db/migrations ./src/db/migrations
COPY src/db/seeds ./src/db/seeds

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/outreachflow.db

EXPOSE 3000

CMD ["sh", "-c", "npx knex migrate:latest --knexfile knexfile.ts && node dist/index.js"]
