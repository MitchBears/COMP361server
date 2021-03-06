import ioConstructor from 'socket.io'
import http from 'http';
import firebase from "firebase";
import express from 'express';
import Player from './player.js'
import Lobby from './lobby.js'
import Response from './response.js'
import { debug } from 'util';

const app = express();
const server = http.Server(app);
const io = ioConstructor(server);

const usernameRoot = "/username";
const saveFolder = "savedGames"

const failureCode = -1;
const successCode = 1;

const config = {
    apiKey: "AIzaSyCvTLQxtSxITLn2uXDyhg4Dcxi1G2Oy9xA",
    authDomain: "comp361-7a450.firebaseapp.com",
    databaseURL: "https://comp361-7a450.firebaseio.com",
    projectId: "comp361-7a450",
    storageBucket: "comp361-7a450.appspot.com",
    messagingSenderId: "1038544768582"
};

firebase.initializeApp(config);
const database = firebase.database();

const lobbies = {};
const signedInPlayers = [];

function lobbyExists(lobbyName) {
    return lobbies[lobbyName];
}

function produceResponse(errorMessage, data, statusCode, actionType, callback) {
    let response = new Response();
    response.setMessage(errorMessage);
    response.setData(data);
    response.setStatusCode(statusCode);
    response.setActionType(actionType);

    callback(response);
}

let lobbyID = 0;

io.on('connection', socket => {
    console.log("Socket with ID: " + socket.id + " has connected");

    var currentPlayer = null;
    var currentLobby = null;
    var currentGame = null;

    function validatePlayer(username, givenPassword, callback, socket) {
        var errorMessage = "";
        var statusCode = failureCode;
    
        database.ref(usernameRoot + "/" + username).once('value').then(snapshot => {
            const userPassword = (snapshot.val() && snapshot.val().password) || null;
    
            if (givenPassword == userPassword && !signedInPlayers.includes(username)) {
                statusCode = successCode;
                currentPlayer = new Player(socket.id, username);
                signedInPlayers.push(currentPlayer.username);
            } else {
                errorMessage = "LOGIN FAILURE: incorrect username and password";
            }
    
            produceResponse(errorMessage, null, statusCode, "login", callback);
        })
    }

    function registerPlayer(username, password, callback, socket) {
        let errorMessage = null;
        let statusCode = failureCode;
    
        database.ref(usernameRoot + "/" + username).once('value').then(snapshot => {
            const userExists = snapshot.val();
    
            if (!userExists) {
                database.ref(usernameRoot + "/" + username).set({
                    password: password
                });
    
                statusCode = successCode;
                currentPlayer = new Player(socket.id, username);
                signedInPlayers.push(currentPlayer.username);
    
            } else {
                errorMessage = "REGISTRATION FAILURE: Player with the username: " + username + " already exists";
            }
    
            produceResponse(errorMessage, null, statusCode, "register", callback);
        })
    }

    function saveGame(currentPlayer, gameToSaveName, gameToSave, callback, socket){
        let errorMessage = null;
        let statusCode = failureCode;
        let username = currentPlayer.username;
    
        database.ref(usernameRoot + "/" + username).once('value').then(snapshot => {
            let gameExists = false;
            snapshot.forEach((child) => {
                if(child.key == gameToSaveName) gameExists = true;
            });
    
            if (!gameExists) {
                database.ref(usernameRoot + "/" + username + "/" + saveFolder).update({
                    [gameToSaveName]: gameToSave
                });
    
                statusCode = successCode;
            } else {
                errorMessage = "SAVE GAME FAILURE: Player with the username: " + username + " already has saved game called " + gameToSaveName;
            }
    
            produceResponse(errorMessage, null, statusCode, "saveGame", callback);
        })
    }

    function getAllSavedGames(currentPlayer, callback, socket){
        let errorMessage = null;
        let statusCode = failureCode;
        let username = currentPlayer.username;
    
        database.ref(usernameRoot + "/" + username + "/" + saveFolder).once('value').then(snapshot => {
            let allSavedGames = snapshot.val() || null;
            let allSavedGamesFormatted = [];

            if (allSavedGames) {
                statusCode = successCode;
            } else {
                errorMessage = "GET ALL SAVED GAMES FAILURE: Player with the username: " + username + " does not have any saved games";
            }
            for (var key in allSavedGames) {
                allSavedGamesFormatted.push({"gameToSaveName": key, "gameToSave": allSavedGames[key]});
              }
              console.log(allSavedGamesFormatted.toString());
              var SavedGamesToReturn = JSON.stringify(allSavedGamesFormatted);
            produceResponse(errorMessage, SavedGamesToReturn, statusCode, "getAllSavedGames", callback);
        })
    }


    function LoadGame(currentPlayer, gameToLoadName, callback, socket){
        let errorMessage = null;
        let statusCode = failureCode;
        let username = currentPlayer.username;
    
        database.ref(usernameRoot + "/" + username + "/" + saveFolder).once('value').then(snapshot => {
            const allSavedGames = snapshot.val() || null;
            var savedGame = null;

            for (var key in allSavedGames) {
            //console.log(key);

                if(key == gameToLoadName){
                    savedGame =  allSavedGames[key];
                    break;
                }
            }
            //console.log(savedGame);
            if (savedGame) {
                statusCode = successCode;
            } else {
                errorMessage = "LOAD GAME FAILURE: Player with the username: " + username + " does not have saved game called " + gameToLoadName;
            }
    
            produceResponse(errorMessage, JSON.stringify(savedGame), statusCode, "loadGame", callback);
        })
    }


    socket.on("register", (data, callback) => {
        console.log("Attempting user registration with the username: " + data.username);
        const playerName = data.username;
        const playerPassword = data.password;

        currentPlayer = registerPlayer(playerName, playerPassword, callback, socket);
    })

    socket.on("login", (data, callback) => {
        console.log(callback);
        const playerName = data.username;
        const playerPassword = data.password;

        console.log("Logging in with username: " + playerName);

        if (currentPlayer == undefined) {
            currentPlayer = validatePlayer(playerName, playerPassword, callback, socket); 
        } else {
            console.log("User already registered as: " + currentPlayer.username);
        } 
    })

    socket.on("logout", (data, callback) => {
        console.log("Signing out player with username: " + currentPlayer.username);
        if (signedInPlayers.includes(currentPlayer.username)) {
            signedInPlayers.splice(signedInPlayers.indexOf(currentPlayer.username), 1);
        }
        currentPlayer = null;
    })
    
    socket.on("createLobby", (data, callback) => {

        let errorMessage = null;
        let statusCode = failureCode;

        const lobbyName = data.newLobbyName;

        if (!currentPlayer) {
            errorMessage = "LOBBY CREATION FAILURE: user has not registered";
            console.log(errorMessage);
        } else if (!lobbyName) {
            errorMessage = "LOBBY CREATION FAILURE: lobby must have a Lobby Name";
            console.log(errorMessage);
        } 
        else {
            
            console.log("Received request to create lobby: " + lobbyName + " by player: " + currentPlayer.username);
            
            if (lobbyExists(lobbyName)) {
                errorMessage = "LOBBY CREATION FAILURE: Lobby " + data.lobbyName + " already exists";
                console.log(errorMessage);
            } else {
                console.log("SUCCESS: Lobby " + lobbyName + " created");
                currentLobby = new Lobby(lobbyID, lobbyName, currentPlayer, null, 3);
                currentLobby.difficulty = data.difficulty;
                currentLobby.mode = data.mode;
                currentLobby.map = data.map;
                currentLobby.loadGame = data.loadGame;
                currentLobby.loadGameName = data.loadGameName;
                lobbies[lobbyName] = currentLobby;
                lobbyID++;
                // Join lobby creator to lobby.
                socket.join(lobbyName);

                statusCode = successCode;
            }
        }

        produceResponse(errorMessage, null, statusCode, "createLobby", callback);
    })

    socket.on("getLobbies", (data, callback) => {
        console.log("Getting lobbies");

        let errorMessage = null;
        let statusCode = failureCode;

        let lobbiesToReturn = null

        if (!currentPlayer) { 
            errorMessage = "GET LOBBIES FAILURE: user has not registered";
            console.log(errorMessage);
        } 
        else {
            console.log("Getting lobbies for user: " + currentPlayer.username);
            statusCode = successCode;

            if (Object.keys(lobbies).length > 0 ){
                lobbiesToReturn = [];
                let lobby;
                for (var lobbyKey in lobbies) {
                    lobby = lobbies[lobbyKey];
                    console.log("lobby: " + lobby);
                    lobbiesToReturn.push({
                        lobbyName: lobby.lobbyName,
                        owner: lobby.owner,
                        id: lobby.id,
                        players: Object.keys(lobby.players),
                        numPlayers: lobby.numPlayers
                    });
                }
            }
            
            lobbiesToReturn = JSON.stringify(lobbiesToReturn);

        }

        produceResponse(errorMessage, lobbiesToReturn, statusCode, "getLobbies", callback);
    })

    socket.on("getLobbyInfo", (data, callback) => {
        console.log("Getting current lobby info");

        let errorMessage = null;
        let statusCode = failureCode;

        let lobbyInfoToReturn = null;

        if (!currentPlayer) {
            errorMessage = "GET CURRENT LOBBY INFO FAILURE: user not registered";
            console.log(errorMessage);
        }
        else if (!currentLobby) {
            errorMessage ="GET CURRENT LOBBY INFO FAILURE: " + currentPlayer.username + " is not in a lobby.";
            console.log(errorMessage);
        } else {
            let lobby = {
                lobbyName: currentLobby.lobbyName,
                owner: currentLobby.owner,
                numPlayers: currentLobby.numPlayers,
                players: Object.keys(currentLobby.players),
                difficulty: currentLobby.difficulty,
                loadGame : currentLobby.loadGame,
                mode: currentLobby.mode,
                map: currentLobby.map,
                loadGame: currentLobby.loadGame,
                loadGameName: currentLobby.loadGameName
            };
            statusCode = successCode;
            lobbyInfoToReturn = JSON.stringify(lobby);
            console.log(lobbyInfoToReturn);
        }

        produceResponse(errorMessage, lobbyInfoToReturn, statusCode, "getLobbies", callback);
    })

    socket.on("joinLobby", (data , callback) => {

        let errorMessage = null;
        let statusCode = failureCode;

        if (!currentPlayer) {
            errorMessage = "LOBBY JOIN FAILURE: user is not registered";
            console.log(errorMessage);

        } else if (!data.lobbyName) {
            errorMessage = "LOBBY JOIN FAILURE: lobby to join must be specified";
            console.log(errorMessage);

        } else {
            const lobbyName = data.lobbyName
            console.log("Joining lobby: " + lobbyName);
            if (lobbyExists(lobbyName)) {
                if (!currentLobby) {
                    let lobbyToJoin = lobbies[lobbyName];
                    console.log("Players in lobby: " + Object.keys(lobbyToJoin.players).length);
                    console.log("Players allowed: " + lobbyToJoin.numPlayers);
                    if (Object.keys(lobbyToJoin.players).length < lobbyToJoin.numPlayers) {
                        console.log("SUCCESS: " + currentPlayer.username + " joined lobby: " + lobbyName)
                        currentLobby = lobbies[lobbyName]
                        currentLobby.players[currentPlayer.username] = currentPlayer
                        // Join player to lobby.
                        socket.join(lobbyName)
                        socket.to(lobbyName).emit('playerJoinLobby', {players: Object.keys(currentLobby.players)});
                        statusCode = successCode;
                    } 
                    else {
                        errorMessage = "LOBBY JOIN FAILURE: lobby " + lobbyName + " is full";
                    }
                } 
                else {
                    errorMessage = "LOBBY JOIN FAILURE: player is already in a lobby";
                }
            } 
            else {
                errorMessage = "LOBBY JOIN FAILURE: lobby doesn't exist";
            }
        }
        produceResponse(errorMessage, null, statusCode, "joinLobby", callback);
    })

    socket.on("lobbyDeletedLobbyRefresh", (data, callback) => {

        let errorMessage = null;
        let statusCode = failureCode;

        if (!currentPlayer) {
            errorMessage = "LOBBY DELETED LOBBY REFRESH FAILURE: user has not registered";
            console.log(errorMessage);
        } else if (!currentLobby) {
            errorMessage = "LOBBY DELETED LOBBY REFRESH FAILURE: user " + currentPlayer.username +" is not in a lobby";
            console.log(errorMessage);
        } else {
            currentLobby = null;
            statusCode = successCode;
        }

        produceResponse(errorMessage, null, statusCode, "lobbyDeletedLobbyRefresh", callback);
    })
    socket.on("leaveLobby", (data, callback) => {

        let errorMessage = null;
        let statusCode = failureCode;

        if(!currentPlayer) {
            errorMessage = "LOBBY LEAVE FAILURE: user has not registered";
            console.log(errorMessage);
        } else if (!currentLobby) {
            errorMessage = "LOBBY LEAVE FAILURE: user is not in lobby";
            console.log(errorMessage);
        } else {
            console.log("Received request to LEAVE lobby: " + currentLobby.lobbyName + " by player " + currentPlayer.username);

            if (currentPlayer.username == currentLobby.owner) {
                socket.to(currentLobby.lobbyName).emit("lobbyDeleted");
                delete lobbies[currentLobby.lobbyName];
                console.log("LOBBY DELETED: " + currentLobby.lobbyName);
            } else {
                lobbies[currentLobby.lobbyName].removePlayer(currentPlayer.username);
                socket.to(currentLobby.lobbyName).emit("playerLeft", {players: Object.keys(currentLobby.players)})
            }
            
            socket.leave(currentLobby.lobbyName);

            console.log("SUCCESSFULLY removed player " + currentPlayer.username + " from lobby " + currentLobby.lobbyName);
            currentLobby = null;
            statusCode = successCode;
        }

        produceResponse(errorMessage, null, statusCode, "leaveLobby", callback);
    })

    socket.on("saveGame", (data, callback) => {
        console.log("Attempting save game");
        let statusCode = failureCode;
        let errorMessage = null;
        const gameToSave = data.gameToSave;
        const gameToSaveName = data.gameToSaveName;

        if (!currentPlayer) {
            errorMessage = "SAVE GAME FAILURE: user is not registered";
            console.log(errorMessage);
        } else if (!currentLobby) {
            errorMessage = "SAVE GAME FAILURE: must be in lobby to save game";
            console.log(errorMessage);
        } else {
            console.log("game saved");
            saveGame(currentPlayer, gameToSaveName, gameToSave, callback, socket)
        }
    })

    socket.on("getAllSavedGames", (data, callback) => {
        console.log("Attempting get all saved game");
        let statusCode = failureCode;
        let errorMessage = null;
        const loadedGame = null;

        if (!currentPlayer) {
            errorMessage = "LOAD GAME FAILURE: user is not registered";
            console.log(errorMessage);
        } else {
            getAllSavedGames(currentPlayer, callback, socket);
        }
    })

    socket.on("loadGame", (data, callback) => {
        console.log("Attempting load game");
        let statusCode = failureCode;
        let errorMessage = null;
        const gameToLoadName = data.gameToLoadName;
        const loadedGame = null;

        console.log("game name: " + gameToLoadName);
        if (!currentPlayer) {
            errorMessage = "LOAD GAME FAILURE: user is not registered";
            console.log(errorMessage);
        } /*else if (!currentLobby) {
            errorMessage = "LOAD GAME FAILURE: must be in lobby to load game";
            console.log(errorMessage);
        }*/ else {
            console.log("Load Game");
            LoadGame(currentPlayer, gameToLoadName, callback, socket);
        }
    })

    socket.on("sendChat", (data, callback) => {

        let errorMessage = null;
        let statusCode = failureCode;

        if (!currentPlayer) {
            errorMessage = "SEND CHAT FAILURE: user is not registered";
            console.log(errorMessage);
        } else if (!currentLobby) {
            errorMessage = "SEND CHAT FAILURE: must be in lobby to send chat";
            console.log(errorMessage);
        } else {
            socket.to(currentLobby.lobbyName).emit("receiveChat", {data: data})
            statusCode = successCode;
        }
        produceResponse(errorMessage, null, statusCode, "sendChat", callback);
    })

    socket.on("broadcastGame", (data, callback) => {
        console.log("Broadcast game");
        let statusCode = failureCode;
        let errorMessage = null;

        if (!currentPlayer) {
            errorMessage = "BROADCAST GAME FAILURE: user is not registered";
            console.log(errorMessage);
        } else if (!currentLobby) {
            errorMessage = "BROADCAST GAME FAILURE: user " + currentPlayer.username +" is not in a lobby.";
            console.log(errorMessage);
        } else {
            console.log("Emitting receiveGame to lobby: " + currentLobby.lobbyName);
            socket.to(currentLobby.lobbyName).emit("getGame", {data: data});

            delete lobbies[currentLobby.lobbyName];

            statusCode = successCode;
        }

        console.log("Broadcast game complete");
        produceResponse(errorMessage, null, statusCode, "broadcastGame", callback);
    })

    socket.on("nextTurn", (data, callback) => {
        console.log("Broadcasting next turn");

        let statusCode = failureCode;
        let errorMessage = null;

        if (!currentPlayer) {
            errorMessage = "NEXT TURN FAILURE: user is not registered";
            console.log(errorMessage);
        } else if (!currentLobby) {
            errorMessage = "NEXT TURN FAILURE: user " + currentPlayer.username + " is not in a lobby";
            console.log(console.errorMessage);
        } else {
            socket.to(currentLobby.lobbyName).emit("nextTurn", {data: data})
            statusCode = successCode;
        }

        console.log("Broadcast next turn complete");
        produceResponse(errorMessage, null, statusCode, "nextTurn", callback);

    })

    socket.on("broadcastAction", (data, callback) => {
        console.log("Broadcasting action");
        let statusCode = failureCode;
        let errorMessage = null;

        if (!currentPlayer) {
            errorMessage = "BROADCAST ACTION FAILURE: user is not registered";
            console.log(errorMessage);
        } else if (!currentLobby) {
            errorMessage = "BROADCAST ACTION FAILURE: must be in lobby to send chat";
            console.log(errorMessage);
        } else {
            socket.to(currentLobby.lobbyName).emit("receiveAction", {data: data})
            console.log("receive action sent");
            statusCode = successCode;
        }
        produceResponse(errorMessage, null, statusCode, "broadcastAction", callback);
    })

    socket.on("consentRequirement", (data, callback) => {
        
        let errorMessage = null;
        let statusCode = failureCode;

        if (!currentPlayer) {
            errorMessage = "CONSENT REQUIREMENT FAILURE: user is not registered";
            console.log(errorMessage);
        } else if (!currentLobby) {
            errorMessage = "CONSENT REQUIREMENT FAILURE: " + currentPlayer.username + " must be in a lobby";
            console.log(errorMessage);
        } else {
            const playerToSendTo = currentLobby.containsPlayer(data.ConsentRequiredFromPlayer);
            if (playerToSendTo) {
                io.to(playerToSendTo.socket).emit("consentRequired", {data: data})
                console.log("send conset req from " + data.ConsentPromptSentFromPlayer + " to " + data.ConsentRequiredFromPlayer);
                statusCode = successCode;
            } else {
                errorMessage = "CONSENT REQUIREMENT FAILURE: the player" + data.username + " doesn't exist";
            }
        }
        produceResponse(errorMessage, null, statusCode, "consentRequirement", callback);
    })

    socket.on("consentRequirementResponse", (data, callback) => {
        const playerToSendTo = currentLobby.containsPlayer(data.ConsentPromptSentFromPlayer);
        io.to(playerToSendTo.socket).emit("consentRequirementResponse", {data : data});
        console.log("response from: " + data.ConsentRequiredFromPlayer + " to " + data.ConsentRequiredFromPlayer);
        produceResponse(null, null, successCode, "consentRequirementResponse", callback);
    })

    socket.on("gameEnded", (data, callback) => {
        if (currentLobby != null) {
            socket.leave(currentLobby.lobbyName);
        }   
        currentLobby = null;
    })

    socket.on("disconnect", (reason) => {
        if (currentLobby) {
            console.log("Disconnecting player is a part of lobby");
            if (currentPlayer.username == currentLobby.owner) {
                console.log("Disconnecting player is lobby owner. Deleting lobby.");
                socket.to(currentLobby.lobbyName).emit("lobbyDeleted");
                if (lobbies[currentLobby.lobbyName]) {
                    delete lobbies[currentLobby.lobbyName];
                    console.log("LOBBY DELETED: " + currentLobby.lobbyName);
                }
            }
            else {
                currentLobby.removePlayer(currentPlayer.username);
                socket.to(currentLobby.lobbyName).emit("playerLeft", {players: Object.keys(currentLobby.players)});
            }
            currentLobby = null;
        }
        if (currentPlayer) {
            if (signedInPlayers.includes(currentPlayer.username)) {
                signedInPlayers.splice(signedInPlayers.indexOf(currentPlayer.username), 1);
            }
            currentPlayer = null;
        }
        console.log("Socket with id " + socket.id + " has disconnected");
    })
})

const port = process.env.PORT || 8080

server.listen(port, () => {
    console.log("Listening on port: " + port)
})
