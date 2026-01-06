FROM oven/bun:1-alpine

# Install yt-dlp and ffmpeg
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    && pip3 install --break-system-packages --no-cache-dir yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application files
COPY . .

# Sync SvelteKit (generates .svelte-kit folder)
RUN bun run prepare

# Build the SvelteKit app
RUN bun run build

# Create necessary directories
RUN mkdir -p temp uploads

# Define volumes for persistent data
VOLUME ["/app/uploads", "/app/temp"]

# Expose port
EXPOSE 3000

# Set environment variable for yt-dlp binary
ENV YTDLP_BINARY=/usr/bin/yt-dlp

# Set environment variable for ffmpeg binary
ENV FFMPEG_PATH=/usr/bin/ffmpeg

# Start the application
CMD ["bun", "run", "build/index.js"]
