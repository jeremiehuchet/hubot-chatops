const http = require('./http')

class JiraApi {

  constructor(robot, jiraUrl, username, password) {
    this.robot = robot
    this.http = new http.Client(robot, jiraUrl)
      .withBasicAuth(username, password)

    // [{key: "KEY1"} {key: "KEY2"}] → '/\b(KEY1|KEY2)-?(\d+)\b/g'
    this.getTicketDetectionPattern = async () => {
      const projects = await this.getProjects()
      const projectKeysPattern = projects
        .map(project => project.key)
        .map(projectKey => `${projectKey}`)
        .join('|')
      const jiraPattern = `\\b(${projectKeysPattern})-?(\\d+)\\b`
      return new RegExp(jiraPattern, 'ig')
    }
  }

  getProjects() {
    return this.http.get('/rest/api/2/project')
      .then(JSON.parse)
  }

  getIssue(issueId) {
    return this.http.get(`/rest/api/2/issue/${issueId}`)
      .then(JSON.parse)
  }
}
module.exports = {
  JiraApi
}