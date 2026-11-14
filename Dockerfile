FROM node:26.13.0-bookworm-slim AS build
WORKDIR /app
ENV CI=true
RUN npm install --global pnpm@10.11.0
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./backend/
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./frontend/
RUN pnpm --dir backend install --frozen-lockfile && pnpm --dir frontend install --frozen-lockfile
COPY backend ./backend
COPY frontend ./frontend
RUN pnpm --dir backend build && pnpm --dir frontend build && pnpm --dir backend prune --prod

FROM node:26.13.0-bookworm-slim
WORKDIR /app/backend
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/data/call-calendar.sqlite \
    FRONTEND_DIST=/app/frontend/dist
RUN mkdir /data && chown node:node /data
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/frontend/dist /app/frontend/dist
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "dist/index.js"]
