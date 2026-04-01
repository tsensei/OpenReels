FROM node:22-bookworm-slim

# Install system dependencies: ffmpeg (includes ffprobe) and Chrome Headless Shell shared libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libcups2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable pnpm

# Install dependencies first (layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Install Chrome Headless Shell for Remotion rendering
RUN npx remotion browser ensure

# Copy full source (needed for tsx runtime and Remotion webpack bundling)
COPY . .

# Create output directory
RUN mkdir -p /output

ENTRYPOINT ["npx", "tsx", "src/index.ts", "--yes", "-o", "/output"]
