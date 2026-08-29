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
# Railway injects PORT; default 8080 matches typical public proxy targetPort.
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "set -e; if [ -z \"$DATABASE_URL\" ]; then echo '[FATAL] DATABASE_URL is empty in container'; exit 1; fi; echo \"[boot] PORT=$PORT HOST=$HOST\"; npx prisma migrate deploy; echo '[boot] migrate_ok'; exec ./node_modules/.bin/tsx server/index.ts"]
