FROM node:18-alpine

WORKDIR /back

COPY package*.json ./

RUN npm install

RUN apk update && apk upgrade

RUN apk add --no-cache openssl

COPY prisma ./prisma/

COPY . .

EXPOSE 4010

CMD ["npm", "run", "start:prod"]