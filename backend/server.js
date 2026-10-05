const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());


// =============================
// TEST ROUTE
// =============================

app.get("/", (req, res) => {
    res.json({
        message: "ParkEase Backend is running!"
    });
});


// =============================
// USERS
// =============================

app.get("/api/users", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM users ORDER BY user_id"
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});


// =============================
// VEHICLES
// =============================

app.get("/api/vehicles", async (req, res) => {
    try {
        const { user_id } = req.query;

        let query = "SELECT * FROM vehicles";
        let values = [];

        if (user_id) {
            query += " WHERE user_id = $1";
            values.push(user_id);
        }

        query += " ORDER BY vehicle_id";

        const result = await pool.query(query, values);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch vehicles" });
    }
});


app.post("/api/vehicles", async (req, res) => {
    try {
        const {
            user_id,
            vehicle_number,
            vehicle_type
        } = req.body;

        const result = await pool.query(
            `INSERT INTO vehicles
            (user_id, vehicle_number, vehicle_type)
            VALUES ($1, $2, $3)
            RETURNING *`,
            [
                user_id,
                vehicle_number,
                vehicle_type
            ]
        );

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to add vehicle"
        });
    }
});


// =============================
// PARKING LOTS
// =============================

app.get("/api/lots", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *
             FROM parking_lots
             ORDER BY lot_id`
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to fetch parking lots"
        });
    }
});


// =============================
// PARKING SLOTS
// =============================

app.get("/api/slots", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                s.slot_id,
                s.lot_id,
                s.slot_number,
                s.slot_type,
                s.status,
                l.lot_name,
                l.location,
                COALESCE(
                    (
                        SELECT pr.rate_per_hour
                        FROM parking_rates pr
                        WHERE pr.lot_id = s.lot_id
                        AND pr.vehicle_type = s.slot_type
                        LIMIT 1
                    ),
                    0
                ) AS rate_per_hour
            FROM parking_slots s
            JOIN parking_lots l
                ON s.lot_id = l.lot_id
            ORDER BY s.lot_id, s.slot_id
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching slots:", error);

        res.status(500).json({
            error: "Failed to fetch parking slots"
        });
    }
});


// =============================
// BOOKINGS
// =============================

app.get("/api/bookings", async (req, res) => {
    try {
        const { user_id } = req.query;

        let query = `
            SELECT
                b.booking_id,
                b.user_id,
                u.name AS user_name,
                b.vehicle_id,
                v.vehicle_number,
                v.vehicle_type,
                b.slot_id,
                s.slot_number,
                l.lot_name,
                l.location,
                b.booking_date,
                b.start_time,
                b.end_time,
                b.booking_status
            FROM bookings b
            JOIN users u
                ON b.user_id = u.user_id
            JOIN vehicles v
                ON b.vehicle_id = v.vehicle_id
            JOIN parking_slots s
                ON b.slot_id = s.slot_id
            JOIN parking_lots l
                ON s.lot_id = l.lot_id
        `;

        let values = [];

        if (user_id) {
            query += " WHERE b.user_id = $1";
            values.push(user_id);
        }

        query += " ORDER BY b.booking_id DESC";

        const result = await pool.query(query, values);

        res.json(result.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to fetch bookings"
        });
    }
});


// =============================
// CREATE BOOKING
// =============================

app.post("/api/bookings", async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            user_id,
            vehicle_id,
            slot_id,
            booking_date,
            start_time,
            end_time
        } = req.body;

        await client.query("BEGIN");

        // Check slot
        const slotResult = await client.query(
            `SELECT *
             FROM parking_slots
             WHERE slot_id = $1
             FOR UPDATE`,
            [slot_id]
        );

        if (slotResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Parking slot not found"
            });
        }

        const slot = slotResult.rows[0];

        if (slot.status !== "Available") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "Parking slot is not available"
            });
        }

        // Check vehicle
        const vehicleResult = await client.query(
            `SELECT *
             FROM vehicles
             WHERE vehicle_id = $1
             AND user_id = $2`,
            [vehicle_id, user_id]
        );

        if (vehicleResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "Vehicle does not belong to this user"
            });
        }

        // Create booking
        const bookingResult = await client.query(
            `INSERT INTO bookings
            (
                user_id,
                vehicle_id,
                slot_id,
                booking_date,
                start_time,
                end_time,
                booking_status
            )
            VALUES
            ($1, $2, $3, $4, $5, $6, 'Confirmed')
            RETURNING *`,
            [
                user_id,
                vehicle_id,
                slot_id,
                booking_date,
                start_time,
                end_time
            ]
        );

        // Reserve slot
        await client.query(
            `UPDATE parking_slots
             SET status = 'Reserved'
             WHERE slot_id = $1`,
            [slot_id]
        );

        await client.query("COMMIT");

        res.status(201).json({
            message: "Booking created successfully",
            booking: bookingResult.rows[0]
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(error);

        res.status(500).json({
            error: "Failed to create booking"
        });

    } finally {
        client.release();
    }
});


// =============================
// CANCEL BOOKING
// =============================

app.put("/api/bookings/:id/cancel", async (req, res) => {

    const client = await pool.connect();

    try {

        const bookingId = req.params.id;

        await client.query("BEGIN");

        const bookingResult = await client.query(
            `SELECT *
             FROM bookings
             WHERE booking_id = $1
             FOR UPDATE`,
            [bookingId]
        );

        if (bookingResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Booking not found"
            });
        }

        const booking = bookingResult.rows[0];

        await client.query(
            `UPDATE bookings
             SET booking_status = 'Cancelled'
             WHERE booking_id = $1`,
            [bookingId]
        );

        await client.query(
            `UPDATE parking_slots
             SET status = 'Available'
             WHERE slot_id = $1`,
            [booking.slot_id]
        );

        await client.query("COMMIT");

        res.json({
            message: "Booking cancelled successfully"
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(error);

        res.status(500).json({
            error: "Failed to cancel booking"
        });

    } finally {
        client.release();
    }
});


// =============================
// PARKING HISTORY
// =============================

app.get("/api/history", async (req, res) => {

    try {

        const { user_id } = req.query;

        let query = `
            SELECT
                ps.session_id,
                b.booking_id,
                b.user_id,
                u.name AS user_name,
                v.vehicle_number,
                v.vehicle_type,
                l.lot_name,
                s.slot_number,
                ps.entry_time,
                ps.exit_time,
                ps.duration_minutes,
                p.amount,
                p.payment_method,
                p.payment_status
            FROM parking_sessions ps

            JOIN bookings b
                ON ps.booking_id = b.booking_id

            JOIN users u
                ON b.user_id = u.user_id

            JOIN vehicles v
                ON b.vehicle_id = v.vehicle_id

            JOIN parking_slots s
                ON b.slot_id = s.slot_id

            JOIN parking_lots l
                ON s.lot_id = l.lot_id

            LEFT JOIN payments p
                ON ps.session_id = p.session_id
        `;

        let values = [];

        if (user_id) {
            query += " WHERE b.user_id = $1";
            values.push(user_id);
        }

        query += " ORDER BY ps.entry_time DESC";

        const result = await pool.query(query, values);

        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to fetch parking history"
        });
    }
});


// =============================
// ADMIN DASHBOARD
// =============================

app.get("/api/admin/dashboard", async (req, res) => {

    try {

        const users = await pool.query(
            "SELECT COUNT(*) FROM users"
        );

        const vehicles = await pool.query(
            "SELECT COUNT(*) FROM vehicles"
        );

        const slots = await pool.query(
            "SELECT COUNT(*) FROM parking_slots"
        );

        const available = await pool.query(
            `SELECT COUNT(*)
             FROM parking_slots
             WHERE status = 'Available'`
        );

        const reserved = await pool.query(
            `SELECT COUNT(*)
             FROM parking_slots
             WHERE status = 'Reserved'`
        );

        const occupied = await pool.query(
            `SELECT COUNT(*)
             FROM parking_slots
             WHERE status = 'Occupied'`
        );

        const bookings = await pool.query(
            "SELECT COUNT(*) FROM bookings"
        );

        res.json({
            total_users: Number(users.rows[0].count),
            total_vehicles: Number(vehicles.rows[0].count),
            total_slots: Number(slots.rows[0].count),
            available_slots: Number(available.rows[0].count),
            reserved_slots: Number(reserved.rows[0].count),
            occupied_slots: Number(occupied.rows[0].count),
            total_bookings: Number(bookings.rows[0].count)
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to fetch admin dashboard"
        });
    }
});


// =============================
// SERVER
// =============================

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`ParkEase backend running on http://localhost:${PORT}`);
});