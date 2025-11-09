const assignDriver = async (city) => {
  try {
    if (!city) throw new Error('City is required to assign a driver');

    const result = await pool.query(
      `SELECT * FROM drivers 
       WHERE current_city = $1 AND is_active = true AND status = 'AVAILABLE'
       LIMIT 1`,
      [city]
    );

    if (result.rows.length === 0) return null;

    const driver = result.rows[0];

    // Mark driver as BUSY
    await pool.query(
      `UPDATE drivers SET status = 'BUSY', updated_at = NOW() WHERE driver_id = $1`,
      [driver.driver_id]
    );

    // Return relevant info
    return {
      driver_id: driver.driver_id,
      name: driver.name,
      phone: driver.phone,
      vehicle_type: driver.vehicle_type,
      current_city: driver.current_city
    };

  } catch (err) {
    console.error('❌ Error assigning driver:', err.message);
    throw err;
  }
};

module.exports = { assignDriver };
