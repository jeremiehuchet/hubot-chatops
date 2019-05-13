class Client {

  constructor(robot, baseUrl) {
    this.robot = robot
    this.baseUrl = baseUrl
    this.headers = []
  }

  withBasicAuth(username, password) {
    if (!username || !password) {
      throw new Error('Empty username or password')
    }
    this.basicAuth = `${username}:${password}`
    return this
  }

  withHeader(name, value) {
    if (!name || !value) {
      throw new Error('Empty header name or value')
    }
    this.headers.push({
      name: name,
      value: value
    })
    return this
  }

  get(path) {
    return new Promise(
      (resolve, reject) => {
        const req = this.robot.http(this.baseUrl + path)
        if (this.basicAuth) {
          req.auth(this.basicAuth)
        }
        if (this.headers.length > 0) {
          this.headers.forEach(h => req.header(h.name, h.value))
        }
        return req.get()((err, response, body) => {
            err ? reject(err) : resolve(body)
          })
        }
    )
  }
}

module.exports = {
  Client
}

