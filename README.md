# chatops

Gitlab CI and Jira capabilities for Hubot.

## quick start

Build docker image: 

```bash
docker build -t chatops .
```

Bot takes its configuration from environment variables. Read scripts documentation to learn requirements and capabilities:

- [gitlab-pipelines.js](https://github.com/jeremiehuchet/hubot-chatops/blob/master/scripts/gitlab-pipelines.js) : Notifies slack of running Gitlab pipelines
- [jira-issues.js](https://github.com/jeremiehuchet/hubot-chatops/blob/master/scripts/jira-issues.js) : Looks up Jira issues when they're mentioned in slack
- [release.js](https://github.com/jeremiehuchet/hubot-chatops/blob/master/scripts/release.js) : Release projects (merge develop → master & tag)

Run container:

```bash
docker run -d -e HUBOT_SLACK_TOKEN=xxx -e HUBOT_... chatops
```

