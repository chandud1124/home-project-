#!/bin/bash

echo "🚀 Deploying Aqua Guard Sense to Supabase + Firebase"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required environment variables are set
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ Error: Supabase environment variables not set!${NC}"
    echo "Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file"
    exit 1
fi

echo -e "${YELLOW}📦 Building frontend...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built successfully${NC}"

echo -e "${YELLOW}🚀 Deploying to Firebase...${NC}"
firebase deploy --only hosting

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Firebase deployment failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend deployed to Firebase${NC}"

echo -e "${YELLOW}⚙️ Deploying Supabase functions...${NC}"
supabase functions deploy

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Supabase functions deployment failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Supabase functions deployed${NC}"

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "Your Aqua Guard Sense system is now live:"
echo "- Frontend: https://aqua-guard-sense.web.app"
echo "- Backend API: https://your-project.supabase.co/functions/v1/api"
echo "- WebSocket: wss://your-project.supabase.co/functions/v1/websocket"
echo ""
echo "Don't forget to:"
echo "1. Update your ESP32 firmware with the new Supabase URLs"
echo "2. Configure your WiFi router to allow connections to Supabase"
echo "3. Test the system with your ESP32 devices"
