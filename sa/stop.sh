#!/bin/bash

if docker ps --filter "name=spamassassin-app" --filter "status=running" --format "{{.Names}}" | grep -q "spamassassin-app"; then
  docker stop spamassassin-app
fi