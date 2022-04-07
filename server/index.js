const express = require("express");
const app = express();
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
app.use(cors());
var randomWords = require('random-words');

const PORT = process.env.PORT ||3001;

//Get three random words with different length.
var words = [randomWords({exactly: 1, minLength: 3, maxLength: 4})[0],
            randomWords({exactly: 1, minLength: 5, maxLength: 5})[0],
            randomWords({exactly: 1, minLength: 6, maxLength: 6})[0]];

//Game desc, getters and setters.           
class Game {
    constructor(room) {
        this.room = room;
        this.turn = 1;
        this.player1 = "";
        this.player2 = "";
        this.gamePoints = 0;
    }
    setPlayer2(name){this.player2 = name;}
    setPlayer1(name){this.player1 = name;}
    getPlayer2(){return this.player2;}
    getPlayer1(){return this.player1;}
    setGamePoints(points){this.gamePoints = points;}
    getGamePoints(){return this.gamePoints;}
    setTurn(turn){this.turn = turn;}
    getTurn(){return this.turn;}
}

//Connect to server and prepare sockets
const server = http.createServer(app);
const io = new Server(server,{cors:{origin: "*",methods: ["GET","POST"]}});

var game = null;
io.on("connection", (socket)=>{
    //console.log("connection created: "+socket.id);

    //Join the room. If there is no room, then create one.
    socket.on("join_room",(data)=>{
        socket.join(data.room);
        if(game === null){
            game = new Game(data.room);
            game.setPlayer1(data.username);//Player1: The player who enter the room first.
        }else{
            game.setPlayer2(data.username);//Player2: The player who enter the room second.
        }
        //console.log("user joined room: "+game.room);
        var playersNumber = 0
        if(game.player1!=""){
            playersNumber++;
        }
        if(game.player2!=""){
            playersNumber++;
        }
        socket.emit("players_number", playersNumber);//The number of joined players.
    });
    socket.on("start", (data) => {//Message from player2 to player1 to start the game.
        socket.to(data).emit("start_game");
    });

    //Send the drawing to the other player.(guess player).
    socket.on("send_drawing", (data) => {
        socket.to(data.room).emit("receive_drawing", data);
    });

    //Send success guess message to the other player(drawing player).
    socket.on("send_success", (data) => {
        game.setGamePoints(game.getGamePoints()+data.roundPoints); //Update the sesion points
        game.getTurn() ===1 ? game.setTurn(2) : game.setTurn(1);
        socket.emit("receive_success");
        socket.to(data.room).emit("receive_success")
    });

    //Return whos turn is now.
    socket.on("turn",(data)=>{
        game.getTurn()===1 ? socket.to(data).emit("player_turn",game.getPlayer1()) : socket.to(data).emit("player_turn",game.getPlayer2());
    });
    //Return the random words to the players.
    socket.on("get_words",(data)=>{
        socket.to(data).emit("receive_words",words);
    });

    //change the turn after successful guess.
    socket.on("change_turn", () => {
        game.getTurn()===1 ? socket.emit("player_turn",game.getPlayer1()) : socket.emit("player_turn",game.getPlayer2());
        words = [randomWords({exactly: 1, minLength: 3, maxLength: 4})[0],
            randomWords({exactly: 1, minLength: 5, maxLength: 5})[0],
            randomWords({exactly: 1, minLength: 6, maxLength: 6})[0]];
        socket.emit("receive_words",words);
        socket.emit("game_points",game.getGamePoints());

    });

    //If player disconnect... delete the game to make a new game.
    socket.on("disconnect",()=>{
        if(game!=null){
            socket.leave(game.room);
        }
        game = null;
    })
})

server.listen(PORT,()=>{
    console.log("SERVER RUNNIG")

})
