function showScreen(screenId) {
    var screens = document.querySelectorAll('.screen');
    screens.forEach(function(screen) {
        screen.classList.remove('active')
    });
    var selectedScreen= document.getElementById(screenId);
    if (selectedScreen) {
        selectedScreen.classList.add('active');
    }
}
function collectInfo() {
    var username = document.getElementById('textInput').value;
    var code = document.getElementById('code').value;

    if (username.trim()==='') {
        alert('please fill out the prompts before continuing');
    }
    else {
        if (code==='178335') {
            socket.emit('user entered:', username, selectedIcon);
            showScreen("lobby-screen");
            launchLobby();
        }
        else if (code==='host') {
            socket.emit('host entered:', username, selectedIcon);
            showScreen("lobby-screen");
            launchLobby();
        }
        else {
            alert('please enter a valid join code')
        }
    }
}
function loadMovie(gameQuestionContainer, gameQuestionElement, gameAnswersContainer) {
    gameAnswersContainer.innerHTML = '';
    let selectedButton = null;
    const yes = document.createElement('button');
    yes.textContent = 'Pick';
    yes.classList.add('answer-button');
    yes.addEventListener('click', () => {
        userAnswer[0] = 'Pick';
        userAnswerLabel[0] = 'Pick';
        if (selectedButton) {
            selectedButton.style.backgroundColor = '#0066FF';
        }
        yes.style.backgroundColor = '#00317a';
        selectedButton = yes;
    });
    gameAnswersContainer.appendChild(yes);
    const no = document.createElement('button');
    no.textContent = 'Pass';
    no.classList.add('answer-button');
    no.addEventListener('click', () => {
        userAnswer[0] = 'Pass';
        userAnswerLabel[0] = 'Pass';
        if (selectedButton) {
            selectedButton.style.backgroundColor = '#0066FF';
        }
        no.style.backgroundColor = '#00317a';
        selectedButton = no;
    });
    gameAnswersContainer.appendChild(no);
    
    const description = document.createElement('div');
    description.textContent = currentMovie ? currentMovie.overview : 'No description available';
    const poster = document.createElement('img');
    poster.src = currentMovie ? currentMovie.poster_path : '';
    poster.alt = 'No cover available';
    poster.height = 600;
    poster.width = 400;

    gameQuestionElement.textContent = currentMovie ? currentMovie.original_title : 'No title available';
    gameQuestionContainer.appendChild(poster);
    gameQuestionContainer.appendChild(description)
}
function loadSurveyQuestion(preferences, currentSurveyQuestionIndex, surveyQuestionElement, surveyQuestions, surveyAnswersContainer) {

    const currentQuestion = surveyQuestions[currentSurveyQuestionIndex];
    surveyQuestionElement.textContent = currentQuestion.question;
    surveyAnswersContainer.innerHTML = '';

    currentQuestion.answers.forEach((answer, answerIndex) => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'answer';
        checkbox.value = answer;
        checkbox.id = `answer-${answerIndex}`;

        const label = document.createElement('label');
        label.textContent = answer;
        label.setAttribute('for', `answer-${answerIndex}`);

        const answerDiv = document.createElement('div');
        answerDiv.classList.add('answer-choice');
        answerDiv.appendChild(checkbox);
        answerDiv.appendChild(label);
        checkbox.addEventListener('click', () => {
            if (checkbox.checked) {
                preferences.push(answer);
            }
            else {
                const index = preferences.indexOf(answer);
                if (index !== -1) {
                    preferences.splice(index,1);
                }
            }
        });

        surveyAnswersContainer.appendChild(answerDiv);
    });
}
function launchLobby() {
    const surveyQuestionElement = document.getElementById('survey-question');
    const surveyAnswersContainer = document.getElementById('survey-answers-container');
    const nextSurveyQuestionButton = document.getElementById('next-survey-question-button');

    let currentSurveyQuestionIndex = 0;
    let surveyQuestions = [
        {
            question: 'What services do you have access to?',
            answers: ['Netflix','Max','Disney Plus','fuboTV']
        },
        {
            question: 'What language would you like to watch in?',
            answers: ['English','Spanish','Japanese','German']
        },
        {
            question: 'What rating do you want?',
            answers: ['R', 'PG-13', 'PG', 'G']
        }
    ];
    let preferences = [];

    loadSurveyQuestion(preferences, currentSurveyQuestionIndex, surveyQuestionElement, surveyQuestions, surveyAnswersContainer);
    
    nextSurveyQuestionButton.addEventListener('click', (event) => {
        event.preventDefault();
        socket.emit('preference', preferences);
        currentSurveyQuestionIndex ++;
        if (currentSurveyQuestionIndex < surveyQuestions.length) {
            preferences = [];
            loadSurveyQuestion(preferences, currentSurveyQuestionIndex, surveyQuestionElement, surveyQuestions, surveyAnswersContainer);
        }
        else {
            socket.emit('getPreferences');
            showScreen('end-survey');
            socket.emit('requestUsers');
            socket.emit('checkSurveyComplete');
        }
    });
}

const gameQuestionElement = document.getElementById('game-question');
const gameQuestionContainer = document.getElementById('game-question-container');
const gameAnswersContainer = document.getElementById('game-answers-container');
const answerLockButton = document.getElementById('answer-lock-button');

function loadGameQuestion(index) {
    socket.emit('message',`loading index ${index}`);
    if (index < gameQuestions.length) {
        const currentQuestion = gameQuestions[index];
        gameQuestionElement.textContent = currentQuestion.question;
        gameAnswersContainer.innerHTML = '';
        let selectedButton = null;
        currentQuestion.answers.forEach((answer, idx) => {
            const button = document.createElement('button');
            button.textContent = answer;
            button.classList.add('answer-button');
            button.addEventListener('click', () => {
                userAnswer[0] = currentQuestion.filters[idx];
                userAnswerLabel[0] = answer;
                if (selectedButton) {
                    selectedButton.style.backgroundColor = '#0066FF';
                }
                button.style.backgroundColor = '#00317a';
                selectedButton = button;
            });
            gameAnswersContainer.appendChild(button);
        });
    }
}
function initPieChart(data) {
    const labels = data.map(item => item.answer);
    const counts = data.map(item => item.count);
    var ctx = document.getElementById('pie-chart').getContext('2d');
    if (window.pieChart !== undefined) {
        window.pieChart.destroy();
    }
    window.pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Answer Distribution',
                data: counts,
                backgroundColor: [
                    '#6da5f7',
                    '#88e88b',
                    '#f07c7c',
                    '#ba76f6'
                ],
                borderColor: [
                    '#0066FF',
                    '#2AD731',
                    '#ff0000',
                    '#8800ff'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 1,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(tooltipItem) {
                            return tooltipItem.label + ': ' + tooltipItem.raw.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });
    console.log(counts);
    return window.pieChart;
}
function finalMovie() {
    const movieContainer = document.getElementById('movie-container');
    movieContainer.innerHTML = '';

    const poster = document.createElement('img');
    poster.src = currentMovie.poster_path || '';
    poster.alt = 'No cover available';
    poster.height = 600;
    poster.width = 400;
    movieContainer.appendChild(poster);
    const title = document.createElement('h1');
    title.textContent = currentMovie.original_title || '';
    title.style.marginTop = '20px';
    movieContainer.appendChild(title);
    const platform = document.createElement('h2');
    platform.textContent = `This title is avaliable on the following services: ${currentMovie.streamingServices}`;
    movieContainer.appendChild(platform);
}


const socket = io();
var currentGameQuestionIndex = 0;
var userAnswer = [''];
var userAnswerLabel = [''];
var currentMovie = null;
var hostId=null;
let gameQuestions = [
    {
        question: 'How do you discover new movies to watch?',
        answers: ['Top Charts', 'Recommendations From Friends', 'Favorite Small Forum', 'Get Lost Scrolling'],
        filters: ['popular','popular','rare','rare']
    },
    {
        question: 'Which movies are you drawn to?',
        answers: ['New Releases', 'First Watches', 'Rewatches', 'Classics'],
        filters: ['new','new','old','old']
    },
    {
        question: 'You want the main character to be...',
        answers: ['Witty', 'Romantic', 'Clever', 'Brave'],
        filters: ['Comedy','Romance','Mystery','Adventure']
    },{},
    {
        question: 'What kind of world do you prefer to explore in a movie?',
        answers: ['Futurstic', 'Exotic', 'Urban', 'Casual'],
        filters: ['Science Fiction','Adventure','Crime','Family']
    },
    {
        question: 'Which visual style do you prefer?',
        answers: ['Bright and Colorful', 'Gritty and Intense', 'Soft and Atmospheric', 'Dark and Suspenseful'],
        filters: ['Animation','War','Romance','War']
    },{},
    {
        question: 'How does a great movie end?',
        answers: ['Finding Treasure', 'Battle Won', 'Mystery Solved', 'Heartwarming Resolution'],
        filters: ['Adventure','War','Mystery','Family']
    },
    {
        question: 'What kind of plot twists do you enjoy?',
        answers: ['Clever Surprises', 'Sudden Crisis', 'Emotional Revelations', 'Unexpected Evidence'],
        filters: ['Comedy','Action','Drama','Crime']
    },{},
    {
        question: 'What type of conflict grabs your attention?',
        answers: ['Sheriff vs Outlaws', 'Humans vs Aliens', 'Parents vs Children', 'Heros vs Dragons'],
        filters: ['Westerm','Science Fiction','Family','Fantasy']
    },
    {
        question: 'Which type of soundtrack appeals to you?',
        answers: ['Upbeat and Catchy', 'Energetic and Driving', 'Eerie and Suspenseful', 'A Calm Voiceover'],
        filters: ['Musical','Action','Horror','Documentary']
    },{},
    {
        question: 'Which type of protagonist interests you the most?',
        answers: ['Futuristic Scientist', 'Treasure Hunter', 'Cunning Criminal', 'Superhero'],
        filters: ['Science Fiction','Adventure','Crime','Action']
    },
    {
        question: 'Which setting do you find most engaging?',
        answers: ['Narnia', 'City Streets', 'Battlefields', 'Everyday Life'],
        filters: ['Fantasy','Action','War','Drama']
    },{}
];
let movieChosen = false;
let selectedIcon = null;
document.getElementById('header-player-icon').className = `player-icon default`;
const iconSelector = document.getElementById('iconSelector');
iconSelector.addEventListener('click', (event) => {
    const clickedButton = event.target.closest('button');
    if (clickedButton) {
        iconSelector.querySelectorAll('button').forEach(button => {
            button.classList.remove('selected-icon');
        });
        clickedButton.classList.add('selected-icon');
        selectedIcon = clickedButton.getAttribute('data-icon');
        document.querySelectorAll('.player-icon').forEach(icon => {
            icon.className = `player-icon ${selectedIcon}`;
        });
        document.getElementById('header-player-icon').className = `player-icon ${selectedIcon}`;
    }
});

socket.on('allUsersAnsweredSurvey', () => {
    socket.emit('message', 'all users completed survey');
});
socket.on('updateGameQuestionIndex', (index) => {
    currentGameQuestionIndex=index;
    socket.emit('message',`index is ${index}`);
    if (currentGameQuestionIndex!==0) {
        if (currentGameQuestionIndex%3===0) {
            if (socket.id===hostId) {
                socket.emit('requestMovie');
            }
        }
        else if (currentGameQuestionIndex < gameQuestions.length) {
            loadGameQuestion(currentGameQuestionIndex);
        }
        else {
            if (socket.id===hostId) {
                socket.emit('requestMovie');
            }
        }
    }
    else {
        socket.emit('message', `index is ${index} and nothing happened`);
    }
});
socket.on('allUsersAnsweredGame', () => {
    socket.emit('message', 'all users answered the question');
    showScreen('chart-screen');
    socket.emit('applyAnswers', currentGameQuestionIndex);
    socket.emit('pieChart', currentGameQuestionIndex);
});
socket.on('answerDistribution', (data) => {
    initPieChart(data);
});
socket.on('isHost', () => {
    document.getElementById('startGameButton').style.display = 'block';
    document.getElementById('startGameButton').addEventListener('click', () => {
        socket.emit('startGame');
    });
    document.getElementById('continueButton').style.display = 'block';
    document.getElementById('continueButton').addEventListener('click', () => {
        socket.emit('continueGame');
    });
    document.getElementById('nextQuestionButton').style.display = 'block';
    document.getElementById('nextQuestionButton').addEventListener('click', () => {
        socket.emit('nextQuestion');
    })
    hostId = socket.id;
});
socket.on('startGame', () => {
    socket.emit('apply preferences');
    showScreen('game-screen');
    loadGameQuestion(currentGameQuestionIndex);

    answerLockButton.addEventListener('click', () => {
        if (userAnswer[0]!=='') {
            gameQuestionContainer.innerHTML = '';
            showScreen('game-wait-screen');
            socket.emit('answer', currentGameQuestionIndex, userAnswer[0]);
            socket.emit('label', currentGameQuestionIndex, userAnswerLabel[0]);
            userAnswerLabel[0] = '';
            userAnswer[0] = '';
        }
    });
});
socket.on('continueGame', () => {
    if (movieChosen) {
        showScreen('movie-screen');
        finalMovie();
    }
    else {
        showScreen('game-screen');
    }
});
socket.on('recievedIcon', (icon) => {
    applyStoredIcon(icon);
});
socket.on('addedUser', (users) => {
    const usersContainer = document.getElementById('users-container');
    usersContainer.innerHTML = '';
    users.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.classList.add('player-card');

        const playerIcon = document.createElement('div');
        playerIcon.classList.add('player-icon', player.icon || 'default');

        const playerName = document.createElement('div');
        playerName.classList.add('player-name');
        playerName.textContent = player.username;

        playerCard.appendChild(playerIcon);
        playerCard.appendChild(playerName);
        usersContainer.appendChild(playerCard);
    });
});
socket.on('movie', (movie) => {
    currentMovie = movie;
    loadMovie(document.getElementById('game-question-container'), document.getElementById('game-question'), document.getElementById('game-answers-container'));
});
socket.on('movieChosen', () => {
    movieChosen = true;
});
//display streaming platform with final movie