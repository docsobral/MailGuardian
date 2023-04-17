#!/bin/bash

if docker ps --filter "name=spamassassin-app" --filter "status=running" --format "{{.Names}}" | grep -q "spamassassin-app"; then
  echo "Stopping spamassassin-app..."
  docker stop spamassassin-app
fi