FROM node:20-slim

# Prisma needs OpenSSL to run its query engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (caching layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy Prisma schema and generate client for this platform
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code
COPY . .

EXPOSE 3001

CMD ["npm", "start"]
