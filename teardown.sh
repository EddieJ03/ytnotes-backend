#!/bin/bash

set -e

echo "Cleaning up all resources..."

echo "Deleting Node.js application..."
kubectl delete deployment nodeapp-deployment --ignore-not-found=true
kubectl delete -f node-service.yaml --ignore-not-found=true

echo "Deleting Redis..."
kubectl delete -f redis-deployment.yaml --ignore-not-found=true
kubectl delete -f redis-service.yaml --ignore-not-found=true
kubectl delete -f redis-config.yaml --ignore-not-found=true

echo "Deleting MongoDB StatefulSet..."
kubectl delete statefulset mongo-statefulset --ignore-not-found=true --wait=true

echo "Deleting MongoDB persistent volume claims..."
kubectl delete pvc -l app=mongo --ignore-not-found=true

echo "Deleting MongoDB service and configs..."
kubectl delete -f mongo-service.yaml --ignore-not-found=true
kubectl delete -f mongo-config.yaml --ignore-not-found=true
kubectl delete -f mongo-secrets.yaml --ignore-not-found=true

echo "Verifying cleanup..."
echo "Remaining pods:"
kubectl get pods -l app=mongo -o wide 2>/dev/null || echo "No MongoDB pods found"
kubectl get pods -l app=redis -o wide 2>/dev/null || echo "No Redis pods found"  
kubectl get pods -l app=nodeapp -o wide 2>/dev/null || echo "No Node.js pods found"

echo "Remaining PVCs:"
kubectl get pvc -l app=mongo 2>/dev/null || echo "No MongoDB PVCs found"

echo "Cleanup completed successfully!"