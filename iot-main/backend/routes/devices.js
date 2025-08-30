
const express = require('express');
const { auth, authorize, checkDeviceAccess } = require('../middleware/auth');
const { validateDevice } = require('../middleware/deviceValidator');
const {
  getAllDevices,
  createDevice,
  toggleSwitch,
  getDeviceStats,
  updateDevice,
  deleteDevice,
  getDeviceById
} = require('../controllers/deviceController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Device Routes with validation and proper error handling
router.get('/', getAllDevices);
router.post('/', authorize('admin', 'faculty'), validateDevice, createDevice);
router.get('/stats', getDeviceStats);

// Single device operations
router.get('/:deviceId', checkDeviceAccess, getDeviceById);
router.put('/:deviceId', authorize('admin', 'faculty'), checkDeviceAccess, validateDevice, updateDevice);
router.delete('/:deviceId', authorize('admin'), checkDeviceAccess, deleteDevice);

// Switch operations
router.post('/:deviceId/switches/:switchId/toggle', checkDeviceAccess, toggleSwitch);

module.exports = router;
