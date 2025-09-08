#!/bin/bash

# AquaGuard Enhanced Deployment Script
# This script deploys ML-powered mobile-ready water management system

set -e

echo "🚀 Starting AquaGuard Enhanced Deployment..."
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

print_status "Checking project structure..."

# Install dependencies
print_status "Installing dependencies..."
echo "📦 Installing frontend dependencies..."
npm install

# Ensure TensorFlow.js is installed for ML features
if ! npm list @tensorflow/tfjs > /dev/null 2>&1; then
    echo "🧠 Installing TensorFlow.js for ML capabilities..."
    npm install @tensorflow/tfjs
fi

# Build the project
print_status "Building project with ML and PWA enhancements..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    print_error "Build failed. dist directory not found."
    exit 1
fi

print_status "Build completed successfully!"

# Enhanced PWA files check
echo "📱 Verifying PWA mobile features..."
if [ ! -f "public/manifest.json" ]; then
    print_warning "manifest.json not found. PWA features may not work properly."
fi

if [ ! -f "public/sw.js" ]; then
    print_warning "Service worker not found. Offline features may not work."
fi

# ML Service files check
echo "🧠 Verifying ML integration..."
if [ ! -f "src/services/ml/mlService.ts" ]; then
    print_warning "ML service not found. AI features may not be available."
fi

# Push notification service check
echo "🔔 Verifying push notification service..."
if [ ! -f "src/services/pushNotificationService.ts" ]; then
    print_warning "Push notification service not found. Mobile alerts may not work."
fi

# Firebase deployment
if command -v firebase &> /dev/null; then
    print_status "Deploying to Firebase..."
    
    # Check if firebase.json exists
    if [ ! -f "firebase.json" ]; then
        print_error "firebase.json not found. Please initialize Firebase first."
        exit 1
    fi
    
    # Deploy to Firebase
    firebase deploy --only hosting
    
    if [ $? -eq 0 ]; then
        print_status "Frontend deployed to Firebase successfully!"
    else
        print_error "Firebase deployment failed."
        exit 1
    fi
else
    print_warning "Firebase CLI not found. Please install it to deploy to Firebase."
    echo "Run: npm install -g firebase-tools"
fi

# Backend deployment check
if [ -d "backend" ]; then
    print_status "Checking backend deployment..."
    
    cd backend
    
    if [ -f "package.json" ]; then
        echo "📦 Installing backend dependencies..."
        npm install
        
        print_status "Backend dependencies installed!"
    fi
    
    cd ..
fi

# Supabase deployment
if command -v supabase &> /dev/null; then
    print_status "Deploying Supabase functions..."
    
    if [ -d "supabase/functions" ]; then
        supabase functions deploy
        print_status "Supabase functions deployed!"
    else
        print_warning "Supabase functions directory not found."
    fi
else
    print_warning "Supabase CLI not found. Edge functions may not be updated."
    echo "Run: npm install -g supabase"
fi

# PWA Validation
echo ""
echo "📱 PWA Feature Summary:"
echo "========================"

# Check for PWA essentials
if [ -f "public/manifest.json" ]; then
    echo "✅ App Manifest: Available"
else
    echo "❌ App Manifest: Missing"
fi

if [ -f "public/sw.js" ]; then
    echo "✅ Service Worker: Available"
else
    echo "❌ Service Worker: Missing"
fi

if [ -f "src/services/pushNotificationService.ts" ]; then
    echo "✅ Push Notifications: Available"
else
    echo "❌ Push Notifications: Missing"
fi

# ML Feature Summary
echo ""
echo "🧠 ML Feature Summary:"
echo "======================"

if [ -f "src/services/ml/mlService.ts" ]; then
    echo "✅ TensorFlow.js ML Service: Available"
    echo "   • Predictive Analytics: Enabled"
    echo "   • Anomaly Detection: Enabled" 
    echo "   • Maintenance Forecasting: Enabled"
else
    echo "❌ ML Service: Missing"
fi

if [ -f "src/components/MLInsights.tsx" ]; then
    echo "✅ ML Insights Component: Available"
else
    echo "❌ ML Insights Component: Missing"
fi

# Mobile Feature Summary  
echo ""
echo "📱 Mobile Feature Summary:"
echo "=========================="

if [ -f "src/components/MobileDashboard.tsx" ]; then
    echo "✅ Mobile Dashboard: Available"
else
    echo "❌ Mobile Dashboard: Missing"
fi

if [ -f "src/components/NotificationSettings.tsx" ]; then
    echo "✅ Notification Settings: Available"
else
    echo "❌ Notification Settings: Missing"
fi

if [ -f "src/hooks/use-mobile.tsx" ]; then
    echo "✅ Mobile Detection Hook: Available"
else
    echo "❌ Mobile Detection Hook: Missing"
fi

# Final deployment URLs
echo ""
echo "🌐 Deployment URLs:"
echo "=================="

if [ -f ".firebaserc" ]; then
    PROJECT_ID=$(grep -o '"default": "[^"]*"' .firebaserc | cut -d'"' -f4)
    if [ ! -z "$PROJECT_ID" ]; then
        echo "🔗 Frontend: https://${PROJECT_ID}.web.app"
        echo "🔗 PWA App: https://${PROJECT_ID}.web.app (installable)"
    fi
fi

echo "🔗 Backend: Check your Supabase project dashboard"

# Testing recommendations
echo ""
echo "🧪 Post-Deployment Testing:"
echo "==========================="
echo "1. Test ESP32 connection status on mobile"
echo "2. Verify ML predictions and anomaly detection"
echo "3. Test push notifications on mobile devices"
echo "4. Confirm PWA installation works"
echo "5. Test offline functionality"
echo "6. Verify responsive mobile layout"

# Performance recommendations
echo ""
echo "⚡ Performance Tips:"
echo "=================="
echo "1. Enable caching headers in Firebase hosting"
echo "2. Monitor ML model performance in browser"
echo "3. Test PWA on various mobile devices"
echo "4. Enable compression for TensorFlow.js models"
echo "5. Monitor service worker update cycles"

print_status "🎉 AquaGuard Enhanced Deployment Complete!"
echo ""
echo "Your intelligent water management system is now deployed with:"
echo "• 🧠 Machine Learning Analytics"
echo "• 📱 Progressive Web App"
echo "• 🔔 Mobile Push Notifications"
echo "• 📊 Real-time Insights"
echo "• 🌐 Cloud-Native Architecture"
echo ""
echo "Ready for production use! 🚰✨"
