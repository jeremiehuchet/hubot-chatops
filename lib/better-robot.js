const { SlackMessage } = require('../lib/slack')

const LOG_CHANNEL = 'chatops-logs'

const SlackClient = new require('@slack/web-api').WebClient
const slack = new SlackClient(process.env.HUBOT_SLACK_TOKEN)


module.exports = tag => capability => {

  return robot => {

    const send = (channel, text) => {
      slack.chat.postMessage({
        channel,
        text
      }).catch(e => robot.logger.error(`[${tag}] ${e.stack}`))
    }

    const betterLogger = Object.assign(
      Object.create(Object.getPrototypeOf(robot.logger)),
      robot.logger,
      {
        error: message => {
          robot.logger.error(`[${tag}] ${message}`)
          send(LOG_CHANNEL, `:fail: [${tag}] ${message}`)
        },
        warn: message => {
          robot.logger.warn(`[${tag}] ${message}`)
          send(LOG_CHANNEL, `:warning: [${tag}] ${message}`)
        },
        info: message => {
          robot.logger.info(`[${tag}] ${message}`)
          //send(LOG_CHANNEL, `:information_source: [${tag}] ${message}`)
        },
        debug: message => {
          robot.logger.debug(`[${tag}] ${message}`)
          //send(LOG_CHANNEL, `:make_detective: [${tag}] ${message}`)
        }
      }
    )

    const betterRobot = Object.assign(
      Object.create(Object.getPrototypeOf(robot)),
      robot,
      {
        logger: betterLogger,
        hear: (regexp, handler) => {
          try {
            robot.hear(regexp, res => {
              try {
                handler(res)
              } catch (e) {
                betterLogger.error(`error in hear handler ${regexp}: ${e.stack}`)
                new SlackMessage(betterRobot, res.message)
                  .threadReply(`I'm failing at handling _${res.message.rawMessage.text}_`)
                  .catch(e => betterLogger.error(e.stack))
              }
            })
          } catch (e) {
            betterLogger.error(`error registering handler ${regexp}: ${e.stack}`)
          }
        }
      }
    )

    try {
      capability(betterRobot)
    } catch (e) {
      betterLogger.error(`error initializing capability ${tag}: ${e.stack}`)
    }
  }
}