class Lobby {
    constructor(id, lobbyName, owner, game, numPlayers) {
        this.id = id;
        this.lobbyName = lobbyName;
        this.owner = owner.username;
        this.players = {};
        this.players[owner.username] = owner;
        this.game = game;
        this.numPlayers = numPlayers;
    }


    addPlayer(player) {
        const username = player.username;
        this.players[username] = player;
    }

    removePlayer(username) {
        if (this.players[username]) {
            delete this.players[username];
        }
    }

    containsPlayer(player) {
        return this.players[player.username];
    }
}

export default Lobby;