# YTNotes Backend

To run on `minikube`: 
- First start minikube
- Run the script `deploy.sh <number of mongo pods> <number of Node server pods>`
    - Both numbers are optional (both default to 3)

To interact with API:
- Run `minikube service nodeapp-service` to get URL
    - Use the URL with localhost (or `127.0.0.1`)

To teardown:
- Run the script `teardown.sh`

Right now, this k8s cluster is not deployed anywhere because I can't find a free cloud VM to use that doesn't need me to put in my credit card. Additionally, the free tier for other services are too restrictive in what I can do. As such, feel free to clone this repo and run the above command (make sure to install Docker, kubectl, and minikube on your local machine). At the end of the day, this is just a personal project for me to learn!