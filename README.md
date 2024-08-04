# YTNotes Backend

To Run: 
- for each yaml file, run the following: `kubectl apply -f <filename>.yaml`
- Then run `minikube service nodeapp-service`

Right now, this k8s cluster is not deployed anywhere because I can't find a free cloud VM to use that doesn't need me to put in my credit card. Additionally, the free tier for other services are too restrictive in what I can do. As such, feel free to clone this repo and run the above command (make sure to install Docker, kubectl, and minikube on your local machine). At the end of the day, this is just a personal project for me to learn!