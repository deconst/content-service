FROM node:0.10.36

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

# replace this with your application's default port
EXPOSE 8080 

CMD [ "npm", "start" ]
