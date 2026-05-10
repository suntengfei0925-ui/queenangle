ARG NODE_IMAGE=node:20-bookworm-slim
FROM ${NODE_IMAGE}

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY web ./web

ENV HOST=0.0.0.0
ENV PORT=3000
ENV DB_PATH=/data/db/queenangle.sqlite
ENV UPLOAD_DIR=/data/uploads

EXPOSE 3000
CMD ["node", "server/index.js"]
