# Get training files
printf '\n%s' '  Copying training files to container...'
docker cp node_modules/@stdlib/datasets-spam-assassin/data/easy-ham-1 spamassassin-app:data/easy-ham-1
docker cp node_modules/@stdlib/datasets-spam-assassin/data/easy-ham-2 spamassassin-app:data/easy-ham-2
docker cp node_modules/@stdlib/datasets-spam-assassin/data/hard-ham-1 spamassassin-app:data/hard-ham-1

docker cp node_modules/@stdlib/datasets-spam-assassin/data/spam-1 spamassassin-app:data/spam-1
docker cp node_modules/@stdlib/datasets-spam-assassin/data/spam-2 spamassassin-app:data/spam-2
printf '\n%s' '  Done!'

# Run training
printf '\n\n%s\n  ' '  Training ham...'
docker exec spamassassin-app sa-learn --ham data/easy-ham-1 data/easy-ham-2 data/hard-ham-1

printf '\n\n%s\n  ' '  Training spam...'
docker exec spamassassin-app sa-learn --spam data/spam-1 data/spam-2

# Delete training files
printf '\n\n%s' '  Deleting training files...'
docker exec --user root spamassassin-app rm -rf data/easy-ham-1 data/easy-ham-2 data/hard-ham-1 data/spam-1 data/spam-2
printf '\n%s' '  Done!'
