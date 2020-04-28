// Description:
//   Looks up jira issues when they're mentioned in chat
//
//   Will ignore users set in HUBOT_JIRA_IGNORE_USERS (by default, JIRA and GitHub).
//
// Dependencies:
//   None
//
// Configuration:
//   HUBOT_JIRA_URL (format: "https://jira-domain.com:9090")
//   HUBOT_JIRA_IGNORECASE (optional; default is "true")
//   HUBOT_JIRA_USERNAME (optional)
//   HUBOT_JIRA_PASSWORD (optional)
//   HUBOT_JIRA_IGNORE_USERS (optional, format: "user1|user2", default is "jira|github")
//
// Commands:
//   <issue ID> - Reply with <issue ID>'s title
//
// Original Author:
//   rustedgrail
//   stuartf

// sourced from https://github.com/rustedgrail/hubot-jira
// rewritten to js

const improve = require('../lib/better-robot')
const { JiraApi } = require('../lib/jira')
const { SlackMessage } = require('../lib/slack')

const jiraUrl = process.env.HUBOT_JIRA_URL
const jiraUsername = process.env.HUBOT_JIRA_USERNAME
const jiraPassword = process.env.HUBOT_JIRA_PASSWORD
const jiraIgnoreUsers = process.env.HUBOT_JIRA_ISSUES_IGNORE_USERS || "jira|github|gitlab"

const capability = robot => {

  const cache = []

  const jira = new JiraApi(robot, jiraUrl, jiraUsername, jiraPassword)

  function cleanUpCache() {
    const now = new Date().getTime()
    while (cache.length > 0 && cache[0].expires <= now) {
      cache.shift()
    }
    robot.logger.debug(`cache size: ${cache.length}`)
  }

  function findCachedIssue(issueId) {
    cleanUpCache()
    return cache
      .map(cacheEntry => cacheEntry.issue)
      .find(issue => issue.key === issueId)
  }

  async function fetchIssue(issueId) {
    const issue = await jira.getIssue(issueId)
    cache.push({
      expires: new Date().getTime() + 120000,
      issue: issue
    })
    return issue
  }

  jira.getTicketDetectionPattern()
    .then(jiraPattern => {
      robot.logger.info(`Listening to jira tickets using pattern ${jiraPattern}`)

      robot.hear(jiraPattern, msg => {
        if (!msg.message.user.name || msg.message.user.name.match(new RegExp(jiraIgnoreUsers, 'i'))) {
          robot.logger.info(`Ignoring message from ${msg.message.user.name}`)
          return
        }
        robot.logger.debug(`handling messages matches ${msg.match.join(', ')}`)
        msg.match.forEach(async issueId => {
          const issue = findCachedIssue(issueId) || await fetchIssue(issueId)
          if (issue.errorMessages) {
            await new SlackMessage(robot, msg.message)
              .threadReply(`:information_source: ${issueId} ${issue.errorMessages.join(', ')}`)
          } else {
            let ticketLink = `<${jiraUrl}/browse/${issueId}|${issueId}>`
            if (issue.fields.status.statusCategory.key == 'done') {
              ticketLink = `~${ticketLink}~`
            }
            msg.send(`${ticketLink} ${issue.fields.summary}`)
          }
        })
      })
    })
}

module.exports = improve('jira-issues')(capability)