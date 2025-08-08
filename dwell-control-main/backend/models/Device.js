
const mongoose = require('mongoose');

const switchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  gpio: {
    type: Number,
    required: true
  },
  state: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['relay', 'light', 'fan', 'outlet', 'projector', 'ac'],
    required: true
  },
  icon: String,
  hasManualSwitch: {
    type: Boolean,
    default: false
  },
  manualSwitchGpio: Number,
  hasPirSensor: {
    type: Boolean,
    default: false
  },
  pirSensorId: String,
  schedule: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule'
  }],
  powerConsumption: Number,
  dontAutoOff: {
    type: Boolean,
    default: false
  }
});

const pirSensorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  gpio: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sensitivity: {
    type: Number,
    default: 80,
    min: 0,
    max: 100
  },
  timeout: {
    type: Number,
    default: 300
  },
  linkedSwitches: [String],
  schedule: {
    enabled: {
      type: Boolean,
      default: false
    },
    startTime: String,
    endTime: String
  }
});

const deviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  ip: {
    type: String,
    required: true
  },
  mac: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline'
  },
  signalStrength: {
    type: Number,
    default: 0
  },
  uptime: {
    type: String,
    default: '0d 0h'
  },
  firmware: {
    type: String,
    default: 'v1.0.0'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  location: {
    type: String,
    required: true
  },
  classroom: {
    type: String,
    required: true
  },
  switches: [switchSchema],
  pirSensor: pirSensorSchema,
  assignedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Device', deviceSchema);
