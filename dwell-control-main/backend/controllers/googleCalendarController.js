// Google Calendar Integration Controller
const { google } = require('googleapis');
const { OAuth2 } = google.auth;

// You need to set these up in your Google Cloud Console
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google-calendar/callback';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// Step 1: Get Auth URL
exports.getAuthUrl = (req, res) => {
  const oAuth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.json({ url });
};

// Step 2: Handle OAuth callback and get tokens
exports.handleCallback = async (req, res) => {
  const code = req.query.code;
  const oAuth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    // You should store tokens in DB/session for the user
    res.json({ tokens });
  } catch (err) {
    res.status(400).json({ error: 'Failed to get tokens', details: err.message });
  }
};

// Step 3: Fetch events using tokens
exports.getEvents = async (req, res) => {
  const { access_token } = req.query;
  const oAuth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  oAuth2Client.setCredentials({ access_token });
  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  try {
    const now = new Date();
    const events = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
    });
    res.json({ events: events.data.items });
  } catch (err) {
    res.status(400).json({ error: 'Failed to fetch events', details: err.message });
  }
};
