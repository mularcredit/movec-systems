# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Vite bakes env vars at BUILD time — these must be passed as build args.
# Fly.io injects them via [build.args] in fly.toml referencing staged secrets.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

# Stage 2: Prepare Backend
FROM node:20-alpine AS backend-runner
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Move the frontend dist to the location the server expects
RUN mkdir -p /app/frontend && mv /app/frontend-dist /app/frontend/dist

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
