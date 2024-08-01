require("dotenv").config();
const TMDB_API_KEY = process.env.TMDB_API_KEY || "61cd7f818c186171c87ea6bf6826fe66";
const axios = require("axios");

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;
initializeMovieList();

app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

async function fetchMovies(page = 1, sortBy = "popularity.desc") {
    let url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&sort_by=${sortBy}&page=${page}`;
    let services = ['Netflix','Max','Disney Plus','fuboTV'];
    try {
        const response = await axios.get(url);
        const movies = await Promise.all(
            response.data.results.map(async (movie) => {
                const detailsUrl = `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=images,watch/providers`;
                const detailsResponse = await axios.get(detailsUrl);
                const watchProviders = detailsResponse.data['watch/providers']?.results?.US?.flatrate || [];
                if (watchProviders.length === 0) {
                    return null;
                }
                if (!watchProviders.some(provider => services.includes(provider.provider_name))) {
                    return null;
                }

                movie.poster_path = detailsResponse.data.poster_path
                    ? `https://image.tmdb.org/t/p/w500/${detailsResponse.data.poster_path}`
                    : null;
                movie.streamingServices = watchProviders.map(provider => provider.provider_name);
                
                return movie;
            })
        );
        return movies.filter(movie => movie !== null);
    }
    catch (error) {
        console.error("Error fetching movies:", error);
        throw error;
    }
}
async function initializeMovieList() {
    try {
        for (let page = 1; page <= 30; page++) { 
            const movies = await fetchMovies(page);
            rawMovieList = rawMovieList.concat(movies);
            filtered = filtered.concat(movies);
        }
        console.log("Movie list initialized with", rawMovieList.length, "movies");
        io.emit('movieListReady');
        rawMovieList.slice(1,2).forEach(item => {console.log(item)});

    } 
    catch (error) {
        console.error("Failed to initialize movie list:", error);
    }
}

let answers = Array.from({length: 100}, () => []);
let finalAnswers = Array(100);
let preferences = {};
let userDirectory = {};
let users = [];
let rawMovieList = [];
let filtered = [];
let labels = Array.from({length: 100}, () => []);
const genres = {
    'Action':28,
    'Adventure':12,
    'Animation':16,
    'Comedy':35,
    'Crime':80,
    'Documentary':99,
    'Drama':18,
    'Family':10751,
    'Fantasy':14,
    'History':36,
    'Horror':27,
    'Music':10402,
    'Mystery':9648,
    'Romance':10749,
    'Science Fiction':878,
    'TV Movie':10770,
    'Thriller':53,
    'War':10752,
    'Western':37
};
let popular = null;
let newer = null;
let secondary = null;
let primary = null;
let currentQuestionIndex = 0;

function calculateAnswerDistribution(index) {
    const answerDistribution = [];
    let current = labels[index];
    let options = new Set(current);
    options.forEach((option) => {
        var num = 0;
        for (const element of current) {
            if (option===element) {
                num++;
            }
        }
        answerDistribution.push({answer:option, count:num});
    });
    return answerDistribution;
}

io.on('connection', (socket) => {
    userDirectory[socket.id] = '';
    console.log(`A user connected: ${socket.id}`);
    socket.emit('updateGameQuestionIndex', currentQuestionIndex);
    socket.on('disconnect', () => {
        console.log(`A user disconnected: ${socket.id}`);
        users = users.filter(user => user.id !== socket.id);
        delete preferences[socket.id];
        delete userDirectory[socket.id];
        answers.forEach((answerList, index) => {
            answerList.shift();
        })
        labels.forEach((answerList, index) => {
            answerList.shift();
        })
        console.log('answers: ',answers);
        io.emit('addedUser', users);
        console.log('updated user list',users);
        if (users.length < 1) {
            rawMovieList = [];
            filtered = [];
            initializeMovieList();
        }
    });
    socket.on('message', (message) => {
        console.log('recieved message:', message);
    });
    socket.on('user entered:', (username, icon) => {
        console.log('recieved username:', username, 'icon:', icon);
        preferences[socket.id] = [];
        userDirectory[socket.id] = [username, icon];
        users.push({ id: socket.id, username, icon });
        io.emit('addedUser', users);
    });
    socket.on('host entered:', (username, icon) => {
        console.log('recieved host:', username, 'icon:', icon);
        hostSocket = socket.id;
        preferences[socket.id] = [];
        userDirectory[socket.id] = [username, icon];
        socket.emit('isHost');
        users.push({ id: socket.id, username, icon });
        io.emit('addedUser', users);
    });
    socket.on('requestUsers', () => {
        socket.emit('addedUser', users);
    });
    socket.on('preference', (entry) => {
        console.log('recieved preference:', entry);
        preferences[socket.id].push(entry);
    });
    socket.on('getPreferences', () => {
        console.log('all preferences:', preferences)
    });
    socket.on('label', (questionIndex, label) => {
        labels[questionIndex].push(label);
    })
    socket.on('answer', (questionIndex, answer) => {
        console.log('recieved answer:', answer);
        answers[questionIndex].push(answer);
        if (answers[questionIndex].length===users.length) {
            if ((questionIndex%3===0 && questionIndex!==0) || questionIndex>10) {
                let confirm = 0;
                let deny = 0;
                for (const entry of answers[questionIndex]) {
                    console.log('answer is', entry);
                    if (entry==='Pick') {
                        confirm+=1;
                    }
                    else if (entry==='Pass') {
                        deny+=1;
                    }
                }
                if (confirm>deny) {
                    console.log('majority chose pick');
                    io.emit('movieChosen');
                }
            }
            else {
                const freq = {};
                answers[questionIndex].forEach(choice => {
                    freq[choice] = (freq[choice] || 0) + 1;
                });
                let topChoice = null;
                let maxCount = 0;
                for (const [a,c] of Object.entries(freq)) {
                    if (c > maxCount) {
                        topChoice = a;
                        maxCount = c;
                    }
                }
                console.log('top choice:', topChoice);
                finalAnswers[questionIndex] = topChoice;
            }
            currentQuestionIndex++;
            io.emit('updateGameQuestionIndex', currentQuestionIndex);
            io.emit('allUsersAnsweredGame');
        }
    });
    socket.on('applyAnswers', (index) => {
        index--;
        console.log("answers being applied for", index);
        if (index===0) {
            if (finalAnswers[index]==='popular') {
                popular = true;
            }
            else {
                popular = false;
                filtered.sort((a, b) => {
                    console.log(a.rating-b.rating);
                    return a.rating - b.rating;
                });
            }
            console.log("popular is:", popular);
        }
        else if (index===1) {
            if (finalAnswers[index]==='new') {
                newer = true;
                filtered.sort((a, b) => {
                    if (popular) {
                        if(Math.abs(a.rating-b.rating) > 100) {
                            return a.rating - b.rating;
                        }
                        let aDate = a.release_date.substring(0,4) + a.release_date.substring(5,7) + a.release_date.substring(8,10);
                        let bDate = b.release_date.substring(0,4) + b.release_date.substring(5,7) + b.release_date.substring(8,10);
                        return parseInt(aDate) - parseInt(bDate);
                    }
                    else {
                        if(Math.abs(a.rating-b.rating) > 100) {
                            return b.rating - a.rating;
                        }
                        let aDate = a.release_date.substring(0,4) + a.release_date.substring(5,7) + a.release_date.substring(8,10);
                        let bDate = b.release_date.substring(0,4) + b.release_date.substring(5,7) + b.release_date.substring(8,10);
                        return parseInt(aDate) - parseInt(bDate);
                    }  
                });
            }
            else {
                newer = false;
                filtered.sort((a, b) => {
                    if (popular) {
                        if(Math.abs(a.rating-b.rating) > 100) {
                            return a.rating - b.rating;
                        }
                        let aDate = a.release_date.substring(0,4) + a.release_date.substring(5,7) + a.release_date.substring(8,10);
                        let bDate = b.release_date.substring(0,4) + b.release_date.substring(5,7) + b.release_date.substring(8,10);
                        return parseInt(bDate) - parseInt(aDate);
                    }
                    else {
                        if(Math.abs(a.rating-b.rating) > 100) {
                            return b.rating - a.rating;
                        }
                        aDate = a.release_date.substring(0,4) + a.release_date.substring(5,7) + a.release_date.substring(8,10);
                        bDate = b.release_date.substring(0,4) + b.release_date.substring(5,7) + b.release_date.substring(8,10);
                        return parseInt(bDate) - parseInt(aDate);
                    }
                });
            }
            console.log("newer is:", newer);
        }
        else {
            if (finalAnswers[index]!==null) {
                secondary = primary;
                primary = genres[finalAnswers[index]];
                console.log('genres are:', primary, secondary);
                filtered.sort((a, b) => {
                    const sortValue = genreSort(a, b);
                    if (sortValue!==0) return sortValue;
                    customSort(a, b);
                });

                function hasGenres(movie, prim, sec) {
                    const hasPrimary = movie.genre_ids.includes(primary);
                    const hasSecondary = movie.genre_ids.includes(sec);
                    return {hasPrimary, hasSecondary}
                }
                function genreSort(a, b) {
                    const aGenres = hasGenres(a, primary, secondary);
                    const bGenres = hasGenres(b, primary, secondary);

                    if (aGenres.hasPrimary && aGenres.hasSecondary) return -1;
                    if (bGenres.hasPrimary && bGenres.hasSecondary) return 1;

                    if (aGenres.hasPrimary) return -1;
                    if (bGenres.hasPrimary) return 1;

                    if (aGenres.hasSecondary) return -1;
                    if (bGenres.hasSecondary) return 1;

                    return 0;
                }
                function customSort(a, b) {
                    if (newer) {
                        filtered.sort((a, b) => {
                            filtered.sort((a, b) => {
                                if (popular) {
                                    if(Math.abs(a.rating-b.rating) > 100) {
                                        return a.rating - b.rating;
                                    }
                                    let aDate = a.release_date.substring(0,4) + a.release_date.substring(5,7) + a.release_date.substring(8,10);
                                    let bDate = b.release_date.substring(0,4) + b.release_date.substring(5,7) + b.release_date.substring(8,10);
                                    return parseInt(aDate) - parseInt(bDate);
                                }
                                else {
                                    if(Math.abs(a.rating-b.rating) > 100) {
                                        return b.rating - a.rating;
                                    }
                                    let aDate = a.release_date.substring(0,4) + a.release_date.substring(5,7) + a.release_date.substring(8,10);
                                    let bDate = b.release_date.substring(0,4) + b.release_date.substring(5,7) + b.release_date.substring(8,10);
                                    return parseInt(aDate) - parseInt(bDate);
                                }  
                            });
                        });
                    }
                    else {
                        filtered.sort((a, b) => {
                            if (popular) {
                                if(Math.abs(a.rating-b.rating) > 100) {
                                    return a.rating - b.rating;
                                }
                                let aDate = a.release_date.substring(0,4) + a.release_date.substring(5,7) + a.release_date.substring(8,10);
                                let bDate = b.release_date.substring(0,4) + b.release_date.substring(5,7) + b.release_date.substring(8,10);
                                return parseInt(bDate) - parseInt(aDate);
                            }
                            else {
                                if(Math.abs(a.rating-b.rating) > 100) {
                                    return b.rating - a.rating;
                                }
                                let aDate = a.release_date.substring(0,4) + a.release_date.substring(5,7) + a.release_date.substring(8,10);
                                let bDate = b.release_date.substring(0,4) + b.release_date.substring(5,7) + b.release_date.substring(8,10);
                                return parseInt(bDate) - parseInt(aDate);
                            }
                        });
                    }
                }
            }
        }
    });
    socket.on('getAnswers', () => {
        console.log('all answers:', answers);
    });
    socket.on('checkSurveyComplete', () => {
        const surveyLength = 3;
        for (key in preferences) {
            if (users.length<surveyLength) {
                return;
            }
        }
        io.emit('allUsersAnsweredSurvey');
    });
    socket.on('startGame', () => {
        currentQuestionIndex = 0;
        io.emit('updateGameQuestionIndex', currentQuestionIndex);
        io.emit('startGame');
    });
    socket.on('continueGame', () => {
        io.emit('continueGame');
    });
    socket.on('nextQuestion', () => {
        if (currentQuestionIndex%3===0 && currentQuestionIndex!==0) {
            let confirm = 0;
            let deny = 0;
            for (const entry of answers[currentQuestionIndex]) {
                console.log('answer is', entry);
                if (entry==='Pick') {
                    confirm+=1;
                }
                else if (entry==='Pass') {
                    deny+=1;
                }
            }
            if (confirm>deny) {
                console.log('majority chose pick');
                io.emit('movieChosen');
            }
        }
        else {
            const freq = {};
            answers[currentQuestionIndex].forEach(choice => {
                freq[choice] = (freq[choice] || 0) + 1;
            });
            let topChoice = null;
            let maxCount = 0;
            for (const [a,c] of Object.entries(freq)) {
                if (c > maxCount) {
                    topChoice = a;
                    maxCount = c;
                }
            }
            console.log('top choice:', topChoice);
            finalAnswers[currentQuestionIndex] = topChoice;
        }
        currentQuestionIndex++;
        io.emit('updateGameQuestionIndex', currentQuestionIndex);
        io.emit('allUsersAnsweredGame');
    });
    socket.on('pieChart', (index) => {
        index--;
        console.log('answer distribution for index :', index);
        socket.emit('answerDistribution', calculateAnswerDistribution(index));
    });
    socket.on('apply preferences', () => {
        let services = [];
        let languages = [];
        let ratings = [];
        for (key in preferences) {
            curr = preferences[key];
            services = services.concat(curr[0]);
            languages = languages.concat(curr[1]);
            ratings = ratings.concat(curr[2]);
        }
        services = new Set(services);
        languages = new Set(languages);
        ratings = new Set(ratings);
        let checkAdult = ratings.has("R");
        filtered = filtered.filter(movie => {
            return (
                movie.streamingServices.some(element => services.has(element)) &&
                movie.original_language === 'en' &&
                (checkAdult || !movie.adult)
            );
        });
    });
    socket.on('requestMovie', () => {
        let option = filtered.shift()
        console.log('sent movie', option);
        io.emit('movie', option);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});