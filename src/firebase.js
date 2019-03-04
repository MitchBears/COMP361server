import firebase from "firebase";

const root = "game";
const var1 = "lobbyname";
const var2 = "username";

var config = {
    apiKey: "AIzaSyCvTLQxtSxITLn2uXDyhg4Dcxi1G2Oy9xA",
    authDomain: "comp361-7a450.firebaseapp.com",
    databaseURL: "https://comp361-7a450.firebaseio.com",
    projectId: "comp361-7a450",
    storageBucket: "comp361-7a450.appspot.com",
    messagingSenderId: "1038544768582"
};
firebase.initializeApp(config);

const database = firebase.database();
console.log("Successfully connected")

//update
database.ref(root).on("value", function (snapshot) {
    document.getElementById("firebaseOutput").innerHTML = "Update: " + snapshot.val();
    console.log(snapshot);
}, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
});

//add
function addLobby() {
    var lobbyName = document.getElementById(lobbyName).value
    var username = document.getElementById(username).value
    var newClientKey = database.ref().child('game').push().key;
    database.ref(game + '/' + newClientKey + '/' + var1).set(lobbyName);
    database.ref(game + '/' + newClientKey + '/' + var2).set(username);

    document.getElementById("firebaseOutput").innerHTML = "Added " + lobbyName + " " + username;
}

//read
function getLobby() {
    var gameRef = database.ref(root);
    gameRef.on('value', function (snapshot) {
        snapshot.forEach(function (childSnapshot) {
            var childData = childSnapshot.val();
            document.getElementById("firebaseOutput").innerHTML = "Read : " + childData;
            console.log(childData);
        });
    });
}