class Player {
    constructor(socket, username) {
        this.socket = socket;
        this.username = username;
        this.connected = true;
    }
}

export default Player;