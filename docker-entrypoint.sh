#!/bin/sh
set -e
# Fix data directory ownership — volume může být mountnut jako root
mkdir -p /app/data
chown -R node:node /app/data
# Drop privileges a spusť aplikaci jako node (uid 1000)
exec gosu node "$@"
