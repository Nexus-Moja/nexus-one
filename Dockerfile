FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S nexus && adduser -S nexus -G nexus
COPY --from=build /app/package*.json ./
COPY --from=build /app/server.mjs ./
COPY --from=build /app/src/server ./src/server
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data && chown -R nexus:nexus /app
USER nexus
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:4173/api/health || exit 1
CMD ["node", "server.mjs"]
