# ForenzDetectiv API — production image (Railway / Render / Fly.io)
# wire-up-marker: 2026-08-29-prisma-config-v4-cachebust
FROM node:22-alpine

RUN apk add --no-cache openssl \
  && echo "forenzdetectiv-cachebust-v4"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY server ./server
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json tsconfig.node.json ./
COPY prisma.config.ts ./

RUN npx prisma generate

RUN mkdir -p uploads

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 5176

CMD ["sh", "-c", "if [ -z \"$DATABASE_URL\" ]; then echo '[FATAL] DATABASE_URL is empty in container'; env | grep -E '^(PG|DATABASE|RAILWAY)' | sed 's/=.*/=***/'; exit 1; fi; npx prisma migrate deploy && npx tsx server/index.ts"]
