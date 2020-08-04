'use strict'

const express = require('express')
const handlebars  = require('express-handlebars')
const path = require('path')
const util = require('util')
const TaskMan = require('./taskman')
const WebSocket = require('ws') // https://github.com/websockets/ws

const app = express()
const hostname = '0.0.0.0'

app.set('view engine', 'hbs')
app.engine('hbs', handlebars({
    extname: 'hbs'
}))

//app.use(express.json())
app.use(express.static('public'))

const connections = new Map()
const taskman = new TaskMan({ numWorkers: 2, maxQueueLength: 2, callback })

function callback(taskWrapper) {
    const ws = connections.get(taskWrapper.taskId)
    if (ws) {
        ws.send(JSON.stringify(taskWrapper))
        ws.close(1000, 'done')
    }
}

// curl http://localhost:3000
app.get('/', (req, res, next) => {
    try {
        res.render('home')
    }
    catch (err) {
        next(err)
    }
})

// Error handling middleware must be defined last
// https://expressjs.com/en/guide/error-handling.html
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send(err.stack)
})

const server1 = app.listen(3000, hostname, () => {
    let address = server1.address()
    address = util.inspect(address, { depth: null })
    console.log(`Express server listening on ${address} at ${new Date().toISOString()}`)
})

/*** Start of WebSocket server ***/

const server2 = require('http').createServer()
const wss = new WebSocket.Server({ server: server2 })

wss.on('error', (err) => {
    console.log(`[server] ${err}`)
})

wss.on('listening', () => {
    let address = wss.address()
    address = util.inspect(address, { depth: null })
    console.log(`WebSocket server listening on ${address} at ${new Date().toISOString()}`)
})

wss.on('connection', (ws, req) => {
    ws.on('message', (message) => {
        // Task submission from browser or websocket client
        // code 1003 is 'Unsupported Data'
        // https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Properties
        try {
            const data = JSON.parse(message)
            if ('task' in data) {
                clearTimeout(tid)
                const result = taskman.push(data.task)
                ws.send(JSON.stringify(result))
                if (result.ok) {
                    connections.set(result.taskId, ws)
                }
                else {
                    // All workers are busy and queue is at max capacity
                    ws.close(1013, 'try again later')
                }
            }
            else {
                ws.close(1003, 'bad request')
            }
        }
        catch (err) {
            ws.close(1003, 'bad request')
        }
    })

    ws.on('close', (event) => {
        function findTaskId(ws) {
            for (const [taskId, _ws] of connections.entries()) {
                if (_ws === ws) return taskId
            }
            return null
        }
        const taskId = findTaskId(ws)
        if (taskId) connections.delete(taskId)
        console.log(`close: num connections = ${connections.size}`)
    })

    const tid = setTimeout(() => ws.close(1001, 'timeout'), 3000)
    const address = `${req.connection.remoteAddress}:${req.connection.remotePort}`
    console.log(`open: connection from ${address}`)
})

server2.listen(8080, hostname)
