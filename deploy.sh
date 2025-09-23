#!/bin/bash

set -e

# The number of MongoDB replicas to the first argument passed to the script, or defaults to 3
export REPLICA_COUNT=${1:-3}

kubectl apply -f ./mongo/mongo-secrets.yaml

# Extract credentials from the secret (single source of truth)
echo "Extracting MongoDB credentials from secret..."
MONGO_USER=$(kubectl get secret mongo-secret -o jsonpath='{.data.mongo-user}' | base64 --decode)
MONGO_PASSWORD=$(kubectl get secret mongo-secret -o jsonpath='{.data.mongo-password}' | base64 --decode)

echo "Using MongoDB credentials from secret: user=${MONGO_USER}"

MONGO_REPLICAS=""
MEMBERS="["
for ((i=0; i<$REPLICA_COUNT; i++)); do
  MEMBERS+="{ _id: $i, host: \"mongo-statefulset-$i.mongo-service:27017\" }"
  MONGO_REPLICAS+="mongo-statefulset-$i.mongo-service:27017"
  if [ $i -lt $((REPLICA_COUNT-1)) ]; then
    MEMBERS+=", "
    MONGO_REPLICAS+=","
  fi
done
MEMBERS+="]"
MONGO_REPLICAS+="/?replicaSet=rs0&authSource=admin"

export MONGO_RS_MEMBERS="$MEMBERS"
export MONGO_URI_REPLICAS="$MONGO_REPLICAS"

echo "Using $REPLICA_COUNT MongoDB replicas"
echo "Replica set members: $MEMBERS"

kubectl apply -f ./mongo/mongo-config.yaml
kubectl apply -f ./mongo/mongo-service.yaml
envsubst '$REPLICA_COUNT' < ./mongo/mongo-app.yaml | kubectl apply -f -

echo "Waiting for all MongoDB pods to be ready..."
kubectl wait --for=condition=ready pod -l app=mongo --timeout=300s

echo "Waiting additional 15 seconds for DNS propagation..."
sleep 15

echo "Verifying MongoDB instances are accessible..."
for ((i=0; i<$REPLICA_COUNT; i++)); do
  echo "Checking mongo-statefulset-$i..."
  kubectl exec mongo-statefulset-0 -- timeout 10 \
    mongo --host mongo-statefulset-$i.mongo-service:27017 --eval "db.runCommand('ping')" || {
      echo "Warning: mongo-statefulset-$i is not accessible yet, waiting..."
      sleep 10
    }
done

# Initialize replica set with retry logic
echo "Initializing MongoDB replica set..."
INIT_SUCCESS=false
MAX_RETRIES=5
RETRY_COUNT=0

while [ "$INIT_SUCCESS" != "true" ] && [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  echo "Attempt $((RETRY_COUNT + 1)) to initialize replica set..."
  
  if kubectl exec mongo-statefulset-0 -- \
    mongo --host mongo-statefulset-0.mongo-service --eval "
    try {
      var result = rs.initiate({
        _id: 'rs0',
        members: $MONGO_RS_MEMBERS
      });
      if (result.ok === 1) {
        print('SUCCESS: Replica set initialized');
      } else {
        print('ERROR: ' + result.errmsg);
        quit(1);
      }
    } catch (e) {
      print('ERROR: ' + e);
      quit(1);
    }
    "; then
    echo "Replica set initialization successful!"
    INIT_SUCCESS=true
  else
    echo "Replica set initialization failed, retrying in 15 seconds..."
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 15
  fi
done

if [ "$INIT_SUCCESS" != "true" ]; then
  echo "ERROR: Failed to initialize replica set after $MAX_RETRIES attempts"
  echo "Trying alternative approach: initialize with primary only, then add members..."
  
  # Initialize with primary only
  kubectl exec mongo-statefulset-0 -- \
    mongo --host mongo-statefulset-0.mongo-service --eval "
    rs.initiate({
      _id: 'rs0',
      members: [{ _id: 0, host: 'mongo-statefulset-0.mongo-service:27017' }]
    })
    "
  
  # Add other members one by one
  for ((i=1; i<$REPLICA_COUNT; i++)); do
    echo "Adding mongo-statefulset-$i to replica set..."
    kubectl exec mongo-statefulset-0 -- \
      mongo --host mongo-statefulset-0.mongo-service --eval "
      rs.add('mongo-statefulset-$i.mongo-service:27017')
      "
    sleep 5
  done
fi

echo "Waiting for a primary to be elected and ready for writes..."

# Wait until a primary exists
PRIMARY=""
while [ -z "$PRIMARY" ]; do
  PRIMARY=$(kubectl exec mongo-statefulset-0 -- \
    mongo --quiet --host mongo-statefulset-0.mongo-service --eval 'rs.isMaster().primary' 2>/dev/null)
  if [ -z "$PRIMARY" ]; then
    echo "No primary yet, waiting 3 seconds..."
    sleep 3
  fi
done

echo "Primary detected: $PRIMARY"

# Ensure the primary is accepting writes
kubectl exec mongo-statefulset-0 -- \
  bash -c "until mongo --host $PRIMARY --quiet --eval 'db.adminCommand({ping:1})' 2>/dev/null | grep -q 1; do
    echo 'Waiting for primary to accept writes...'; sleep 3
  done"

echo "Creating MongoDB user: ${MONGO_USER}"
kubectl exec -i mongo-statefulset-0 -- mongo --host "$PRIMARY" <<EOF
use admin
db.createUser({
  user: "$MONGO_USER",
  pwd: "$MONGO_PASSWORD",
  roles: [{ role: "root", db: "admin" }]
})
EOF

echo "MongoDB user creation completed on primary: $PRIMARY"

echo "Deploying Redis..."
kubectl apply -f ./redis/redis-config.yaml
kubectl apply -f ./redis/redis-deployment.yaml
kubectl apply -f ./redis/redis-service.yaml

echo "Deploying Node.js application..."
envsubst '$MONGO_URI_REPLICAS' < node-deployment.yaml | kubectl apply -f -
kubectl apply -f node-service.yaml

echo "Deployment completed successfully!"