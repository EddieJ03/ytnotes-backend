# YTNotes Backend

This Kubernetes cluster consists of: a Node.js server, a Redis cache and Mongo replica set.

To run on `minikube`: 
- First start minikube
- Run the script `deploy.sh <number of mongo pods> <number of Node server pods>`
    - Both numbers are optional (both default to 3)

To interact with API:
- Run `minikube service nodeapp-service` to get URL
    - Use the URL with localhost (or `127.0.0.1`)

    - API Endpoints:
        - GET `/api/notes/:chrome_identity_id/:video_id`
            - Get all the notes stored for a particular chrome ID and video ID
        - POST `/api/notes/:chrome_identity_id/:video_id/:text/:timestamp`
            - Add a new note for a particular chrome ID and video ID 
        - PATCH `/api/notes/:chrome_identity_id/:video_id/:text/:timestamp`
            - Update a note for a particular chrome ID and video ID 
        - DELETE `/api/notes/:chrome_identity_id/:video_id/:text/:timestamp`
            - Delete a note for a particular chrome ID and video ID 

To teardown:
- Run the script `teardown.sh`

Right now, this k8s cluster is not deployed anywhere because I can't find a free cloud VM to use that doesn't need me to put in my credit card. Additionally, the free tier for other services are too restrictive in what I can do. As such, feel free to clone this repo and run the above command (make sure to install Docker, kubectl, and minikube on your local machine). At the end of the day, this is just a personal project for me to learn!