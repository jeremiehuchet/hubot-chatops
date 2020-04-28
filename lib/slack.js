const slackapi = require('@slack/web-api')

const slack = new slackapi.WebClient(process.env.HUBOT_SLACK_TOKEN)

class SlackStatusMessage {

  constructor(channelName, logger) {
    this.channel = channelName
    this.logInfo = (msg) => logger.info(`SlackStatusMessage: ${msg}`)
    this.logWarn = (msg) => logger.warn(`SlackStatusMessage: ${msg}`)
    this.handleError = (err) => logger.error(`SlackStatusMessage: ${err.stack}`)
    this.attachment = {
      text: undefined
    }

    this.update = async () => {
      if (!this.msgInfo) {
        this.msgInfo = await slack.chat.postMessage({
          channel: this.channel,
          attachments: [this.attachment]
        }).catch(this.handleError)
      } else {
        this.msgInfo = await slack.chat.update({
          channel: this.msgInfo.channel,
          ts: this.msgInfo.ts,
          attachments: [this.attachment]
        }).catch(this.handleError)
      }
      return this.msgInfo
    }
  }

  message(title, info) {
    this.attachment.title = title;
    this.attachment.text = info;
    return this.update()
  }

  title(text) {
    this.attachment.title = text;
    return this.update()
  }

  info(text) {
    this.attachment.text = text;
    return this.update()
  }

  async react(name) {
    if (!this.msgInfo) {
      this.logWarn(`can't set reaction :${name}: when no message have been sent`)
    }
    return slack.reactions.add({
      channel: this.msgInfo.channel,
      timestamp: this.msgInfo.ts,
      name: name
    }).catch(err => {
      if (err.message === 'An API error occurred: already_reacted') {
        this.logInfo(`reaction :${name}: already set`)
      } else {
        this.handleError(err)
      }
    })
  }

  async color(color) {
    this.attachment.color = color
    return this.update()
  }

}

class SlackMessage {

  constructor(robot, message) {
    this._robot = robot
    this._message = message
  }

  send(text) {
    return slack.chat.postMessage({
      channel: this._message.user.room,
      text
    }).catch(e => robot.logger.error(`[${tag}] ${e.stack}`))
  }

  threadReply(text) {
    return slack.chat.postMessage({
      channel: this._message.user.room,
      text,
      thread_ts: this._message.rawMessage.ts
    }).catch(e => this._logger.error(e.stack))
  }
}

module.exports = {
  SlackStatusMessage,
  SlackMessage,
}