FROM node:0.10.36


RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN useradd node

COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

# replace this with your application's default port
EXPOSE 8080

USER node
CMD [ "npm", "start" ]
