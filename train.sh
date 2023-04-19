#!/bin/bash

# Get training files
docker cp node_modules/@stdlib/datasets-spam-assassin/data/easy-ham-1 spamassassin-app:data/easy-ham-1
docker cp node_modules/@stdlib/datasets-spam-assassin/data/easy-ham-2 spamassassin-app:data/easy-ham-2
docker cp node_modules/@stdlib/datasets-spam-assassin/data/hard-ham-1 spamassassin-app:data/hard-ham-1
docker cp node_modules/@stdlib/datasets-spam-assassin/data/spam-1 spamassassin-app:data/spam-1
docker cp node_modules/@stdlib/datasets-spam-assassin/data/spam-2 spamassassin-app:data/spam-2

# Run training
docker exec spamassassin-app sa-learn --ham data/easy-ham-1 data/easy-ham-2 data/hard-ham-1 --spam data/spam-1 data/spam-2

# Delete training files
docker exec --user root spamassassin-app rm -rf data/easy-ham-1 data/easy-ham-2 data/hard-ham-1 data/spam-1 data/spam-2
