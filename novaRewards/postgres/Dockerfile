FROM postgres:16-alpine

RUN apk add --no-cache openssl

COPY archive-wal.sh /usr/local/bin/archive-wal.sh

RUN chmod +x /usr/local/bin/archive-wal.sh
