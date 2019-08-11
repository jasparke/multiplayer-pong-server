const express = require("express");
const path = require("path");
// const morgan = require('morgan');
const bodyParser = require("body-parser");
const app = express();
const PORT = 4001;
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server);
const fs = require('fs')
const redis = require('redis')
const rawdata = fs.readFileSync('settings.json')
const settings = JSON.parse(rawdata)

/* Express server setup */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
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

getNewPlayers = () => {

    let player1 = false
    let player2 = false
    const client = redis.createClient(settings)

    const searchZone = ["LFG:1200", "LFG:1100", "LFG:1300", "LFG:1000", "LFG:1400", "LFG:900", "LFG:1500", "LFG:800", "LFG:1600", "LFG:700", "LFG:1700", "LFG:600", "LFG:1800", "LFG:1900", "LFG:2000"]
    let max = 1
    console.log('Starting player search...')
    client.on('connect', () => {
        client.blpop(searchZone[0], 3, (err, res) => {
            console.log(err)
            console.log(res)
        }) 
        client.blpop(searchZone[0], 3, (err, res) => {
            console.log(err)
            console.log(res)
        })
        // while (!player1 || !player2) {
        //     console.log('still dont have players...')
        //     for (var i = 0; i < max; i++){
        //         console.log('searching elo', searchZone[i])
        //         client.blpop(searchZone[i], 1, (err, res) => {
        //             player1 = true
        //             player2 = true
        //             console.log(res)
        //             console.log(err)
        //             if (res != null) {
        //                 if (!player1) {
        //                     player1 = res
        //                     console.log('Player 1 Found.')
        //                     console.log(res)
        //                 } else if (!player2) {
        //                     player2 = res
        //                     console.log('Player 2 Found.')
        //                     console.log(res)
        //                     i = 16 // lol exit the loop
        //                 }
        //             }
        //         })
        //     }
        //     max += (max < 15) ? 1 : 0
        // }
        client.quit()
    })
}
probability = (score1, score2) => {
    return 1.0 * 1.0 / (1 + 1.0 * Math.pow(10, 1.0 * (score1 - score2) / 400))
}

gameEnded = (winner, loser) => {
    console.log("Game over: ", state.players[winner].name, "beat", state.players[loser].name, state.players[winner].score, "to", state.players[loser].score)
    const client = redis.createClient(settings)

    let winnerRank = 1200
    let loserRank = 1200

    client.on('connect', () => {
        client.get(winner, (err, reply) => {
            winnerRank = reply
        })
        client.get(loser, (err, reply) => {
            loserRank = reply
        })
        const prob = probability(winnerRank, loserRank)
        winnerRank = winnerRank + 30 * (1 - prob)
        loserRank = loserRank + 30 * (-1 + prob)

        client.set(loser, loserRank)
        client.set(winner, winnerRank)
        client.quit()
    })
    

    io.sockets.emit("GameOver", {winner: winner})
}


io.on("connection", socket => {
    console.log("Player Connected", socket.id);

    socket.on("disconnect", function() {
        console.log("Player Disconnected");
        if (state.p1 && state.players[state.p1].sid == socket.id) {
            delete state.players[state.p1]
            state.p1 = false
            state.start = false
            state.ball = {
                x: 200,
                y: 50,
                dx: 0,
                dy: 3
            }
        }
        if (state.p2 && state.players[state.p2].sid == socket.id) {
            delete state.players[state.p2]
            state.p2 = false
            state.start = false
            state.ball = {
                x: 200,
                y: 50,
                dx: 0,
                dy: 3
            }
        }
        
        if (!state.p2 && !state.p1) {
            console.log("Server is ready for new players")
            // Need to tell orchestrator that we can be used again.
        }
    });

    socket.on("PlayerReady", (p) => {
        if (!state.p1) {
            state.p1 = p.id
            state.players[p.id] = {
                sid: socket.id,
                name: p.name,
                x: 175,
                y: 10,
                dx: 0,
                width: 50,
                height: 15,
                color: '#FF00FF',
                score: 0
            }
            console.log('Player1 Ready!', p.name, "as", p.id)
        } else if (!state.p2) {
            state.p2 = p.id
            state.players[p.id] = {
                sid: socket.id,
                name: p.name,
                x: 175,
                y: 475,
                dx: 0,
                width: 50,
                height: 15,
                color: '#00FFFF',
                score: 0
            }
            console.log('Player2 Ready!', p.name, "as", p.id)
        }

        if (state.start = state.p1&&state.p2) console.log('STARTING GAME')
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
});

mainLoop = () => {
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
            console.log("Player 1 Scored: ", p1.score, " : ", p2.score)
            if (p1.score >= 1) {
                gameEnded(state.p1, state.p2)
            }
        }

        if (b.y < 0) {
            // p2 score
            p2.score++
            b.x = state.width/2
            b.y = 80
            b.dx = 0
            b.dy = 3
            console.log("Player 2 Scored: ", p1.score, " : ", p2.score)
            if (p2.score >= 1) {
                gameEnded(state.p2, state.p1)
            }
        }
        if (b.y > state.height/2) {
            if (top_y < (p2.y + p2.height) && bot_y > p2.y && left_x < (p2.x + p2.width) && right_x > p2.x) {
                // hit paddle
                b.dy = -3
                b.dx += (p2.dx/2)
                b.y += b.dy
                console.log("Player 2 hit the ball.")
            }
        } else {
            if (top_y < (p1.y + p1.height) && bot_y > p1.y && left_x < (p1.x + p1.width) && right_x > p1.x) {
                // hit paddle
                b.dy = 3
                b.dx += (p1.dx/2)
                b.y += b.dy
                console.log("Player 1 hit the ball.")
            }
        }
    }
    io.sockets.emit("Update", state);
}

let gameInterval = setInterval(mainLoop, 1000 / 60);

server.listen(PORT, () => {
    console.log("Server is live on PORT:", PORT);
    getNewPlayers()
});


