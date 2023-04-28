#!/bin/bash

if docker ps -a --format "{{.Names}}" | grep -q "spamassassin-app"; then
  docker start spamassassin-app
else
  docker-compose -f ./sa/compose.yml up -d
fi