
const express = require("express");
const pool = require("../config/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();


// =========================================
// ADMIN ACCESS MIDDLEWARE
// =========================================

const adminOnly = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Admin access required"
        });
    }

    next();
};


// Protect all routes in this router.
router.use(authMiddleware, adminOnly);


// =========================================
// DASHBOARD STATISTICS
// =========================================

router.get("/stats", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users)::INTEGER AS total_users,
                (SELECT COUNT(*) FROM users
                 WHERE role = 'customer')::INTEGER AS total_customers,
                (SELECT COUNT(*) FROM users
                 WHERE role = 'provider')::INTEGER AS total_providers,
                (SELECT COUNT(*) FROM services)::INTEGER AS total_services,
                (SELECT COUNT(*) FROM bookings)::INTEGER AS total_bookings,
                (SELECT COUNT(*) FROM bookings
                 WHERE status = 'pending')::INTEGER AS pending_bookings,
                (SELECT COUNT(*) FROM payments)::INTEGER AS total_payments,
                (SELECT COALESCE(SUM(amount), 0)
                 FROM payments
                 WHERE status = 'paid') AS total_paid
        `);

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Error loading admin statistics:", error);

        res.status(500).json({
            message: "Failed to load dashboard statistics"
        });
    }
});


// =========================================
// VIEW ALL USERS
// =========================================

router.get("/users", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                name,
                email,
                phone,
                role,
                created_at
            FROM users
            ORDER BY created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching admin users:", error);

        res.status(500).json({
            message: "Failed to fetch users"
        });
    }
});


// =========================================
// UPDATE USER ROLE
// =========================================

router.patch("/users/:id/role", async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const validRoles = ["customer", "provider", "admin"];

        if (!validRoles.includes(role)) {
            return res.status(400).json({
                message: "Invalid user role"
            });
        }

        // Prevent an admin from accidentally removing their own admin role.
        if (Number(id) === Number(req.user.id)) {
            return res.status(400).json({
                message: "You cannot change your own role"
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET role = $1
             WHERE id = $2
             RETURNING id, name, email, phone, role`,
            [role, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: "User role updated successfully",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Error updating user role:", error);

        res.status(500).json({
            message: "Failed to update user role"
        });
    }
});


// =========================================
// DELETE A USER
// =========================================

router.delete("/users/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (Number(id) === Number(req.user.id)) {
            return res.status(400).json({
                message: "You cannot delete your own account here"
            });
        }

        const result = await pool.query(
            `DELETE FROM users
             WHERE id = $1
             RETURNING id, name, email, role`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: "User deleted successfully",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Error deleting admin user:", error);

        res.status(500).json({
            message: "Failed to delete user"
        });
    }
});


// =========================================
// VIEW ALL BOOKINGS
// =========================================

router.get("/bookings", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
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
            ORDER BY bookings.created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching admin bookings:", error);

        res.status(500).json({
            message: "Failed to fetch bookings"
        });
    }
});


// =========================================
// VIEW ALL PAYMENTS
// =========================================

router.get("/payments", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                payments.*,
                bookings.customer_id,
                customer.name AS customer_name
            FROM payments
            JOIN bookings
                ON payments.booking_id = bookings.id
            JOIN users AS customer
                ON bookings.customer_id = customer.id
            ORDER BY payments.created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching admin payments:", error);

        res.status(500).json({
            message: "Failed to fetch payments"
        });
    }
});


// =========================================
// VIEW ALL REVIEWS
// =========================================

router.get("/reviews", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                reviews.*,
                customer.name AS customer_name,
                provider.name AS provider_name
            FROM reviews
            JOIN users AS customer
                ON reviews.customer_id = customer.id
            JOIN users AS provider
                ON reviews.provider_id = provider.id
            ORDER BY reviews.created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching admin reviews:", error);

        res.status(500).json({
            message: "Failed to fetch reviews"
        });
    }
});


module.exports = router;