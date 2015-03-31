FROM node:0.12.1

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN useradd node

COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

EXPOSE 8080

USER node
CMD [ "npm", "start" ]
