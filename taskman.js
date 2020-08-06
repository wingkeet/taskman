'use strict'

const cp = require('child_process')
const os = require('os')
const path = require('path')
const util = require('util')
const ObjectId = require('bson').ObjectId
const Queue = require('./queue')

const DEBUG = false
function debugPrint(str) {
    if (DEBUG) console.debug(str)
}

// Worker status could be 'idle' or 'busy'.
// Task status could be 'queueing', 'processing' or 'done'.

class TaskMan {
    #numWorkers
    #callback
    #queue
    #workers = []
    #wstatuses = [] // worker statuses
    #resolve = null // is either saved resolve() function or null

    constructor(options = {}) {
        const cpus = os.cpus().length
        const { numWorkers = cpus, maxQueueLength = 100, callback } = options
        if (numWorkers < 1) throw new Error("'numWorkers' must be >= 1")
        if (maxQueueLength < 0) throw new Error("'maxQueueLength' must be >= 0 or Infinity")
        this.#numWorkers = numWorkers
        this.#queue = new Queue('test', maxQueueLength)
        this.#callback = callback
        this.#init()
    }

    #init() {
        for (let i = 0; i < this.#numWorkers; i++) {
            const worker = cp.fork(path.join(__dirname, 'worker.js'))
            this.#workers.push(worker)
            this.#wstatuses.push('idle')

            worker.on('exit', (code, signal) => {
                debugPrint(`worker ${worker.pid} exited; code=${code} signal=${signal}`)
            })
        }
    }

    pids() {
        return this.#workers.map(worker => worker.pid)
    }

    countBusyWorkers() {
        return this.#wstatuses.reduce((count, status) => count + (status === 'busy' ? 1 : 0), 0)
    }

    getQueueLength() {
        return this.#queue.length
    }

    isIdle() {
        return this.#queue.isEmpty() && this.countBusyWorkers() === 0
    }

    barrier() {
        return new Promise((resolve, reject) => {
            if (this.#resolve) {
                reject(new Error('barrier() can only be called once'))
            }
            else if (this.isIdle()) {
                resolve()
            }
            else {
                // Save the resolve() function so that it could be called later
                this.#resolve = resolve
            }
        })
    }

    close() {
        if (!this.#resolve && this.isIdle()) {
            this.#workers.forEach(worker => worker.disconnect())
        }
        else {
            throw new Error('Ensure queue is empty and all workers are idle before calling close()')
        }
    }

    // Assign tasks to workers in round-robin fashion
    #nextWorkerIndex = 0 // used only in #getNextIdleWorkerIndex()
    #getNextIdleWorkerIndex() {
        for (let i = 0; i < this.#numWorkers; i++) {
            const index = (this.#nextWorkerIndex + i) % this.#numWorkers
            if (this.#wstatuses[index] === 'idle') {
                this.#nextWorkerIndex = (index + 1) % this.#numWorkers
                return index
            }
        }
        return -1 // no idle worker
    }

    push(task) {
        let index // worker index

        if (this.#resolve) {
            throw new Error(`task ${task} rejected; barrier() has been called`)
        }

        const taskCompletionCallback = (taskWrapper) => {
            // Received result from worker
            debugPrint(`worker ${this.#workers[index].pid} completed task ${taskWrapper.task}`)
            taskWrapper.status = 'done'
            this.#callback?.(taskWrapper) // ES2020 optional chaining operator

            this.#wstatuses[index] = 'idle'
            if (this.#resolve && this.isIdle()) {
                // barrier() has been called and there is no more work to be done
                this.#resolve()
                this.#resolve = null
            }
            else if (taskWrapper = this.#queue.pop()) { // try to dequeue task
                // Assign task to the next worker
                index = this.#getNextIdleWorkerIndex()
                this.#wstatuses[index] = 'busy'
                const worker = this.#workers[index]
                worker.once('message', taskCompletionCallback)
                taskWrapper.status = 'processing'
                worker.send(taskWrapper)
                debugPrint(`task ${util.inspect(taskWrapper, { depth: null })} sent to worker ${worker.pid}`)
            }
        }

        // 1. Check workers: assign task to idle worker if one is available.
        // 2. Check queue: enqueue task if queue is not full.
        // 3. Reject task.

        let taskWrapper
        index = this.#getNextIdleWorkerIndex() // check workers
        if (index !== -1) {
            // Assign task to idle worker
            this.#wstatuses[index] = 'busy'
            const worker = this.#workers[index]
            worker.once('message', taskCompletionCallback)
            const taskId = new ObjectId().toHexString()
            taskWrapper = { ok: 1, status: 'processing', task, taskId }
            worker.send(taskWrapper)
            debugPrint(`task ${util.inspect(taskWrapper, { depth: null })} sent to worker ${worker.pid}`)
        }
        else if (!this.#queue.isFull()) { // check queue
            // Enqueue task
            const taskId = new ObjectId().toHexString()
            taskWrapper = { ok: 1, status: 'queueing', task, taskId }
            this.#queue.push(taskWrapper)
            debugPrint(`task ${util.inspect(taskWrapper, { depth: null })} queued`)
        }
        else {
            // Reject task
            debugPrint(`task ${task} rejected; task queue is full, call again later`)
            taskWrapper = { ok: 0, status: 'queue-full', task }
        }

        return taskWrapper
    }
}

module.exports = TaskMan
