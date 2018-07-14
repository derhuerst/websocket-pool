'use strict'

const WebSocket = require('ws')
const {RoundRobin} = require('square-batman')
const createPool = require('.')

const createScheduler = (urls) => {
	const s = new RoundRobin(urls)
	// square-batman is not abstract-scheduler-compatible yet
	s.get = s.next
	return s
}
const pool = createPool(WebSocket, createScheduler)

pool.on('message', (msg, ws) => {
	console.log(ws.url, 'says:', msg.data)
})
pool.on('error', (err) => {
	console.error(err)
})
pool.once('open', () => {
	setInterval(() => {
		pool.send('hello there')
	}, 3000)
})

const urls = [
	'ws://echo.websocket.org/#1',
	'ws://echo.websocket.org/#2',
	'ws://echo.websocket.org/#3'
]
for (let url of urls) pool.add(url)
