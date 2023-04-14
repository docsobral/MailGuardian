FROM ubuntu:latest

# Installs spamassassin
RUN apt-get update && \
    apt-get install -y spamassassin
#

# Copies spamassassin configuration
COPY local.cf /etc/spamassassin/

# copies spamassassin rules and signatures
COPY Mail-SpamAssassin-rules-3.4.6.r1888502.tgz /etc/spamassassin/rules/
COPY Mail-SpamAssassin-rules-3.4.6.r1888502.tgz.asc /etc/spamassassin/rules/
COPY Mail-SpamAssassin-rules-3.4.6.r1888502.tgz.sha256 /etc/spamassassin/rules/
COPY Mail-SpamAssassin-rules-3.4.6.r1888502.tgz.sha512 /etc/spamassassin/rules/

# installs spamassassin rules
RUN apt-get install -y curl && \
    curl -O https://spamassassin.apache.org/updates/GPG.KEY && \
    sa-update --import GPG.KEY && \
    sa-update --install /etc/spamassassin/rules/Mail-SpamAssassin-rules-3.4.6.r1888502.tgz
#

RUN apt-get install -y cpanminus && \
    cpanm Digest::SHA && \
    cpanm HTML::Parser && \
    cpanm Net::DNS && \
    cpanm NetAddr::IP && \
    cpanm MIME::Base64 && \
    cpanm Net::LibIDN && \
    cpanm Email::Address::XS
#