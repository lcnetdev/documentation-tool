FROM node:20-alpine

RUN apk add --no-cache git

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Install client dependencies
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy source (overridden by volumes in dev)
COPY server/ ./server/
COPY client/ ./client/

EXPOSE 4580 5173

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
