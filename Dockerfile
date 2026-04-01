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

# Install backend dependencies first (layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Install Chrome Headless Shell for Remotion rendering
RUN npx remotion browser ensure

# Install frontend dependencies
COPY web/package.json web/pnpm-lock.yaml ./web/
RUN cd web && pnpm install --frozen-lockfile

# Copy full source
COPY . .

# Build frontend
RUN cd web && npx vite build

# Create directories
RUN mkdir -p /output /app/jobs

# Default: CLI mode (backwards compatible)
ENTRYPOINT ["npx", "tsx", "src/index.ts", "--yes", "-o", "/output"]
