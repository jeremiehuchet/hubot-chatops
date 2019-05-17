class SlackStatusMessage {

  constructor(channelName, slackWebClient, logger) {
    this.slack = slackWebClient
    this.channel = channelName
    this.logInfo = (msg) => logger.info(`SlackStatusMessage: ${msg}`)
    this.logWarn = (msg) => logger.warn(`SlackStatusMessage: ${msg}`)
    this.handleError = (err) => logger.error(`SlackStatusMessage: ${err.stack}`)
  }

  async message(text) {
    if (!this.msgInfo) {
      this.msgInfo = await this.slack.chat.postMessage({
        channel: this.channel,
        text: text
      }).catch(this.handleError)
    } else {
      this.msgInfo = await this.slack.chat.update({
        channel: this.msgInfo.channel,
        ts: this.msgInfo.ts,
        text: text,
      }).catch(this.handleError)
    }
    return this.msgInfo
  }

  async react(name) {
    if (!this.msgInfo) {
      this.logWarn(`can't set reaction :${name}: when no message have been sent`)
    }
    return this.slack.reactions.add({
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

}

module.exports = {
  SlackStatusMessage
}