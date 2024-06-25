const { MONGO_USER, MONGO_PASSWORD, MONGO_IP, MONGO_PORT, REDIS_URL, REDIS_PORT } = require('./config/config');
const Note = require('./models/noteModel');

const app = require('express')();
const mongoose = require('mongoose');
const redis = require("redis");
const port = process.env.PORT || 3000;

// trust the proxy, or nginx
app.enable("trust proxy");

app.use(require('cors')());

const redisClient = redis.createClient({
    host: REDIS_URL,
    port: REDIS_PORT
});

// redisClient.on('error', (err) => console.log('Redis Client Error', err));

const connectWithRetryMongoose = () => {
    mongoose.connect(`mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/?authSource=admin`)
        .then(() => console.log('Connected to database'))
        .catch((err) => {
            console.log(err);
            setTimeout(connectWithRetryMongoose, 5000)
        });
}

// const connectWithRetryRedis = () => {
//     redisClient.connect()
//         .then(() => console.log("Successfully connected to redis"))
//         .catch((err) => {
//             console.log(err);
//             setTimeout(connectWithRetryRedis, 5000)
//         });
// }

connectWithRetryMongoose();
// connectWithRetryRedis();

app.get('/api', (req, res) => {
    res.send('<h2>Hello World!!!!!!!!!!!!!!!</h2>');
});

app.get('/api/notes/:chrome_identity_id/:video_id', (req, res, next) => {
    const { chrome_identity_id, video_id } = req.params;

    redisClient.get(chrome_identity_id, (err, notes) => {
        if(err) {
            console.log(err);
            throw err;
        }

        if(notes !== null) {
            return res.status(200).json(JSON.parse(notes));
        } else {
            Note.find({chrome_identity_id, video_id}, (err, notes) => {
                if (err) {
                    return next(err);
                }
        
                // cache notes in redis
                redisClient.set(chrome_identity_id+","+video_id, JSON.stringify(notes), (err, reply) => {
                    if(err) {
                        console.log(err);
                        throw err;
                    }
        
                    console.log("Get notes from cache!");
                });
        
                res.status(200).json(notes);
            });
        }
    });
});

app.post("/api/notes/:chrome_identity_id/:video_id/:note/:timestamp", (req, res, next) => {
    const { chrome_identity_id, video_id, note, timestamp } = req.params;

    Note.create({chrome_identity_id, video_id, note, timestamp}, (err, note) => {
        if (err) {
            return next(err);
        }

        redisClient.get(chrome_identity_id+","+video_id, (err, notes) => {
            if(err) {
                console.log(err);
                throw err;
            }
    
            if(notes !== null) {
                let cachedNotes = JSON.parse(notes);
                cachedNotes.push(note);

                redisClient.set(chrome_identity_id+","+video_id, JSON.stringify(cachedNotes), (err, reply) => {
                    if(err) {
                        console.log(err);
                        throw err;
                    }
        
                    console.log("Added new note to cache!");
                });
            }
        });

        res.status(201).json(note);
    })
});


app.patch("/api/notes/:chrome_identity_id/:video_id/:text/:timestamp", (req, res, next) => {
    const { chrome_identity_id, video_id, text, timestamp } = req.params;

    Note.findOneAndUpdate({chrome_identity_id, video_id, timestamp}, {note: text}, {new: true}, (err, note) => {
        if (err) {
            return next(err);
        }

        redisClient.get(chrome_identity_id + "," + video_id, (err, notes) => {
            if(err) {
                console.log(err);
                throw err;
            }
    
            if(notes !== null) {
                let cachedNotes = JSON.parse(notes);

                let noteToUpdateIdx = cachedNotes.findIndex(cachedNote => cachedNote.chrome_identity_id === chrome_identity_id && cachedNote.video_id === video_id && cachedNote.timestamp === parseInt(timestamp));

                cachedNotes[noteToUpdateIdx].note = text;

                redisClient.set(chrome_identity_id+","+video_id, JSON.stringify(cachedNotes), (err, reply) => {
                    if(err) {
                        console.log(err);
                        throw err;
                    }
        
                    console.log("Updated note in cache!");
                });
            }
        });

        res.status(200).json(note);
    })
});

app.delete("/api/notes/:chrome_identity_id/:video_id/:timestamp", (req, res, next) => {
    const { chrome_identity_id, video_id, timestamp } = req.params;

    Note.findOneAndRemove({chrome_identity_id, video_id, timestamp}, (err, note) => {
        if (err) {
            return next(err);
        }

        redisClient.get(chrome_identity_id+","+video_id, (err, notes) => {
            if(err) {
                console.log(err);
                throw err;
            }
    
            if(notes !== null) {
                let cachedNotes = JSON.parse(notes);

                let updatedCacheNotes = cachedNotes.filter(cachedNote => cachedNote.chrome_identity_id !== chrome_identity_id && cachedNote.video_id !== video_id && cachedNote.timestamp !== timestamp);

                redisClient.set(chrome_identity_id+","+video_id, JSON.stringify(updatedCacheNotes), (err, reply) => {
                    if(err) {
                        console.log(err);
                        throw err;
                    }
        
                    console.log("Deleted note in cache!");
                });
            }
        });

        res.status(200).json({status: "successful"});
    })
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});