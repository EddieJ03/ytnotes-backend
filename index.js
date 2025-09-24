const { MONGO_USER, MONGO_PASSWORD, MONGO_URI_REPLICAS, REDIS_URL, REDIS_PORT } = require('./config/config');
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

const connectWithRetryMongoose = () => {
    mongoose.connect(`mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_URI_REPLICAS}`, {
        readPreference: 'secondaryPreferred',
    })
        .then(() => console.log('Connected to database'))
        .catch((err) => {
            console.log(err);
            setTimeout(connectWithRetryMongoose, 5000)
        });
}

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});
redisClient.on('connect', () => {
    console.log('Redis client connected');
});
redisClient.on('ready', () => {
    console.log('Redis client ready to use');
});

connectWithRetryMongoose();

app.get('/', (req, res) => {
    res.send('<h2>Hello World!!!!!!!!!!!!!!!</h2>');
});

app.get('/api/notes/:chrome_identity_id/:video_id', (req, res, next) => {
    const { chrome_identity_id, video_id } = req.params;

    redisClient.get(chrome_identity_id+","+video_id, (err, notes) => {
        if(err) {
            console.log(err);
            throw err;
        }

        if(notes !== null) {
            console.log(`Got notes for chrome ID ${chrome_identity_id} and video ID ${video_id} from cache!`);
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

                    console.log(`Caching notes for chrome ID ${chrome_identity_id} and video ID ${video_id}`);
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
        
                    console.log(`Added new note for chrome ID ${chrome_identity_id} and video ID ${video_id} to cache!`);
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
        
                    console.log(`Updated note for chrome ID ${chrome_identity_id} and video ID ${video_id} in cache!`);
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
        
                    console.log(`Deleted note for chrome ID ${chrome_identity_id} and video ID ${video_id} from cache!`);
                });
            }
        });

        res.status(200).json({status: "successful"});
    })
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});