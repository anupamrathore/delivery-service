const express = require('express');
const router = express.Router();
const pool = require('../db/config');

// Import controllers
const {
  createDelivery,
  updateDeliveryStatus,
  getDeliveries
} = require('../controllers/deliveryController');

// 🩺 Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1');
    res.status(200).json({
      status: 'OK',
      db: result ? 'Connected' : 'Not Connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'DOWN',
      error: error.message
    });
  }
});

// 🚚 Delivery routes
router.get('/deliveries', getDeliveries);
router.post('/deliveries', createDelivery);
router.put('/deliveries/status', updateDeliveryStatus);

module.exports = router;
