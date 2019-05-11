FROM node:lts-alpine
WORKDIR /hubot
CMD /hubot/bin/hubot --adapter slack
ADD external-scripts.json \
    package.json \
    package-lock.json \
    /hubot/
ADD bin /hubot/bin
ADD lib /hubot/lib
ADD scripts /hubot/scripts
