const drone = new Scaledrone('ptsqRZDha7XGR4Op'); // Replace with your Scaledrone channel ID
let room; // Current room
let playerName = '';
let players = [];
let roles = [];
let gameState = 'lobby'; // States: lobby, game, voting, enactPolicy, end
let currentPresident = null;
let currentChancellor = null;
let votes = {};
let policiesPassed = { liberal: 0, fascist: 0 };
let isHost = false; // Track if the player is the host

// UI Elements
const joinButton = document.getElementById('joinButton');
const createGameButton = document.getElementById('createGameButton');
const roomInput = document.getElementById('roomInput');
const chatInput = document.getElementById('chatInput');
const playerListDiv = document.getElementById('players');
const hostControlsDiv = document.getElementById('hostControls'); // Div for host controls

// Event Listeners
joinButton.addEventListener('click', joinGame);
createGameButton.addEventListener('click', createGame);
document.getElementById('sendMessageButton').addEventListener('click', sendMessage);

function createGame() {
    const roomName = roomInput.value.trim();
    if (!roomName) return alert('Please enter a room name.');
    
    room = drone.subscribe(`secret-hitler-${roomName}`);
    initializeRoom(true); // Set host to true
}

function joinGame() {
    const roomName = roomInput.value.trim();
    if (!roomName) return alert('Please enter a room name.');
    
    room = drone.subscribe(`secret-hitler-${roomName}`);
    initializeRoom(false); // Set host to false
}

function initializeRoom(host) {
    playerName = document.getElementById('playerName').value.trim();
    if (!playerName) return alert('Please enter your name.');
    
    if (players.includes(playerName)) {
        return alert('You have already joined this game!');
    }
    
    players.push(playerName);
    updatePlayers();
    drone.publish({ room: room.name, message: { type: 'newPlayer', name: playerName, isHost: host } });
    
    isHost = host;
    hostControlsDiv.style.display = isHost ? 'block' : 'none'; // Show/Hide host controls
    
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    
    room.on('message', handleMessage);
}

function sendMessage() {
    const messageContent = chatInput.value.trim();
    if (messageContent) {
        const message = { name: playerName, content: messageContent };
        drone.publish({ room: room.name, message: { type: 'chatMessage', message } });
        chatInput.value = ''; // Clear input
    }
}

function handleMessage(message) {
    if (message.data.type === 'newPlayer') {
        players.push(message.data.name);
        updatePlayers();
        if (message.data.isHost) {
            isHost = true;
            hostControlsDiv.style.display = 'block';
        }
    } else if (message.data.type === 'roleAssigned') {
        if (message.data.name === playerName) {
            alert(`You are a ${message.data.role}!`);
        }
    } else if (message.data.type === 'startGame') {
        startGame();
    } else if (message.data.type === 'kicked') {
        alert(`${message.data.name} has been kicked from the game.`);
        players = players.filter(p => p !== message.data.name);
        updatePlayers();
    } else if (message.data.type === 'chatMessage') {
        displayChatMessage(message.data.message);
    }
}

function startGame() {
    if (players.length < 5) return alert('Need at least 5 players to start!');
    
    gameState = 'game';
    assignRoles();
    updateGameStatus('Game has started! Roles are assigned.');
    currentPresident = players[0]; // Set the first player as the president
    initiateChancellorSelection();
}

function assignRoles() {
    const roleCount = players.length >= 6 ? 3 : 2; // 3 Fascists for 6+ players
    roles = ['Liberal'.repeat(players.length - roleCount).split(''), 
             'Fascist'.repeat(roleCount).split(''), 
             'Hitler'].flat();
    roles.sort(() => Math.random() - 0.5);
    
    players.forEach((player, index) => {
        drone.publish({ room: room.name, message: { type: 'roleAssigned', name: player, role: roles[index] } });
    });
}

function initiateChancellorSelection() {
    updateGameStatus(`President ${currentPresident}, select a Chancellor.`);
    const chancellorOptions = players.filter(p => p !== currentPresident).map(p => `
        <button onclick="selectChancellor('${p}')">${p}</button>
    `).join('');
    
    document.getElementById('chancellorSelection').innerHTML = chancellorOptions;
}

function selectChancellor(chancellor) {
    currentChancellor = chancellor;
    updateGameStatus(`${currentPresident} has selected ${currentChancellor} as Chancellor. Starting voting...`);
    initiateVoting();
}

function kickPlayer(kickedPlayer) {
    if (!isHost) return alert('Only the host can kick players.');
    if (!players.includes(kickedPlayer)) return alert('Player not found.');

    players = players.filter(p => p !== kickedPlayer);
    drone.publish({ room: room.name, message: { type: 'kicked', name: kickedPlayer } });
    updatePlayers();
}

function initiateVoting() {
    votes = {};
    updateGameStatus(`Voting for Chancellor: ${currentChancellor}. Please cast your vote (yes/no):`);
    
    // Display voting buttons
    document.getElementById('voteButtons').innerHTML = `
        <button id="voteYes">Yes</button>
        <button id="voteNo">No</button>
    `;
    document.getElementById('voteButtons').style.display = 'block';

    document.getElementById('voteYes').onclick = () => handleVoteClick('yes');
    document.getElementById('voteNo').onclick = () => handleVoteClick('no');
}

function handleVoteClick(vote) {
    handleVote({ voter: playerName, vote });
}

function handleVote(voteData) {
    votes[voteData.voter] = voteData.vote;
    drone.publish({ room: room.name, message: voteData });

    if (Object.keys(votes).length === players.length) {
        finalizeVoting();
    }
}

function finalizeVoting() {
    const yesVotes = Object.values(votes).filter(v => v === 'yes').length;
    const noVotes = players.length - yesVotes;

    if (yesVotes > noVotes) {
        updateGameStatus(`${currentChancellor} is elected! Enacting policy...`);
        document.getElementById('voteButtons').style.display = 'none';
        enactPolicyPrompt();
    } else {
        updateGameStatus(`Vote failed. Next round.`);
        currentPresident = getNextPresident(); // Move to next president
        initiateChancellorSelection();
    }
}

function getNextPresident() {
    const currentIndex = players.indexOf(currentPresident);
    return players[(currentIndex + 1) % players.length]; // Rotate president
}

function enactPolicyPrompt() {
    const policy = prompt(`Select a policy to enact (liberal/fascist):`);
    enactPolicy(policy);
}

function enactPolicy(policy) {
    if (policy === 'liberal' || policy === 'fascist') {
        policiesPassed[policy]++;
        drone.publish({ room: room.name, message: { type: 'policyEnacted', policy } });
        checkWinCondition();
    } else {
        alert('Invalid policy. Choose liberal or fascist.');
        enactPolicyPrompt();
    }
}

function checkWinCondition() {
    if (policiesPassed.liberal === 5) {
        endGame('Liberals');
    } else if (policiesPassed.fascist === 3) {
        endGame('Fascists');
    }
}

function endGame(winner) {
    gameState = 'end';
    updateGameStatus(`${winner} win!`);
    drone.publish({ room: room.name, message: { type: 'gameEnd', winner } });
}

function updateGameStatus(status) {
    document.getElementById('gameStatus').innerText = status;
}

function updatePlayers() {
    playerListDiv.innerHTML = players.map(p => `
        <div>${p} ${isHost ? `<button onclick="kickPlayer('${p}')">Kick</button>` : ''}</div>
    `).join('');
}

function displayChatMessage(message) {
    const chatMessagesDiv = document.getElementById('chatMessages');
    chatMessagesDiv.innerHTML += `<div><strong>${message.name}:</strong> ${message.content}</div>`;
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Auto-scroll
}
