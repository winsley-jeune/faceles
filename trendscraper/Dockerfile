FROM node:24-slim

RUN apt-get update && apt-get install -y \
    ffmpeg fontconfig sed wget ca-certificates \
    libnss3 libatk-bridge2.0-0 libgtk-3-0 libxss1 \
    libasound2 libgbm-dev libatk1.0-0 libpangocairo-1.0-0 \
    libatspi2.0-0 libdrm2 libxdamage1 libxrandr2 x11-utils \
    xvfb xauth \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY src/package.json ./
RUN npm install

# Install Playwright browsers for auto-posting
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

COPY src/ /app/

EXPOSE 3000

# Use xvfb-run for headed browser mode (required for YouTube Studio)
CMD xvfb-run --auto-servernum --server-args="-screen 0 1280x800x24" node index.js
