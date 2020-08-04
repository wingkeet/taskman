'use strict'

class Queue {
    #name
    #maxLength
    #queue = []

    constructor(name, maxLength = 100) {
        this.#name = name
        this.#maxLength = maxLength
    }

    get name() {
        return this.#name
    }

    get length() {
        return this.#queue.length
    }

    push(task) {
        if (this.isFull()) return false
        this.#queue.push(task)
        return true
    }

    pop() {
        return this.#queue.shift()
    }

    isEmpty() {
        return this.#queue.length === 0
    }

    isFull() {
        return this.#queue.length >= this.#maxLength
    }
}

module.exports = Queue
