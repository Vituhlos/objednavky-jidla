FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

VOLUME ["/app/data"]

EXPOSE 3000

CMD ["npm", "run", "start"]
