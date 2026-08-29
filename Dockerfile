# ForenzDetectiv API — production image (Railway / Render / Fly.io)
FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY server ./server
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json tsconfig.node.json ./
COPY prisma.config.ts ./
COPY railway.toml railway.json ./

RUN npx prisma generate

RUN mkdir -p uploads

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 5176

# Migrations + API (Postgres/Redis via env at runtime)
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx server/index.ts"]
