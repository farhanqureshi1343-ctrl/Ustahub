
const express = require("express");
const pool = require("../config/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();


/* =========================================
   CREATE PAYMENT RECORD
========================================= */

router.post("/", authMiddleware, async (req, res) => {
    try {
        const { booking_id, payment_method } = req.body;

        const validMethods = ["cash", "payme", "click", "uzum"];

        if (!booking_id || !validMethods.includes(payment_method)) {
            return res.status(400).json({
                message: "Valid booking ID and payment method are required"
            });
        }

        // Only the customer who owns the booking can create its payment.
        const bookingResult = await pool.query(
            `SELECT id, customer_id, provider_id, price, status
             FROM bookings
             WHERE id = $1
             AND customer_id = $2`,
            [booking_id, req.user.id]
        );

        if (bookingResult.rows.length === 0) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        const booking = bookingResult.rows[0];

        if (booking.status === "cancelled" || booking.status === "rejected") {
            return res.status(400).json({
                message: "Payment cannot be created for this booking"
            });
        }

        // Prevent multiple payment records for one booking.
        const existingPayment = await pool.query(
            `SELECT id, status
             FROM payments
             WHERE booking_id = $1`,
            [booking_id]
        );

        if (existingPayment.rows.length > 0) {
            return res.status(409).json({
                message: "A payment record already exists for this booking"
            });
        }

        const result = await pool.query(
            `INSERT INTO payments
                (booking_id, amount, payment_method, status)
             VALUES ($1, $2, $3, 'pending')
             RETURNING
                id,
                booking_id,
                amount,
                payment_method,
                status,
                created_at`,
            [
                booking.id,
                booking.price,
                payment_method
            ]
        );

        res.status(201).json({
            message: "Payment record created",
            payment: result.rows[0]
        });

    } catch (error) {
        console.error("Error creating payment:", error);

        res.status(500).json({
            message: "Failed to create payment"
        });
    }
});


/* =========================================
   GET MY PAYMENTS
========================================= */

router.get("/my", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                payments.id,
                payments.booking_id,
                payments.amount,
                payments.payment_method,
                payments.status,
                payments.transaction_id,
                payments.paid_at,
                payments.created_at,
                bookings.booking_date,
                services.name AS service_name
             FROM payments
             JOIN bookings
                ON payments.booking_id = bookings.id
             JOIN services
                ON bookings.service_id = services.id
             WHERE bookings.customer_id = $1
             ORDER BY payments.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching payments:", error);

        res.status(500).json({
            message: "Failed to fetch payments"
        });
    }
});


/* =========================================
   GET PAYMENT FOR A BOOKING
========================================= */

router.get("/booking/:bookingId", authMiddleware, async (req, res) => {
    try {
        const { bookingId } = req.params;

        // Only the booking's customer or assigned provider can view it.
        const result = await pool.query(
            `SELECT
                payments.id,
                payments.booking_id,
                payments.amount,
                payments.payment_method,
                payments.status,
                payments.transaction_id,
                payments.paid_at,
                payments.created_at
             FROM payments
             JOIN bookings
                ON payments.booking_id = bookings.id
             WHERE payments.booking_id = $1
             AND (
                bookings.customer_id = $2
                OR bookings.provider_id = $2
             )`,
            [bookingId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Payment not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Error fetching booking payment:", error);

        res.status(500).json({
            message: "Failed to fetch payment"
        });
    }
});


/* =========================================
   PAYMENT STATUS WEBHOOK PLACEHOLDER
========================================= */

// Real Payme, Click and Uzum callbacks must be implemented
// according to each provider's authentication and signature rules.
// Never let an ordinary client mark a payment as paid.

module.exports = router;