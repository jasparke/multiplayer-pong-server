const express = require("express");
const path = require("path");
// const morgan = require('morgan');
const bodyParser = require("body-parser");
const app = express();
const PORT = 4001;
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server);

// app.use(morgan('dev'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static middleware
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/*", (req, res, next) => {
    res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.use((req, res, next) => {
    const err = new Error("Not Found");
    err.status = 404;
    next(err);
});

app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.send(err.message || "Internal server error");
});

const state = {
    p1: false,
    p2: false,
    start: false,
    players: {},
    ball: {
        x: 200,
        y: 50,
        dx: 0,
        dy: 3
    },
    height: 500,
    width: 400
};

io.on("connection", socket => {
    console.log("Player Connected", socket.id);

    socket.on("disconnect", function() {
        console.log("Player Disconnected");
        if (state.p1 && state.players[state.p1].sid == socket.id) {
            delete state.players[state.p1]
            state.p1 = false
        }
        if (state.p2 && state.players[state.p2].sid == socket.id) {
            delete state.players[state.p2]
            state.p2 = false
        }
        // TODO: Handle forfiet
    });

    socket.on("PlayerReady", (id) => {
        if (!state.p1) {
            state.p1 = id
            state.players[id] = {
                sid: socket.id,
                name: "Player1",
                x: 175,
                y: 10,
                dx: 0,
                width: 50,
                height: 15,
                color: '#FF00FF',
                score: 0
            }
        } else if (!state.p2) {
            state.p2 = id
            state.players[id] = {
                sid: socket.id,
                name: "Player2",
                x: 175,
                y: 475,
                dx: 0,
                width: 50,
                height: 15,
                color: '#00FFFF',
                score: 0
            }
        }
        console.log('Player Ready! ', id)

        state.start = state.p1&&state.p2
    });
    socket.on("PlayerMove", (p) => {
        const player = (p.id == state.p1 || p.id == state.p2) ? state.players[p.id] : false

        if (player) {
            if (p.left ^ p.right) {
                player.dx = (p.left) ? -7 : 7
                player.x += player.dx
                if (player.x < 0) {
                    player.x = 0
                    player.dx = 0
                } 
                if (player.x > 350 ) {
                    player.x = 350
                    player.dx = 0
                } 
            } else {
                player.dx = 0
            }


        }
    })
    // socket.on("PlayerMove", (p) => {
    //     if (p.id == state.p1 || p.id == state.p2) {
    //         if (p.left) {
    //             state.players[p.id].x -= 8
    //             if (state.players[p.id].x < 0) state.players[p.id].x = 0
    //         }
    //         if (p.right) {
    //             state.players[p.id].x += 8
    //             if (state.players[p.id].x > 350 ) state.players[p.id].x = 350
    //         }
    //     }
    // })
});

setInterval(() => {

    if (state.start && state.p1 && state.p2) {
        const b = state.ball;
        const p1 = state.players[state.p1]
        const p2 = state.players[state.p2]
        b.x += b.dx
        b.y += b.dy
        var left_x = b.x - 5
        var right_x = b.x + 5
        var top_y = b.y - 5
        var bot_y = b.y + 5

        if (left_x < 0) {
            b.x = 5
            b.dx = -b.dx
        } else if (right_x > state.width) {
            b.x = state.width - 5
            b.dx = -b.dx
        }

        if (b.y > state.height) {
            //p1 score
            p1.score++
            b.x = state.width/2
            b.y = state.height - 80
            b.dx = 0
            b.dy = -3
        }

        if (b.y < 0) {
            // p2 score
            p2.score++
            b.x = state.width/2
            b.y = 80
            b.dx = 0
            b.dy = 3
        }
        if (b.y > state.height/2) {
            if (top_y < (p2.y + p2.height) && bot_y > p2.y && left_x < (p2.x + p2.width) && right_x > p2.x) {
                // hit paddle
                b.dy = -3
                b.dx += (p2.dx/2)
                b.y += b.dy
            }
        } else {
            if (top_y < (p1.y + p1.height) && bot_y > p1.y && left_x < (p1.x + p1.width) && right_x > p1.x) {
                // hit paddle
                b.dy = 3
                b.dx += (p1.dx/2)
                b.y += b.dy
            }
        }
    }
    io.sockets.emit("Update", state);
}, 1000 / 60);

server.listen(PORT, () => {
  console.log("Server is live on PORT:", PORT);
});


