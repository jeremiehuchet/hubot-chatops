//
// Description:
//   Release projects
//
// Dependencies:
//   None
//
// Configuration:
//   HUBOT_SLACK_TOKEN - Slack api token
//   HUBOT_GITLAB_HOST - Gitlab host (ex: https://gitlab.com)
//   HUBOT_GITLAB_PRIVATE_TOKEN - Gitlab private token to acces the API
//
// Commands:
//   release <project> <version> - Trigger a release (merge develop → master & tag)

const improve = require('../lib/better-robot')
const { GitlabApi } = require('../lib/gitlab')
const { SlackMessage } = require('../lib/slack')

const gitlab = new GitlabApi()

const capability = robot => {

  robot.hear(/^release ([^ ]+) ([^ ]+)$/i, async res => {
    const project = `${res.match[1]}`
    const version = res.match[2]
    await gitlab.release(project, version)
    new SlackMessage(robot, res.message)
      .threadReply(`Just released v${version} of project ${project}`)
  })
}


module.exports = improve('release')(capability)