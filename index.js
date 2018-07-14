'use strict'

const {EventEmitter} = require('events')
const {operation} = require('retry')

const defaults = {
	retry: {}
	// todo: chooseConnection(msg, connections) => connection
}

const createPool = (WebSocket, createScheduler, opt = {}) => {
	opt = Object.assign({}, defaults, opt)

	const pool = new EventEmitter()
	const scheduler = createScheduler([])

	const connections = []
	let connectionsI = 0
	let nrOfOpenConnections = 0

	const add = (url) => {
		const i = connectionsI++

		const op = operation(Object.assign({}, opt.retry))
		op.attempt((attemptNr) => {
			pool.emit('connection-retry', url, attemptNr)
			open(url, (err) => {
				const willRetry = op.retry(err)
				if (!willRetry) pool.emit('error', op.mainError())
			})
		})

		const remove = () => {
			if (!connections[i]) return;
			const ws = connections[i]
			connections[i] = null
			op.stop()
			ws.close()
		}
		return remove
	}

	const open = (url, i) => {
		const ws = new WebSocket(url)
		connections[i] = ws
		ws.addEventListener('message', (msg) => {
			pool.emit('message', msg, ws)
		})

		const onceOpen = () => {
			ws.removeEventListener('open', onceOpen)

			scheduler.add(i)

			pool.emit('connection-open', ws)
			nrOfOpenConnections++
			if (nrOfOpenConnections === 1) pool.emit('open')
		}
		ws.addEventListener('open', onceOpen)

		const onceClosed = (ev) => {
			ws.removeEventListener('close', onceClosed)

			scheduler.remove(i)
			connections[i] = null

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

	const send = (msg) => {
		const i = scheduler.get()
		const ws = connections[i]
		if (!ws) throw new Error('no connection available') // todo: wait
		ws.send(msg)
	}

	pool.add = add
	pool.send = send
	return pool
}

module.exports = createPool
