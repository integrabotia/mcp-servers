FROM node:20-alpine

WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar as dependências
RUN npm install

# Copiar arquivos do servidor
COPY . .

# Construir o servidor
RUN npm run build

# Executar o servidor
CMD ["node", "dist/index.js"]

# Expor portas (se necessário)
# EXPOSE 8080

# Definir variáveis de ambiente
ENV NODE_ENV=production 