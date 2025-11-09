// src/controllers/deliveryController.js
const pool = require('../db/config');
const { assignDriver } = require('../services/driverService');
const axios = require('axios');

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';
const RESTAURANT_SERVICE_URL = process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3002';

/**
 * Create a new delivery for a given order
 */
const createDelivery = async (req, res) => {
  const { order_id } = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  try {
    // 1️⃣ Fetch order details from order-service
    const orderResp = await axios.get(`${ORDER_SERVICE_URL}/v1/orders/${order_id}`);
    const order = orderResp.data;

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // 2️⃣ Fetch restaurant details from restaurant-service
    const restResp = await axios.get(`${RESTAURANT_SERVICE_URL}/v1/restaurants/${order.restaurant_id}`);
    const restaurant = restResp.data;

    if (!restaurant || !restaurant.is_open) {
      return res.status(400).json({ error: 'Restaurant is currently closed' });
    }

    // 3️⃣ Prevent duplicate delivery
    const existing = await pool.query('SELECT * FROM deliveries WHERE order_id = $1', [order_id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Delivery already exists for this order' });
    }

    // 4️⃣ Assign driver based on restaurant city
    const city = restaurant.city || 'Mumbai'; // fallback if restaurant lacks city info
    const driver = await assignDriver(city);

    if (!driver) {
      return res.status(400).json({ error: `No available drivers in ${city}` });
    }

    // 5️⃣ Determine initial payment status
    const payment_status = order.payment_status || 'PENDING';

    // 6️⃣ Insert delivery record
    const insertQuery = `
      INSERT INTO deliveries (order_id, driver_id, status, assigned_at, payment_status)
      VALUES ($1, $2, $3, NOW(), $4)
      RETURNING *
    `;
    const values = [order_id, driver.driver_id, 'ASSIGNED', payment_status];

    const result = await pool.query(insertQuery, values);
    const delivery = result.rows[0];

    return res.status(201).json({
      message: 'Delivery created successfully',
      delivery,
      driver,
      restaurant
    });

  } catch (err) {
    console.error('❌ Error creating delivery:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update delivery status
 */
const updateDeliveryStatus = async (req, res) => {
  const { delivery_id, status } = req.body;

  if (!delivery_id || !status) {
    return res.status(400).json({ error: 'delivery_id and status are required' });
  }

  const validStatuses = ['ASSIGNED', 'PICKED', 'DELIVERED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of ${validStatuses.join(', ')}` });
  }

  try {
    let timestampField = null;
    if (status === 'PICKED') timestampField = 'picked_at';
    if (status === 'DELIVERED') timestampField = 'delivered_at';

    const query = `
      UPDATE deliveries
      SET status = $1,
          ${timestampField ? `${timestampField} = NOW(),` : ''}
          updated_at = NOW()
      WHERE delivery_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [status, delivery_id]);
    const updatedDelivery = result.rows[0];

    if (!updatedDelivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    if (status === 'DELIVERED') {
      await pool.query(
        'UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2',
        ['AVAILABLE', updatedDelivery.driver_id]
      );

      if (updatedDelivery.payment_status === 'PENDING') {
        try {
          await axios.patch(`${ORDER_SERVICE_URL}/v1/orders/${updatedDelivery.order_id}/payment`, {
            status: 'SUCCESS'
          });
        } catch (err) {
          console.error('❌ Failed to update payment status in order-service', err.message);
        }
      }
    }

    return res.status(200).json({
      message: 'Delivery status updated',
      delivery: updatedDelivery
    });

  } catch (err) {
    console.error('❌ Error updating delivery status:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all deliveries
 */
const getDeliveries = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM deliveries ORDER BY assigned_at DESC');
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching deliveries:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createDelivery,
  updateDeliveryStatus,
  getDeliveries
};
