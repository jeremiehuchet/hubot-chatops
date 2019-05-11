class Client {

  constructor(robot, baseUrl, basicAuth) {
    this.robot = robot
    this.baseUrl = baseUrl
    this.basicAuth = basicAuth
  }

  get(path) {
    return new Promise(
      (resolve, reject) =>
        this.robot.http(this.baseUrl + path)
          .auth(this.basicAuth)
          .get()((err, response, body) => {
            err ? reject(err) : resolve(body)
          })
    )
  }
}

module.exports = {
  Client
}

