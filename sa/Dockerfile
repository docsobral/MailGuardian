FROM ubuntu:latest

# SpamAssassin user and group
RUN groupadd -r spamassassin && useradd -r -g spamassassin spamassassin

# Installs SpamAssassin
RUN apt-get update && \
    apt-get install -y curl spamassassin spamc libnet-dns-perl libmail-dkim-perl libdb-file-lock-perl libdbi-perl libencode-detect-perl libio-socket-inet6-perl libio-socket-ssl-perl libnet-cidr-perl libnet-ident-perl libnet-patricia-perl libsocket6-perl && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
#

# Copy configuration
COPY local.cf /etc/spamassassin/

# Copy rules and signatures
COPY 3.4.6/Mail-SpamAssassin-rules-3.4.6.r1888502.tgz /etc/spamassassin/rules/
COPY 3.4.6/Mail-SpamAssassin-rules-3.4.6.r1888502.tgz.asc /etc/spamassassin/rules/
COPY 3.4.6/Mail-SpamAssassin-rules-3.4.6.r1888502.tgz.sha256 /etc/spamassassin/rules/
COPY 3.4.6/Mail-SpamAssassin-rules-3.4.6.r1888502.tgz.sha512 /etc/spamassassin/rules/

# Install rules
RUN curl -O https://spamassassin.apache.org/updates/GPG.KEY && \
    sa-update --import GPG.KEY && \
    sa-update --install /etc/spamassassin/rules/Mail-SpamAssassin-rules-3.4.6.r1888502.tgz
#

# Change ownership of files and directories
RUN chown -R spamassassin:spamassassin /etc/spamassassin /var/lib/spamassassin

# Set user and group for SpamAssassin
USER spamassassin