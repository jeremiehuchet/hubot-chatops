const http = require('./http')
const { Gitlab } = require('gitlab');

class GitlabApi {

  constructor() {
    this.api = new Gitlab({
      host: process.env.HUBOT_GITLAB_HOST,
      token: process.env.HUBOT_GITLAB_PRIVATE_TOKEN
    })
  }

  async release(projectName, version) {
    const p = await this.api.Projects.show(projectName)
    const savedMergeMethod = p.merge_method
    try {
      await this.api.Projects.edit(p.id, { merge_method: 'merge' })
      const mr = await this.api.MergeRequests.create(p.id, 'develop', 'master', `Release ${version}`)
      await this.api.MergeRequests.accept(mr.project_id, mr.iid)
      await this.api.Tags.create(p.id, { tag_name: version, ref: 'master', message: `Release ${version}` })
    } finally {
      return this.api.Projects.edit(p.id, { merge_method: savedMergeMethod })
    }
  }

}

module.exports = {
  GitlabApi
}