const drone = new Scaledrone('ptsqRZDha7XGR4Op'); // Replace with your Scaledrone channel ID
const room = drone.subscribe('secret-hitler');

let playerName = '';
let players = [];
let roles = [];
let gameState = 'lobby'; // States: lobby, game, voting, enactPolicy, end
let currentChancellor = null;
let votes = {};
let policiesPassed = { liberal: 0, fascist: 0 };

document.getElementById('joinButton').addEventListener('click', joinGame);
document.getElementById('sendMessageButton').addEventListener('click', sendMessage);

room.on('message', handleMessage);

function joinGame() {
    playerName = document.getElementById('playerName').value.trim();
    if (playerName) {
        players.push(playerName);
        updatePlayers();
        drone.publish({ room: 'secret-hitler', message: { type: 'newPlayer', name: playerName } });
        if (players.length >= 5 && gameState === 'lobby') {
            startGame();
        }
    }
}

function sendMessage() {
    const messageContent = document.getElementById('chatInput').value.trim();
    if (messageContent) {
        const message = { name: playerName, content: messageContent };
        drone.publish({ room: 'secret-hitler', message: { type: 'chatMessage', message } });
        document.getElementById('chatInput').value = ''; // Clear input
    }
}

function handleMessage(message) {
    if (message.data.type === 'newPlayer') {
        players.push(message.data.name);
        updatePlayers();
    } else if (message.data.type === 'roleAssigned') {
        alert(`${message.data.name}, you are a ${message.data.role}!`);
    } else if (message.data.type === 'startVoting') {
        initiateVoting();
    } else if (message.data.type === 'vote') {
        handleVote(message.data);
    } else if (message.data.type === 'policyEnacted') {
        enactPolicy(message.data.policy);
    } else if (message.data.type === 'gameEnd') {
        endGame(message.data.winner);
    } else if (message.data.type === 'chatMessage') {
        displayChatMessage(message.data.message);
    }
}

function startGame() {
    if (players.length < 5) return alert('Need at least 5 players to start!');
    gameState = 'game';
    assignRoles();
    updateGameStatus('Game has started! Roles are assigned.');
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    initiateVoting();
}

function assignRoles() {
    const roleCount = players.length >= 6 ? 3 : 2; // 3 Fascists for 6+ players
    roles = ['Liberal'.repeat(players.length - roleCount).split(''), 'Fascist'.repeat(roleCount).split(''), 'Hitler'].flat();
    roles.sort(() => Math.random() - 0.5);
    players.forEach((player, index) => {
        drone.publish({ room: 'secret-hitler', message: { type: 'roleAssigned', name: player, role: roles[index] } });
    });
}

function initiateVoting() {
    currentChancellor = players[Math.floor(Math.random() * players.length)];
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
    drone.publish({ room: 'secret-hitler', message: voteData });

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
        initiateVoting();
    }
}

function enactPolicyPrompt() {
    const policy = prompt(`Select a policy to enact (liberal/fascist):`);
    enactPolicy(policy);
}

function enactPolicy(policy) {
    if (policy === 'liberal' || policy === 'fascist') {
        policiesPassed[policy]++;
        drone.publish({ room: 'secret-hitler', message: { type: 'policyEnacted', policy } });
        checkWinCondition();
    } else {
        alert('Invalid policy. Choose liberal or fascist.');
        enactPolicyPrompt();
    }
}

function enactPolicy(policy) {
    policiesPassed[policy]++;
    document.getElementById('policyResult').innerText = `${policy.charAt(0).toUpperCase() + policy.slice(1)} policy enacted.`;
    document.getElementById('policyArea').style.display = 'block';
    checkWinCondition();
    setTimeout(() => {
        document.getElementById('policyArea').style.display = 'none';
        initiateVoting();
    }, 2000);
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
    drone.publish({ room: 'secret-hitler', message: { type: 'gameEnd', winner } });
}

function updateGameStatus(status) {
    document.getElementById('gameStatus').innerText = status;
}

function updatePlayers() {
    document.getElementById('players').innerHTML = players.map(p => `<div>${p}</div>`).join('');
}

function displayChatMessage(message) {
    const chatMessagesDiv = document.getElementById('chatMessages');
    chatMessagesDiv.innerHTML += `<div><strong>${message.name}:</strong> ${message.content}</div>`;
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Auto-scroll
}
