FROM node:4.3.1

ENV NPM_CONFIG_LOGLEVEL=warn

RUN useradd node
RUN npm install -g nodemon

RUN mkdir -p /home/node /usr/src/app && chown -R node:node /home/node
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

EXPOSE 8080

USER node
CMD [ "npm", "start" ]
