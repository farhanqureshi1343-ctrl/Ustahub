
const express = require("express");
const pool = require("../config/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();


/* =========================================
   CREATE A REVIEW
========================================= */

router.post("/", authMiddleware, async (req, res) => {
    try {
        // Only customers can write reviews.
        if (req.user.role !== "customer") {
            return res.status(403).json({
                message: "Only customers can submit reviews"
            });
        }

        // Read review details.
        const { booking_id, rating, comment } = req.body;

        // Validate required fields.
        if (
            booking_id === undefined ||
            rating === undefined
        ) {
            return res.status(400).json({
                message: "Booking ID and rating are required"
            });
        }

        // Rating must be an integer from 1 to 5.
        if (
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
        ) {
            return res.status(400).json({
                message: "Rating must be an integer from 1 to 5"
            });
        }

        // Check that the booking belongs to this customer
        // and has been completed.
        const bookingResult = await pool.query(
            `SELECT id, customer_id, provider_id, status
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

        if (booking.status !== "completed") {
            return res.status(400).json({
                message: "You can review only completed bookings"
            });
        }

        // Save the review.
        const result = await pool.query(
            `INSERT INTO reviews
                (booking_id, customer_id, provider_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                booking.id,
                req.user.id,
                booking.provider_id,
                rating,
                comment || null
            ]
        );

        res.status(201).json({
            message: "Review submitted successfully",
            review: result.rows[0]
        });

    } catch (error) {
        // PostgreSQL error code 23505 means a unique constraint failed.
        if (error.code === "23505") {
            return res.status(409).json({
                message: "This booking has already been reviewed"
            });
        }

        console.error("Error creating review:", error);

        res.status(500).json({
            message: "Failed to submit review"
        });
    }
});


/* =========================================
   GET REVIEWS FOR A PROVIDER
========================================= */

router.get("/provider/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT
                reviews.id,
                reviews.booking_id,
                reviews.rating,
                reviews.comment,
                reviews.created_at,
                users.name AS customer_name
             FROM reviews
             JOIN users
                ON reviews.customer_id = users.id
             WHERE reviews.provider_id = $1
             ORDER BY reviews.created_at DESC`,
            [id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching provider reviews:", error);

        res.status(500).json({
            message: "Failed to fetch provider reviews"
        });
    }
});


/* =========================================
   GET PROVIDER AVERAGE RATING
========================================= */

router.get("/provider/:id/rating", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT
                COUNT(*)::INTEGER AS total_reviews,
                COALESCE(ROUND(AVG(rating)::NUMERIC, 1), 0) AS average_rating
             FROM reviews
             WHERE provider_id = $1`,
            [id]
        );

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Error calculating provider rating:", error);

        res.status(500).json({
            message: "Failed to calculate provider rating"
        });
    }
});


/* =========================================
   GET MY REVIEWS
========================================= */


router.get("/my", authMiddleware, async (req, res) => {
  try {
    // Only customers can view their own reviews.
    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can access their reviews",
      });
    }

    // Fetch each review with the correct provider, booking, and service.
    const result = await pool.query(
      `SELECT
         reviews.id,
         reviews.booking_id,
         reviews.rating,
         reviews.comment,
         reviews.created_at,
         users.name AS provider_name,
         services.name AS service_name
       FROM reviews
       JOIN bookings
         ON reviews.booking_id = bookings.id
       JOIN users
         ON reviews.provider_id = users.id
       JOIN services
         ON bookings.service_id = services.id
       WHERE reviews.customer_id = $1
       ORDER BY reviews.created_at DESC`,
      [req.user.id]
    );

    // Return the customer's reviews.
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching customer reviews:", error);

    res.status(500).json({
      message: "Failed to fetch your reviews",
    });
  }
});

module.exports = router;