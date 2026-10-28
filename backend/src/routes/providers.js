const express = require("express");
const pool = require("../config/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();


// GET ALL PROVIDERS

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id,
                name,
                email,
                phone,
                created_at
             FROM users
             WHERE role = 'provider'
             ORDER BY id`
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching providers:", error);

        res.status(500).json({
            message: "Failed to fetch providers"
        });
    }
});


// GET ONE PROVIDER

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT
                id,
                name,
                email,
                phone,
                created_at
             FROM users
             WHERE id = $1
             AND role = 'provider'`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Provider not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Error fetching provider:", error);

        res.status(500).json({
            message: "Failed to fetch provider"
        });
    }
});


// PROVIDER ADD SERVICE

router.post("/services", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "provider") {
            return res.status(403).json({
                message: "Only providers can add services"
            });
        }

        const {
            service_id,
            price
        } = req.body;

        if (!service_id || !price) {
            return res.status(400).json({
                message: "Service ID and price are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO provider_services
                (provider_id, service_id, price)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [
                req.user.id,
                service_id,
                price
            ]
        );

        res.status(201).json({
            message: "Service added successfully",
            providerService: result.rows[0]
        });

    } catch (error) {
        console.error("Error adding provider service:", error);

        res.status(500).json({
            message: "Failed to add service"
        });
    }
});

// GET PROVIDER SERVICES

router.get("/:id/services", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT
                provider_services.id,
                provider_services.price,
                services.id AS service_id,
                services.name,
                services.description,
                service_categories.name AS category
             FROM provider_services
             JOIN services
                ON provider_services.service_id = services.id
             JOIN service_categories
                ON services.category_id = service_categories.id
             WHERE provider_services.provider_id = $1
             ORDER BY provider_services.id`,
            [id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching provider services:", error);

        res.status(500).json({
            message: "Failed to fetch provider services"
        });
    }
});


/* =========================================
   ADD PROVIDER AVAILABILITY
========================================= */

router.post("/availability", authMiddleware, async (req, res) => {
    try {
        // Only providers can manage their availability.
        if (req.user.role !== "provider") {
            return res.status(403).json({
                message: "Only providers can manage availability"
            });
        }

        // Read availability details from the request.
        const {
            day_of_week,
            start_time,
            end_time,
            is_available
        } = req.body;

        // Validate required fields.
        if (
            day_of_week === undefined ||
            !start_time ||
            !end_time
        ) {
            return res.status(400).json({
                message: "Day, start time and end time are required"
            });
        }

        // Validate day: 0 = Sunday, 6 = Saturday.
        if (
            !Number.isInteger(Number(day_of_week)) ||
            Number(day_of_week) < 0 ||
            Number(day_of_week) > 6
        ) {
            return res.status(400).json({
                message: "Day of week must be between 0 and 6"
            });
        }

        // Validate the time range.
        if (start_time >= end_time) {
            return res.status(400).json({
                message: "Start time must be earlier than end time"
            });
        }

        // Save availability for the logged-in provider.
        const result = await pool.query(
            `INSERT INTO provider_availability
                (
                    provider_id,
                    day_of_week,
                    start_time,
                    end_time,
                    is_available
                )
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                req.user.id,
                Number(day_of_week),
                start_time,
                end_time,
                is_available === undefined ? true : is_available
            ]
        );

        // Return the saved schedule.
        res.status(201).json({
            message: "Availability added successfully",
            availability: result.rows[0]
        });

    } catch (error) {
        console.error("Error adding availability:", error);

        res.status(500).json({
            message: "Failed to add availability"
        });
    }
});


/* =========================================
   GET PROVIDER AVAILABILITY
========================================= */

router.get("/:id/availability", async (req, res) => {
    try {
        // Get provider ID from the URL.
        const { id } = req.params;

        // Retrieve the provider's weekly schedule.
        const result = await pool.query(
            `SELECT
                id,
                provider_id,
                day_of_week,
                start_time,
                end_time,
                is_available
             FROM provider_availability
             WHERE provider_id = $1
             ORDER BY day_of_week, start_time`,
            [id]
        );

        // Return the schedule.
        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching availability:", error);

        res.status(500).json({
            message: "Failed to fetch availability"
        });
    }
});


/* =========================================
   UPDATE PROVIDER AVAILABILITY
========================================= */

router.put("/availability/:id", authMiddleware, async (req, res) => {
    try {
        // Only providers can change their schedules.
        if (req.user.role !== "provider") {
            return res.status(403).json({
                message: "Only providers can update availability"
            });
        }

        // Get availability record ID.
        const { id } = req.params;

        // Read updated values.
        const {
            day_of_week,
            start_time,
            end_time,
            is_available
        } = req.body;

        // Validate the submitted values.
        if (
            day_of_week === undefined ||
            !start_time ||
            !end_time ||
            typeof is_available !== "boolean"
        ) {
            return res.status(400).json({
                message: "Day, times and availability status are required"
            });
        }

        if (
            !Number.isInteger(Number(day_of_week)) ||
            Number(day_of_week) < 0 ||
            Number(day_of_week) > 6
        ) {
            return res.status(400).json({
                message: "Day of week must be between 0 and 6"
            });
        }

        if (start_time >= end_time) {
            return res.status(400).json({
                message: "Start time must be earlier than end time"
            });
        }

        // Update only a schedule belonging to this provider.
        const result = await pool.query(
            `UPDATE provider_availability
             SET
                day_of_week = $1,
                start_time = $2,
                end_time = $3,
                is_available = $4
             WHERE id = $5
             AND provider_id = $6
             RETURNING *`,
            [
                Number(day_of_week),
                start_time,
                end_time,
                is_available,
                id,
                req.user.id
            ]
        );

        // The record may not exist or may belong to another provider.
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Availability record not found"
            });
        }

        res.json({
            message: "Availability updated successfully",
            availability: result.rows[0]
        });

    } catch (error) {
        console.error("Error updating availability:", error);

        res.status(500).json({
            message: "Failed to update availability"
        });
    }
});


/* =========================================
   DELETE PROVIDER AVAILABILITY
========================================= */

router.delete("/availability/:id", authMiddleware, async (req, res) => {
    try {
        // Only providers can delete their schedules.
        if (req.user.role !== "provider") {
            return res.status(403).json({
                message: "Only providers can delete availability"
            });
        }

        // Get availability record ID.
        const { id } = req.params;

        // Delete only a record owned by this provider.
        const result = await pool.query(
            `DELETE FROM provider_availability
             WHERE id = $1
             AND provider_id = $2
             RETURNING *`,
            [
                id,
                req.user.id
            ]
        );

        // Handle missing records or records owned by someone else.
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Availability record not found"
            });
        }

        res.json({
            message: "Availability deleted successfully",
            availability: result.rows[0]
        });

    } catch (error) {
        console.error("Error deleting availability:", error);

        res.status(500).json({
            message: "Failed to delete availability"
        });
    }
});


module.exports = router;