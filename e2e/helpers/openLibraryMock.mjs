import http from 'node:http'

const russianTitle = 'Преступление и наказание'

function searchResponse(url) {
  const query = url.searchParams.get('q')
  const language = url.searchParams.get('lang')

  if (query === 'key:/works/OL910004W') {
    if (language !== 'fr') return { status: 400, body: { docs: [] } }
    return {
      status: 200,
      body: {
        docs: [{
          key: '/works/OL910004W',
          title: russianTitle,
          editions: { docs: [{ title: 'Crime et Châtiment', language: ['fre'] }] },
        }],
      },
    }
  }

  if (query === 'e2e-title-in-reader-language') {
    if (language !== 'fr') return { status: 400, body: { docs: [] } }
    return {
      status: 200,
      body: {
        docs: [{
          key: '/works/OL910001W',
          title: russianTitle,
          author_name: ['Fyodor Dostoevsky'],
          editions: { docs: [{ title: 'Crime et Châtiment', language: ['fre'] }] },
        }],
      },
    }
  }

  if (query === 'e2e-english-fallback') {
    if (language !== 'fr') return { status: 400, body: { docs: [] } }
    return {
      status: 200,
      body: {
        docs: [{
          key: '/works/OL910002W',
          title: russianTitle,
          author_name: ['Fyodor Dostoevsky'],
          editions: { docs: [{ title: 'Crime and Punishment', language: ['eng'] }] },
        }],
      },
    }
  }

  if (query === 'e2e-canonical-fallback') {
    if (language !== 'fr') return { status: 400, body: { docs: [] } }
    return {
      status: 200,
      body: {
        docs: [{
          key: '/works/OL910003W',
          title: russianTitle,
          author_name: ['Fyodor Dostoevsky'],
          editions: { docs: [{ title: 'Crimen y castigo', language: ['spa'] }] },
        }],
      },
    }
  }

  return { status: 200, body: { docs: [] } }
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:3101')

  if (url.pathname === '/health') {
    response.writeHead(204)
    response.end()
    return
  }

  if (url.pathname === '/search.json') {
    const result = searchResponse(url)
    response.writeHead(result.status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(result.body))
    return
  }

  if (url.pathname === '/works/OL910004W.json') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      key: '/works/OL910004W',
      title: russianTitle,
      other_titles: ['Crime and Punishment'],
      authors: [],
    }))
    return
  }

  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({}))
})

server.listen(3101, process.env.MOCK_HOST ?? '127.0.0.1')

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
