'use strict'

const fs = require('fs').promises
const path = require('path')
const util = require('util')

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function doWork(taskWrapper) {
    const secs = taskWrapper.task
    if (secs < 0) throw new Error('Negative number')
    await sleep(secs * 1000)
    const result = secs * 2
    const filename = path.join(__dirname, 'public', 'download', taskWrapper.taskId)
    const content = `${secs} ${result}\n`
    await fs.writeFile(filename, content, 'utf8')
    // EDIT: Change this to point to your file server or cloud storage
    taskWrapper.url = `http://nuc2:3000/download/${taskWrapper.taskId}`
    return result
}

process.on('message', async (taskWrapper) => {
    const t0 = Date.now()
    try {
        taskWrapper.ok = 1
        taskWrapper.result = await doWork(taskWrapper)
    }
    catch (err) {
        taskWrapper.ok = 0
        taskWrapper.errmsg = err.message
    }
    taskWrapper.tookms = Date.now() - t0
    process.send(taskWrapper)
})

process.on('disconnect', () => {
    process.exit(0)
})
