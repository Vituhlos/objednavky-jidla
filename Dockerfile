FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

ARG COMMIT_SHA=""
ARG BUILD_TIME=""
ARG GIT_REF=""
ENV COMMIT_SHA=$COMMIT_SHA
ENV BUILD_TIME=$BUILD_TIME
ENV GIT_REF=$GIT_REF

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

VOLUME ["/app/data"]

EXPOSE 3000

CMD ["npm", "run", "start"]
