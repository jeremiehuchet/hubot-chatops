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

const http = require('../lib/http')

const jiraUrl = process.env.HUBOT_JIRA_URL
const jiraUsername = process.env.HUBOT_JIRA_USERNAME
const jiraPassword = process.env.HUBOT_JIRA_PASSWORD
const jiraIgnoreCase = process.env.HUBOT_JIRA_IGNORECASE
const jiraIgnoreUsers = process.env.HUBOT_JIRA_ISSUES_IGNORE_USERS || "jira|github|gitlab"

module.exports = robot => {

  const cache = []

  const jira = new http.Client(robot, jiraUrl)
    .withBasicAuth(jiraUsername, jiraPassword)

  robot.error((err, msg) => {
    robot.logger.error(`jira-issues: ${err.stack}`)
    msg.send(`:boom: ${msg.message} can't be handled because ${err}`)
  })

  async function getJiraProjects() {
    return jira.get('/rest/api/2/project')
      .then(JSON.parse)
  }

  // [{key: "KEY1"} {key: "KEY2"}] → '/\b(KEY1|KEY2)-?(\d+)\b/g'
  function jiraProjectsToMessagePattern(json) {
    const projectKeysPattern = json
      .map(project => project.key)
      .map(projectKey => `${projectKey}`)
      .join('|')
    const jiraPattern = `\\b(${projectKeysPattern})-?(\\d+)\\b`
    if (!jiraIgnoreCase || jiraIgnoreCase == true) {
      return new RegExp(jiraPattern, 'ig')
    }
    return new RegExp(jiraPattern, 'g')
  }

  function cleanUpCache() {
    const now = new Date().getTime()
    while (cache.length > 0 && cache[0].expires <= now) {
      cache.shift()
    }
    robot.logger.debug(`jira-issues: cache size: ${cache.length}`)
  }

  function findCachedIssue(issueId) {
    cleanUpCache()
    return cache
      .map(cacheEntry => cacheEntry.issue)
      .find(issue => issue.key === issueId)
  }

  async function fetchIssue(issueId) {
    const issue = await jira.get(`/rest/api/2/issue/${issueId}`)
      .then(JSON.parse)
    cache.push({
      expires: new Date().getTime() + 120000,
      issue: issue
    })
    return issue
  }

  getJiraProjects()
    .then(jiraProjectsToMessagePattern)
    .then(jiraPattern => {
      robot.logger.info(`Listening to jira tickets using pattern ${jiraPattern}`)

      robot.hear(jiraPattern, msg => {
        if (!msg.message.user.name || msg.message.user.name.match(new RegExp(jiraIgnoreUsers, 'i'))) {
          robot.logger.info(`jira-issues: Ignoring message from ${msg.message.user.name}`)
          return
        }
        robot.logger.debug(`jira-issues: handling messages matches ${msg.match}`)
        msg.match.forEach(async issueId => {
          const issue = findCachedIssue(issueId) || await fetchIssue(issueId)
          if (issue.errorMessages) {
            msg.send(`:boom: ${issueId} ${issue.errorMessages.join(', ')}`)
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
