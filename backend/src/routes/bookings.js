const express = require("express");
const pool = require("../config/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();


/* CREATE A NOTIFICATION */

async function createNotification(userId, title, message, type) {
    await pool.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [userId, title, message, type]
    );
}

// CREATE BOOKING

/* CREATE BOOKING */

router.post("/", authMiddleware, async (req, res) => {
    try {
        const {
            provider_id,
            service_id,
            booking_date,
            start_time,
            end_time,
            address,
            notes
        } = req.body;

        // Only customers can create bookings.
        if (req.user.role !== "customer") {
            return res.status(403).json({
                message: "Only customers can create bookings"
            });
        }

        // Check that all required fields are provided.
        if (
            provider_id == null ||
            service_id == null ||
            !booking_date ||
            !start_time ||
            !end_time ||
            typeof address !== "string" ||
            !address.trim()
        ) {
            return res.status(400).json({
                message: "All required booking fields must be provided"
            });
        }

        // IDs must be positive integers.
        const providerId = Number(provider_id);
        const serviceId = Number(service_id);

        if (
            !Number.isInteger(providerId) ||
            providerId <= 0 ||
            !Number.isInteger(serviceId) ||
            serviceId <= 0
        ) {
            return res.status(400).json({
                message: "Invalid provider ID or service ID"
            });
        }

        // Validate the date format and calendar date.
        if (
            typeof booking_date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(booking_date)
        ) {
            return res.status(400).json({
                message: "Booking date must use YYYY-MM-DD format"
            });
        }

        const parsedDate = new Date(`${booking_date}T00:00:00Z`);

        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== booking_date
        ) {
            return res.status(400).json({
                message: "Invalid booking date"
            });
        }

        // Validate time format.
        const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

        if (
            typeof start_time !== "string" ||
            typeof end_time !== "string" ||
            !timePattern.test(start_time) ||
            !timePattern.test(end_time)
        ) {
            return res.status(400).json({
                message: "Times must use HH:MM or HH:MM:SS format"
            });
        }

        // Convert times to minutes to compare them safely.
        const toMinutes = (time) => {
            const parts = time.split(":").map(Number);
            return parts[0] * 60 + parts[1];
        };

        if (toMinutes(start_time) >= toMinutes(end_time)) {
            return res.status(400).json({
                message: "End time must be later than start time"
            });
        }

        // Reject bookings for dates that have already passed.
        const dateResult = await pool.query(
            "SELECT CURRENT_DATE::text AS today"
        );

        if (booking_date < dateResult.rows[0].today) {
            return res.status(400).json({
                message: "Booking date cannot be in the past"
            });
        }

        // Confirm the provider exists and offers this service.
        const serviceResult = await pool.query(
            `SELECT provider_services.price
             FROM provider_services
             JOIN users
               ON users.id = provider_services.provider_id
             WHERE provider_services.provider_id = $1
               AND provider_services.service_id = $2
               AND users.role = 'provider'`,
            [providerId, serviceId]
        );

        if (serviceResult.rows.length === 0) {
            return res.status(404).json({
                message: "Provider does not offer this service"
            });
        }

        const price = serviceResult.rows[0].price;

        // Check whether the provider is available for the entire time.
        const availabilityResult = await pool.query(
            `SELECT id
             FROM provider_availability
             WHERE provider_id = $1
               AND day_of_week =
                   EXTRACT(DOW FROM $2::date)::integer
               AND is_available = TRUE
               AND start_time <= $3::time
               AND end_time >= $4::time
             LIMIT 1`,
            [providerId, booking_date, start_time, end_time]
        );

        if (availabilityResult.rows.length === 0) {
            return res.status(400).json({
                message: "Provider is not available at that time"
            });
        }

        // Check for overlapping active bookings.
        const conflictResult = await pool.query(
            `SELECT id
             FROM bookings
             WHERE provider_id = $1
               AND booking_date = $2
               AND status IN ('pending', 'confirmed', 'in_progress')
               AND start_time < $4::time
               AND end_time > $3::time
             LIMIT 1`,
            [providerId, booking_date, start_time, end_time]
        );

        if (conflictResult.rows.length > 0) {
            return res.status(409).json({
                message: "Provider already has a booking during that time"
            });
        }

        // Create the booking using the authenticated customer's ID.
        const result = await pool.query(
            `INSERT INTO bookings (
                customer_id,
                provider_id,
                service_id,
                booking_date,
                start_time,
                end_time,
                address,
                notes,
                price
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                req.user.id,
                providerId,
                serviceId,
                booking_date,
                start_time,
                end_time,
                address.trim(),
                notes || null,
                price
            ]
       
        );

        // Notify the provider about the new booking.
        await safelyNotify(
            providerId,
            "New booking request",
            "You have received a new service booking request.",
            "booking"
        );

        // Return the successfully created booking.
        res.status(201).json({
            message: "Booking created successfully",
            booking: result.rows[0]
        });
   
} catch (error) {
    // Handle a booking conflict detected by PostgreSQL.
    if (error.code === "23P01") {
        return res.status(409).json({
            message: "Provider already has a booking during that time"
        });
    }

    // Log any other unexpected error.
    console.error("Error creating booking:", error);

    res.status(500).json({
        message: "Failed to create booking"
    });
}
});
// GET CUSTOMER BOOKINGS

router.get("/customer", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "customer") {
            return res.status(403).json({
                message: "Only customers can access customer bookings"
            });
        }

        const result = await pool.query(
            `SELECT
                bookings.id,
                bookings.booking_date,
                bookings.start_time,
                bookings.end_time,
                bookings.address,
                bookings.notes,
                bookings.price,
                bookings.status,
                users.name AS provider_name,
                services.name AS service_name
             FROM bookings
             JOIN users
                ON bookings.provider_id = users.id
             JOIN services
                ON bookings.service_id = services.id
             WHERE bookings.customer_id = $1
             ORDER BY bookings.booking_date DESC`,
            [req.user.id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching customer bookings:", error);

        res.status(500).json({
            message: "Failed to fetch customer bookings"
        });
    }
});

// GET PROVIDER BOOKINGS

router.get("/provider", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "provider") {
            return res.status(403).json({
                message: "Only providers can access provider bookings"
            });
        }

        const result = await pool.query(
            `SELECT
                bookings.id,
                bookings.booking_date,
                bookings.start_time,
                bookings.end_time,
                bookings.address,
                bookings.notes,
                bookings.price,
                bookings.status,
                users.name AS customer_name,
                services.name AS service_name
             FROM bookings
             JOIN users
                ON bookings.customer_id = users.id
             JOIN services
                ON bookings.service_id = services.id
             WHERE bookings.provider_id = $1
             ORDER BY bookings.booking_date DESC`,
            [req.user.id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching provider bookings:", error);

        res.status(500).json({
            message: "Failed to fetch provider bookings"
        });
    }
});


/* UPDATE BOOKING STATUS */

router.patch("/:id/status", authMiddleware, async (req, res) => {
    try {
        // Get the booking ID from the URL.
        const { id } = req.params;

        // Get the requested new status from the request body.
        const { status } = req.body;

        // Allow only these status values.
        const validStatuses = [
            "confirmed",
            "rejected",
            "in_progress",
            "completed",
            "cancelled"
        ];

        // Reject invalid status values.
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid booking status"
            });
        }

        // Find the requested booking.
        const bookingResult = await pool.query(
            `SELECT id, customer_id, provider_id, status
             FROM bookings
             WHERE id = $1`,
            [id]
        );

        // Check whether the booking exists.
        if (bookingResult.rows.length === 0) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        const booking = bookingResult.rows[0];

        // Check whether the logged-in user can make this change.
        let allowed = false;

        if (
            req.user.role === "provider" &&
            req.user.id === booking.provider_id
        ) {
            if (
                booking.status === "pending" &&
                ["confirmed", "rejected"].includes(status)
            ) {
                allowed = true;
            }

            if (
                booking.status === "confirmed" &&
                status === "in_progress"
            ) {
                allowed = true;
            }

            if (
                booking.status === "in_progress" &&
                status === "completed"
            ) {
                allowed = true;
            }
        }

        // Customers can cancel their own pending or confirmed bookings.
        if (
            req.user.role === "customer" &&
            req.user.id === booking.customer_id &&
            ["pending", "confirmed"].includes(booking.status) &&
            status === "cancelled"
        ) {
            allowed = true;
        }

        // Reject unauthorized or invalid transitions.
        if (!allowed) {
            return res.status(403).json({
                message: "You are not allowed to make this status change"
            });
        }

        // Update only if the booking still has its previous status.
        const updateResult = await pool.query(
            `UPDATE bookings
             SET status = $1
             WHERE id = $2
             AND status = $3
             RETURNING *`,
            [status, id, booking.status]
        );

        // Protect against another request changing it at the same time.
        if (updateResult.rows.length === 0) {
            return res.status(409).json({
                message: "Booking status changed. Please try again."
            });
        }

        // Send the updated booking to the client.
       
        // Notify the other participant about the status change.
        const recipientId =
            Number(req.user.id) === Number(booking.provider_id)
                ? booking.customer_id
                : booking.provider_id;

        await safelyNotify(
            recipientId,
            "Booking status updated",
            `Your booking #${booking.id} is now ${status.replace(/_/g, " ")}.`,
            "booking"
        );

        // Return the updated booking.
        res.json({
            message: "Booking status updated successfully",
            booking: updateResult.rows[0]
        });

    } catch (error) {
        console.error("Error updating booking status:", error);

        res.status(500).json({
            message: "Failed to update booking status"
        });
    }
});



/* =========================================
   GET A SINGLE BOOKING
========================================= */

router.get("/:id", authMiddleware, async (req, res) => {
    try {
        // Get the booking ID from the URL.
        const { id } = req.params;

        // Find the booking.
        const result = await pool.query(
            `SELECT
                bookings.*,
                customer.name AS customer_name,
                provider.name AS provider_name,
                services.name AS service_name
             FROM bookings
             JOIN users AS customer
                ON bookings.customer_id = customer.id
             JOIN users AS provider
                ON bookings.provider_id = provider.id
             JOIN services
                ON bookings.service_id = services.id
             WHERE bookings.id = $1
             AND (
                bookings.customer_id = $2
                OR bookings.provider_id = $2
             )`,
            [
                id,
                req.user.id
            ]
        );

        // Don't reveal bookings that don't exist
        // or that belong to another user.
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        // Return the booking details.
        res.json(result.rows[0]);

    } catch (error) {
        // Log the error.
        console.error("Error fetching booking:", error);

        // Return an error response.
        res.status(500).json({
            message: "Failed to fetch booking"
        });
    }
});

module.exports = router;