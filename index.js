'use strict'

const {EventEmitter} = require('events')
const {operation} = require('retry')

const defaults = {
	retry: {}
	// todo: chooseConnection(msg, connections) => connection
}

const createPool = (WebSocket, createScheduler, urls, opt = {}) => {
	opt = Object.assign({}, defaults, opt)

	const pool = new EventEmitter()

	const scheduler = createScheduler([])
	// todo: index-based?
	const connections = Object.create(null) // by url
	let nrOfOpenConnections = 0

	const add = (url) => {
		const op = operation(Object.assign({}, opt.retry))

		op.attempt((attemptNr) => {
			pool.emit('connection-retry', url, attemptNr)
			open(url, (err) => {
				const willRetry = op.retry(err)
				if (!willRetry) pool.emit('error', op.mainError())
			})
		})
	}

	const open = (url) => {
		const ws = new WebSocket(url)
		connections[url] = ws
		ws.addEventListener('message', onMessage)

		const onceOpen = () => {
			ws.removeEventListener('open', onceOpen)

			scheduler.add(url)

			pool.emit('connection-open', ws)
			nrOfOpenConnections++
			if (nrOfOpenConnections === 1) pool.emit('open')
		}
		ws.addEventListener('open', onceOpen)

		const onceClosed = (ev) => {
			ws.removeEventListener('close', onceClosed)

			scheduler.remove(url)
			delete connections[url]

			pool.emit('connection-close', ev.target, ev.code, ev.reason)
			nrOfOpenConnections--
			if (nrOfOpenConnections === 0) pool.emit('close')

			const err = new Error(ev.reason)
			err.code = ev.code
			onClose(err)
		}
		ws.addEventListener('close', onceClosed)

		ws.addEventListener('error', (ev) => {
			pool.emit('connection-error', ev.target, ev.error)
		})

		ws.addEventListener('ping', data => ws.pong(data))
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
		for (let url of urls) add(url)
	}, 0)

	pool.send = send
	return pool
}

module.exports = createPool
