import indexHtml from './frontend/index.html';

const server = Bun.serve({
    port: 3000,
    routes: {
        "/": indexHtml
    }
})

console.log(`Server running on: ${server.url}`);
