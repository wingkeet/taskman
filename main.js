'use strict'

const TaskMan = require('./taskman')

// https://en.wikipedia.org/wiki/ANSI_escape_code#3/4_bit
const GREEN   = '\x1b[32m%s\x1b[0m'
const CYAN    = '\x1b[36m%s\x1b[0m'
const MAGENTA = '\x1b[95m%s\x1b[0m'

function callback(taskWrapper) {
    console.log(MAGENTA, 'callback:', JSON.stringify(taskWrapper))
}

async function main() {
    try {
        const options = { numWorkers: 2, maxQueueLength: 2, callback }
        const taskman = new TaskMan(options)
        console.log('main pid:', process.pid)
        console.log('worker pids:', taskman.wpids())
        console.log('max queue length:', options.maxQueueLength)

        const tasks = [ 4.4, 10, 5, -5, 7 ]
        tasks.forEach(task => console.log(GREEN, 'push:', JSON.stringify(taskman.push(task))))

        // barrier
        console.log(CYAN, 'BEFORE BARRIER')
        await taskman.barrier()
        console.log(CYAN, 'AFTER BARRIER')

        console.log(GREEN, 'push:', JSON.stringify(taskman.push(3.8)))
        await taskman.barrier()

        // Safe to shutdown
        taskman.close() // allows Node.js app to terminate properly
        console.log(CYAN, 'END')
    }
    catch (err) {
        console.error(err)
        process.exit()
    }
}

main()
