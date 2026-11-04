# Imagem oficial do Node.js; sem dependências npm a instalar.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
USER node
EXPOSE 8080
CMD ["node", "server.js"]
