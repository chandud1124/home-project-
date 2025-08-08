
const Device = require('../models/Device');
const ActivityLog = require('../models/ActivityLog');
const SecurityAlert = require('../models/SecurityAlert');

const getAllDevices = async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role !== 'admin') {
      query._id = { $in: req.user.assignedDevices };
    }

    const devices = await Device.find(query).populate('assignedUsers', 'name email role');
    
    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createDevice = async (req, res) => {
  try {
    const device = await Device.create({
      ...req.body,
      assignedUsers: [req.user.id]
    });

    await ActivityLog.create({
      deviceId: device._id,
      deviceName: device.name,
      action: 'created',
      triggeredBy: 'user',
      userId: req.user.id,
      userName: req.user.name,
      classroom: device.classroom,
      location: device.location,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      data: device
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const toggleSwitch = async (req, res) => {
  try {
    const { deviceId, switchId } = req.params;
    const { state, triggeredBy = 'user' } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const switchIndex = device.switches.findIndex(sw => sw._id.toString() === switchId);
    if (switchIndex === -1) {
      return res.status(404).json({ message: 'Switch not found' });
    }

    const oldState = device.switches[switchIndex].state;
    device.switches[switchIndex].state = state !== undefined ? state : !oldState;
    
    await device.save();

    // Log activity
    await ActivityLog.create({
      deviceId: device._id,
      deviceName: device.name,
      switchId: switchId,
      switchName: device.switches[switchIndex].name,
      action: device.switches[switchIndex].state ? 'on' : 'off',
      triggeredBy,
      userId: req.user.id,
      userName: req.user.name,
      classroom: device.classroom,
      location: device.location,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getDeviceStats = async (req, res) => {
  try {
    let matchQuery = {};
    
    if (req.user.role !== 'admin') {
      matchQuery._id = { $in: req.user.assignedDevices };
    }

    const stats = await Device.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalDevices: { $sum: 1 },
          onlineDevices: {
            $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] }
          },
          totalSwitches: {
            $sum: { $size: '$switches' }
          },
          activeSwitches: {
            $sum: {
              $size: {
                $filter: {
                  input: '$switches',
                  cond: { $eq: ['$$this.state', true] }
                }
              }
            }
          },
          totalPirSensors: {
            $sum: { $cond: [{ $ne: ['$pirSensor', null] }, 1, 0] }
          },
          activePirSensors: {
            $sum: { $cond: [{ $eq: ['$pirSensor.isActive', true] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalDevices: 0,
        onlineDevices: 0,
        totalSwitches: 0,
        activeSwitches: 0,
        totalPirSensors: 0,
        activePirSensors: 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllDevices,
  createDevice,
  toggleSwitch,
  getDeviceStats
};
