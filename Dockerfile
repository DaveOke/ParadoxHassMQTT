FROM node:20-alpine

WORKDIR /usr/src/app
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY . ./

RUN npm install --unsafe-perm
# If you are building your code for production
# RUN npm ci --only=production

CMD [ "node", "app.js" ]