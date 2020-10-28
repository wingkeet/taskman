const messages = document.getElementById('messages')

function appendMessage(message) {
    const li = document.createElement('li')
    li.appendChild(document.createTextNode(message.replace(/,/g, ', ')))
    messages.appendChild(li)
}

function appendMessageWithLink(message, href, filename) {
    const substrs = message.replace(/,/g, ', ').split(href)

    // Create <a> node
    const a = document.createElement('a')
    a.setAttribute('href', href)
    a.setAttribute('download', filename)
    a.appendChild(document.createTextNode(href))

    const li = document.createElement('li')
    li.appendChild(document.createTextNode(substrs[0]))
    li.appendChild(a)
    li.appendChild(document.createTextNode(substrs[1]))
    messages.appendChild(li)
}

function downloadFile(url, filename) {
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', filename)
    a.click()
}

function sendTask(task) {
    // EDIT: Change this to point to your WebSocket server
    const ws = new WebSocket('ws://nuc2:8080')

    ws.addEventListener('error', (event) => {
        console.log('# error')
    })
    ws.addEventListener('open', (event) => {
        const json = JSON.stringify({ task })
        ws.send(json)
    })
    ws.addEventListener('message', (event) => {
        const json = event.data
        const data = JSON.parse(json)
        if (data.ok && data.status === 'done' && 'url' in data) {
            // Do something with result
            appendMessageWithLink(json, data.url, data.taskId)
            //downloadFile(data.url, data.taskId)
        }
        else {
            appendMessage(json)
        }
    })
    ws.addEventListener('close', (event) => {
        console.log(`# close { code:${event.code}, ` +
            `reason:'${event.reason}', wasClean:${event.wasClean} }`)
    })
}

const submit = document.getElementById('submit')
submit.addEventListener('click', (event) => {
    event.preventDefault()
    const task = document.getElementById('task').value
    sendTask(Number(task))
})
