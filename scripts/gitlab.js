//
// Description:
//   Interacts with gitlab
//
// Dependencies:
//   @slack/web-api
//
// Configuration:
//   HUBOT_SLACK_TOKEN - Slack api token
//   HUBOT_GITLAB_HOST - Gitlab host (ex: https://gitlab.com)
//   HUBOT_GITLAB_PRIVATE_TOKEN - Gitlab private token to acces the API
//   HUBOT_GITLAB_WATCH_PROJECTS_LIST - Comma-separated list of projects to monitor (ex: group-a/project-1,group-b/project-2)
//   HUBOT_GITLAB_WATCH_BRANCHES_REGEXP - Filter branches with a regexp (ex: develop|master|\d+([.-_]\d+)*)
//
// Commands:
//   none - notifies pipeline executions


const http = require('../lib/http')
const slackapi = require('@slack/web-api')
const { SlackStatusMessage } = require('../lib/slack')

module.exports = robot => {

  const watchedProjects = (process.env.HUBOT_GITLAB_WATCH_PROJECTS_LIST || '').split(',')
  const watchedBranches = new RegExp(process.env.HUBOT_GITLAB_WATCH_BRANCHES_REGEXP, 'gi')

  const slack = new slackapi.WebClient(process.env.HUBOT_SLACK_TOKEN)
  const gitlab = new http.Client(robot, process.env.HUBOT_GITLAB_HOST + '/api/v4')
    .withHeader('Private-Token', process.env.HUBOT_GITLAB_PRIVATE_TOKEN)

  robot.error((err, msg) => {
    robot.logger.error(`gitlab: ${err.stack}`)
    msg.send(`:boom: that's an error... ${err}`)
  })

  const pipelinesWatchList = new Map()
  const stageReactions = {
    build: 'construction_worker',
    test: 'male-detective',
    docker: 'docker',
    deploy: 'rocket'
  }

  // returns the duration of the laste pipeline of the given project and reference (branch, tag, ...)
  function estimatePipelineDuration(projectId, ref) {
    return gitlab.get(`/projects/${projectId}/pipelines?status=success&order_by=id&sort=desc`)
      .then(JSON.parse)
      .then(pipelines => pipelines.find(pipeline => pipeline.ref === ref))
      .then(previousPipeline => gitlab.get(`/projects/${projectId}/pipelines/${previousPipeline.id}`))
      .then(JSON.parse)
      .then(prevPipeline => Math.trunc(prevPipeline.duration / 60) + 1)
      .catch(err => robot.logger.info(`gitlab: unable to retrieve last pipeline execution time for project ${projectId}: ${err.stack}`))
  }

  // returns the name and url the environment the last pip
  async function guessTargetEnvironment(projectId, ref) {
    const deployments = await gitlab.get(`/projects/${projectId}/deployments?order_by=id&sort=desc`)
      .then(JSON.parse)
    const branchRefEnv = deployments.find(d => d.ref === ref)
    const tagRefEnv = deployments.find(d => !!d.tag)
    if (branchRefEnv) {
      return branchRefEnv.environment
    }
    if (tagRefEnv) {
      return tagRefEnv.environment
    }
    return {
      name: 'unknown env',
      url: 'http://unknown'
    }
  }

  async function handlePipelineEvent(e, channel) {
    robot.logger.debug(`gitlab: handle event pipeline[id=${e.object_attributes.id}, status=${e.object_attributes.status}]`)

    if (!pipelinesWatchList.has(e.object_attributes.id)) {
      // first event about this pipeline, initialize notifier
      const notifier = new SlackStatusMessage(channel, slack, robot.logger)
      pipelinesWatchList.set(e.object_attributes.id, {
        info: e,
        notifier: notifier
      })
      // notify channel with duration estimation
      const duration = await estimatePipelineDuration(e.project.id, e.object_attributes.ref)
      const environment = await guessTargetEnvironment(e.project.id, e.object_attributes.ref)
      await notifier.message(
        `:rocket: déploiement de ${e.project.name} sur ${environment.name} d'ici ${duration} minutes`,
        e.commit.message
        )
      // dispatch jobs events which should have been ignored if they came before the pipeline event
      e.builds.forEach(build => handleBuildEvent({
        commit: { id: e.object_attributes.id },
        build_stage: build.stage,
        build_status: build.status
      }));
    }

    // update pipeline infos
    const p = pipelinesWatchList.get(e.object_attributes.id)
    p.info = e

    // update message if pipeline is finished
    if (p.info.object_attributes.finished_at) {
      switch (p.info.object_attributes.status) {
        case 'success':
          p.notifier.color('good')
          p.notifier.react('heavy_check_mark')
          break
        case 'failed':
          p.notifier.color('danger')
          break
        default:
          p.notifier.color('warning')
      }
      pipelinesWatchList.delete(p.info.object_attributes.id)
    }

    // cleanup pipeline watch list entries older than 2 hours
    pipelinesWatchList.forEach((p, id, map) => {
      const now = new Date().getTime()
      const expires = new Date(p.created_at).getTime() + 120 * 60 * 1000
      if (now > expires) {
        map.delete(id)
      }
    })
    robot.logger.info(`gitlab: watch list size: ${pipelinesWatchList.size}`)
  }

  function handleBuildEvent(e) {
    const p = pipelinesWatchList.get(e.commit.id)
    if (!p) {
      robot.logger.debug(`gitlab: ignore event build[id=${e.build_id}] because event pipeline[id=${e.commit.id}] has not been received yet`)
      return
    }
    robot.logger.debug(`gitlab: handle event build[id=${e.build_id}, status=${e.build_status}]`)
    if (e.build_status != 'created' && stageReactions[e.build_stage]) {
      p.notifier.react(stageReactions[e.build_stage])
    }
  }

  function shouldWatchEvent(e) {
    const watchProject = watchedProjects.includes(e.project.path_with_namespace)
    const watchRef = e.object_attributes.ref.match(watchedBranches)
    robot.logger.info(`gitlab: project ${e.object_attributes.ref}, watchProject=${watchProject}, watchRef=${watchRef}`)
    if (watchProject && watchRef) {
      return true
    }
    robot.logger.info(`gitlab: ignoring pipeline ${e.object_attributes.id} for branch ${e.object_attributes.ref}`)
    return false
  }

  robot.router.post('/hubot/gitlab-pipelines/:room', (req, res) => {
    if (req.body.object_kind === 'pipeline') {
      if (shouldWatchEvent(req.body)) {
        handlePipelineEvent(req.body, req.params.room)
      }
      return res.send('OK')
    }
    if (req.body.object_kind === 'build') {
      handleBuildEvent(req.body)
      return res.send('OK')
    }
    res.status(400).send('BAD REQUEST')
  })

}