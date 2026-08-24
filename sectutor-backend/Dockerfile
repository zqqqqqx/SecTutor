# SecTutor 后端服务镜像
FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY config.js ./
COPY src ./src
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget --quiet --spider http://localhost:8787/health || exit 1
CMD ["node", "src/index.js"]
