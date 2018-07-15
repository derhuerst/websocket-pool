# websocket-pool

**A pool of [WebSocket](https://en.wikipedia.org/wiki/WebSocket) connections. Supports reconnecting.** Allows load-balancing messages over multiple WebSocket servers, using any [scheduling scheme](https://en.wikipedia.org/wiki/Scheduling_(computing)#Scheduling_disciplines) (e.g. [round robin](https://en.wikipedia.org/wiki/Round-robin_scheduling)).

[![npm version](https://img.shields.io/npm/v/websocket-pool.svg)](https://www.npmjs.com/package/websocket-pool)
[![build status](https://api.travis-ci.org/derhuerst/websocket-pool.svg?branch=master)](https://travis-ci.org/derhuerst/websocket-pool)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/websocket-pool.svg)
[![chat with me on Gitter](https://img.shields.io/badge/chat%20with%20me-on%20gitter-512e92.svg)](https://gitter.im/derhuerst)
[![support me on Patreon](https://img.shields.io/badge/support%20me-on%20patreon-fa7664.svg)](https://patreon.com/derhuerst)


## Installation

```shell
npm install websocket-pool
```


## Usage

```js
const createPool = require('websocket-pool')
const WebSocket = require('ws')
const {RoundRobin} = require('square-batman')

const createScheduler = (urls) => {
	const scheduler = new RoundRobin(urls)
	// square-batman is not abstract-scheduler-compatible yet
	scheduler.get = scheduler.next
	return scheduler
}
const pool = createPool(WebSocket, createScheduler)

// incoming message, just like websocket.on('message')
pool.on('message', msg => console.log('<-', msg.data))

// >= 1 connection in the pool is open
pool.once('open', () => {
	pool.send('hello there')
})

// the pool failed to reconnect after retrying
pool.on('error', (err) => {
	console.error(err)
})

const urls = [
	'ws://echo.websocket.org/#1',
	'ws://echo.websocket.org/#2',
	'ws://echo.websocket.org/#3'
]
for (let url of urls) pool.add(url)
```

`websocket-pool` accepts any [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) implementation. For example, you can use the native implementation in browsers or [`ws`](https://npmjs.com/package/ws) in Node.

The `createScheduler` function must implement the [`abstract-scheduler` interface](https://github.com/derhuerst/abstract-scheduler).


## Related

- [`reconnecting-websocket`](https://www.npmjs.com/package/reconnecting-websocket) – If want to connect to only one server.


## Contributing

If you have a question or need support using `websocket-pool`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/derhuerst/websocket-pool/issues).
