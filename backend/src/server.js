const express = require("express");
const pool = require("./config/database");


const bookingRoutes = require("./routes/bookings");

const providerRoutes = require("./routes/providers");

const authMiddleware = require("./middleware/auth");

const app = express();

const authRoutes = require("./routes/auth");

const reviewRoutes = require("./routes/reviews");

const notificationRoutes = require("./routes/notifications");

const paymentRoutes = require("./routes/payments");

const adminRoutes = require("./routes/admin");

const cors = require("cors");

app.use(cors({
    origin: "http://localhost:5173"
}));

app.use(express.json());

app.use(express.json());


const adminOnly = (req, res, next) => {
    // Only administrators can perform management operations.
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Admin access required"
        });
    }

    next();
};

app.use("/api/auth", authRoutes);

app.use("/api/providers", providerRoutes);

app.use("/api/bookings", bookingRoutes);

app.use("/api/reviews", reviewRoutes);


app.use("/api/notifications", notificationRoutes);

app.use("/api/payments", paymentRoutes);

app.use("/api/admin", adminRoutes);

const PORT = 5000;


// =========================
// DATABASE CONNECTION
// =========================

pool.query("SELECT NOW()", (error, result) => {
    if (error) {
        console.error("Database connection failed:", error);
    } else {
        console.log("Database connected:", result.rows[0]);
    }
});


// =========================
// HOME ROUTE
// =========================

app.get("/", (req, res) => {
    res.json({
        message: "Usta Hub API is running"
    });
});


// =========================
// CATEGORY ROUTES
// =========================

app.get("/api/categories", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM service_categories ORDER BY id"
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching categories:", error);

        res.status(500).json({
            message: "Failed to fetch categories"
        });
    }
});


// =========================
// SERVICE ROUTES
// =========================

app.get("/api/services", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                services.id,
                services.name,
                services.description,
                services.base_price,
                service_categories.name AS category
            FROM services
            JOIN service_categories
                ON services.category_id = service_categories.id
            ORDER BY services.id
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching services:", error);

        res.status(500).json({
            message: "Failed to fetch services"
        });
    }
});



app.post("/api/services", authMiddleware, adminOnly, async (req, res) => {
    try {
        const {
            category_id,
            name,
            description,
            base_price
        } = req.body;

        const result = await pool.query(
            `INSERT INTO services
                (category_id, name, description, base_price)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
                category_id,
                name,
                description,
                base_price
            ]
        );

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error("Error creating service:", error);

        res.status(500).json({
            message: "Failed to create service"
        });
    }
});



app.put("/api/services/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        const {
            category_id,
            name,
            description,
            base_price
        } = req.body;

        const result = await pool.query(
            `UPDATE services
             SET
                category_id = $1,
                name = $2,
                description = $3,
                base_price = $4
             WHERE id = $5
             RETURNING *`,
            [
                category_id,
                name,
                description,
                base_price,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Service not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Error updating service:", error);

        res.status(500).json({
            message: "Failed to update service"
        });
    }
});



app.delete("/api/services/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM services WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Service not found"
            });
        }

        res.json({
            message: "Service deleted successfully",
            service: result.rows[0]
        });

    } catch (error) {
        console.error("Error deleting service:", error);

        res.status(500).json({
            message: "Failed to delete service"
        });
    }
});



// =========================
// START SERVER
// =========================

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});