FROM mhart/alpine-node

WORKDIR /app
COPY . .

RUN npm install --prod

EXPOSE 4001
CMD ["node", "app.js"]