FROM node:18-alpine AS builder

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    yarn

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    REPORTS_DIR=/app/reports \
    DOWNLOAD_DIR=/app/downloads

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY *.js package*.json ./

RUN mkdir -p /app/downloads /app/reports && \
    chmod -R 777 /app/downloads /app/reports

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "metabase-pdf-mailer.js"]

VOLUME ["/app/reports"]

LABEL maintainer="Matt Reid" \
      version="1.0" \
      description="Metabase PDF Report Mailer"