'use strict'

const {EventEmitter} = require('events')
const {operation} = require('retry')
const debug = require('debug')('websocket-pool')

const NORMAL_CLOSE = 1000

const noConnectionAvailable = new Error('no connection available')
noConnectionAvailable.code = 'noConnectionAvailable'

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
	const ops = []

	const add = (url) => {
		const i = connectionsI++
		debug('adding', url, 'as', i)
		const op = operation(Object.assign({}, opt.retry))
		ops[i] = op

		op.attempt((attemptNr) => {
			debug(i, 'reconnect', attemptNr)
			pool.emit('connection-retry', url, attemptNr)
			open(url, i, (err) => {
				debug(i, 'closed')
				const willRetry = op.retry(err)
				if (!willRetry && err.code !== NORMAL_CLOSE) {
					pool.emit('error', op.mainError())
				}
			})
		})

		return () => remove(i)
	}

	const remove = (i) => {
		const ws = connections[i]
		if (!ws) throw new Error('unknown connection ' + i)
		debug('removing', i, ws.url)

		const op = ops[i]
		ops[i] = null
		op.stop()
		connections[i] = null
		ws.close(NORMAL_CLOSE, 'removed from pool')
	}

	const open = (url, i, onClose) => {
		const ws = new WebSocket(url)
		connections[i] = ws
		ws.addEventListener('message', (msg) => {
			pool.emit('message', msg, ws)
		})

		const onceOpen = () => {
			ws.removeEventListener('open', onceOpen)
			debug(i, 'open')

			scheduler.add(i)

			pool.emit('connection-open', ws)
			nrOfOpenConnections++
			if (nrOfOpenConnections === 1) pool.emit('open')
		}
		ws.addEventListener('open', onceOpen)

		const onceClosed = (ev) => {
			ws.removeEventListener('close', onceClosed)
			debug(i, 'close')

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
			debug(i, 'error', ev.error)
			pool.emit('connection-error', ev.target, ev.error)
		})

		ws.addEventListener('ping', data => ws.pong(data))
	}

	const send = (msg) => {
		const i = scheduler.get()
		const ws = connections[i]
		if (!ws) throw noConnectionAvailable // todo: wait
		debug(i, 'send', msg)
		ws.send(msg)
	}

	const close = () => {
		for (let i = 0; i <= connectionsI; i++) {
			if (connections[i]) remove(i)
		}
	}

	pool.add = add
	pool.remove = remove
	pool.send = send
	pool.close = close
	return pool
}

createPool.noConnectionAvailable = noConnectionAvailable
module.exports = createPool
