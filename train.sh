# Get training files
echo ''
echo '  Copying training files to container...'
docker cp node_modules/@stdlib/datasets-spam-assassin/data/easy-ham-1 spamassassin-app:data/easy-ham-1
docker cp node_modules/@stdlib/datasets-spam-assassin/data/easy-ham-2 spamassassin-app:data/easy-ham-2
docker cp node_modules/@stdlib/datasets-spam-assassin/data/hard-ham-1 spamassassin-app:data/hard-ham-1
docker cp node_modules/@stdlib/datasets-spam-assassin/data/spam-1 spamassassin-app:data/spam-1
docker cp node_modules/@stdlib/datasets-spam-assassin/data/spam-2 spamassassin-app:data/spam-2
echo '  Done!'

# Run training
echo ''
echo '  Training ham...'
docker exec spamassassin-app sa-learn --ham data/easy-ham-1 data/easy-ham-2 data/hard-ham-1
echo 'Done!'
echo ''
echo '  Training spam...'
docker exec spamassassin-app sa-learn --spam data/spam-1 data/spam-2
echo 'Done!'s

# Delete training files
echo ''
echo '  Deleting training files...'
docker exec --user root spamassassin-app rm -rf data/easy-ham-1 data/easy-ham-2 data/hard-ham-1 data/spam-1 data/spam-2
echo '  Done!'
