FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

ARG APP_VERSION=""
ARG COMMIT_SHA=""
ARG BUILD_DATE=""
ARG RELEASE_CHANNEL="stable"
ARG GIT_REF=""
ARG DOCKER_TAG=""

ENV APP_VERSION=$APP_VERSION
ENV COMMIT_SHA=$COMMIT_SHA
ENV BUILD_DATE=$BUILD_DATE
ENV RELEASE_CHANNEL=$RELEASE_CHANNEL
ENV GIT_REF=$GIT_REF
ENV DOCKER_TAG=$DOCKER_TAG

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

VOLUME ["/app/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
