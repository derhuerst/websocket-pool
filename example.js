'use strict'

const WebSocket = require('ws')
const createRoundRobin = require('@derhuerst/round-robin-scheduler')
const createPool = require('.')

const pool = createPool(WebSocket, createRoundRobin)

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
