const express = require('express');
const router = express.Router();
const googleCalendarController = require('../controllers/googleCalendarController');

router.get('/auth-url', googleCalendarController.getAuthUrl);
router.get('/callback', googleCalendarController.handleCallback);
router.get('/events', googleCalendarController.getEvents);

module.exports = router;
