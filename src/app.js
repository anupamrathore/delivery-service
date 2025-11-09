const express = require('express');
const dotenv = require('dotenv');
const routes = require('./routes');
const pool = require('./db/config');

dotenv.config();

const app = express();

app.use(express.json());

// Mount all routes under /v1
app.use('/v1', routes);

const PORT = process.env.PORT || 3005;

app.listen(PORT, async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log(`Connected to Delivery DB at ${res.rows[0].now}`);
    } catch (err) {
        console.error('DB connection error:', err);
        process.exit(1);
    }
    console.log(`Delivery Service running on port ${PORT}`);
});

module.exports = app;
