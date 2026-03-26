FROM node:20-slim

# Playwright needs these system dependencies
RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

# Install Playwright Chromium
RUN npx playwright install chromium

COPY . .

# Render sets PORT env var
ENV PORT=10000
ENV NODE_ENV=production
ENV DASHBOARD_PORT=10000

EXPOSE 10000

CMD ["node", "src/index.js"]
