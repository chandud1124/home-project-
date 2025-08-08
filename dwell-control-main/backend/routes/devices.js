
const express = require('express');
const { auth, authorize, checkDeviceAccess } = require('../middleware/auth');
const {
  getAllDevices,
  createDevice,
  toggleSwitch,
  getDeviceStats
} = require('../controllers/deviceController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Routes
router.get('/', getAllDevices);
router.post('/', authorize('admin', 'faculty'), createDevice);
router.get('/stats', getDeviceStats);
router.post('/:deviceId/switches/:switchId/toggle', checkDeviceAccess, toggleSwitch);

module.exports = router;
