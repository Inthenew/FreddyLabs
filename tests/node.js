let express = require('express');
let app = express();

let keys = {
    w: false,
    s: false,
    a: false,
    d: false,
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
const server = require('http').createServer(app);
server.listen(3000, '0.0.0.0', function () {
    console.log("listening");
});
const io = require("socket.io")(server, {
    cors: {
        origin: '*', // Allow any origin
        methods: ['GET', 'POST'],
        allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept'],
        credentials: true
    }
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('key', (data) => {
        keys[data.key] = data.value;
        // Now handled on client side //
        //tellTheRobot(data.key, data.value);
    });

    socket.once('disconnect', () => {
        for (let key in keys) {
            keys[key] = false;
        }
    });
});

