FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY app.js ./
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=2s --retries=5 CMD wget --quiet --spider http://localhost:3000/ || exit 1
CMD ["node", "app.js"]
