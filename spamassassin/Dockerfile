FROM ubuntu:latest

RUN apt-get update && \
    apt-get install -y spamassassin && \
    rm -rf /var/lib/apt/lists/*

CMD ["spamassassin", "-D", "--lint"]
