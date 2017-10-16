FROM node:6
LABEL maintainer="Laura Santamaria <laura.santamaria@rackspace.com>"

ENV NPM_CONFIG_LOGLEVEL=warn

RUN useradd nodeusr
RUN npm install -g nodemon

RUN mkdir -p /home/node /usr/src/app && chown -R node:node /home/node
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

EXPOSE 8080

USER nodeusr
CMD [ "npm", "start" ]
