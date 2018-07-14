'use strict'

const {EventEmitter} = require('events')

const defaults = {
	// todo: chooseConnection(msg, connections) => connection
}

const createPool = (WebSocket, createScheduler, urls, opt = {}) => {
	opt = Object.assign({}, defaults, opt)

	const pool = new EventEmitter()

	const scheduler = createScheduler([])
	// todo: index-based?
	const connections = Object.create(null) // by url
	let nrOfOpenConnections = 0

	// todo: retry with exponential backoff
	const open = (url) => {
		if (connections[url]) return;

		const ws = new WebSocket(url)
		connections[url] = ws
		ws.addEventListener('message', onMessage)

		const onceOpen = () => {
			ws.removeEventListener('open', onceOpen)
			scheduler.add(url)

			pool.emit('connection-open', url, ws)
			nrOfOpenConnections++
			if (nrOfOpenConnections === 1) pool.emit('open')
		}
		ws.addEventListener('open', onceOpen)

		const onceClosed = () => {
			ws.removeEventListener('close', onceClosed)
			scheduler.remove(url)
			delete connections[url]

			pool.emit('connection-close', url, ws)
			nrOfOpenConnections--
			if (nrOfOpenConnections === 0) pool.emit('close')
		}
		ws.addEventListener('close', onceClosed)
	}

	const onMessage = (msg) => {
		pool.emit('message', msg)
	}

	const send = (msg) => {
		const url = scheduler.get()
		if (!url || !connections[url]) {
			throw new Error('no connection available') // todo: wait
		}

		const ws = connections[url]
		ws.send(msg)
	}

	setTimeout(() => {
		for (let url of urls) open(url)
	}, 0)

	pool.send = send
	return pool
}

module.exports = createPool
