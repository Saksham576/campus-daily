# Campus Daily WhatsApp bridge — always-on server version.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-color-emoji ca-certificates git \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true CHROME_PATH=/usr/bin/chromium DATA_DIR=/data NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY bridge.mjs lib.mjs ./
VOLUME ["/data"]
CMD ["node", "bridge.mjs"]
