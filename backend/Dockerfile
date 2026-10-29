FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app

COPY package*.json ./
# Se recomienda subir package-lock.json. npm ci exige que esté sincronizado.
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && npm cache clean --force

COPY . .
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 3001

# Requiere en backend/package.json: "start": "node <entrada-real>.js"
CMD ["npm", "start"]
