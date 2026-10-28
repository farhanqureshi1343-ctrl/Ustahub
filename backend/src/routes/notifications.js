
const express = require("express");
const pool = require("../config/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();


/* =========================================
   GET MY NOTIFICATIONS
========================================= */

router.get("/", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id,
                title,
                message,
                type,
                is_read,
                created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [req.user.id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching notifications:", error);

        res.status(500).json({
            message: "Failed to fetch notifications"
        });
    }
});


/* =========================================
   GET UNREAD NOTIFICATION COUNT
========================================= */

router.get("/unread-count", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COUNT(*)::INTEGER AS unread_count
             FROM notifications
             WHERE user_id = $1
             AND is_read = FALSE`,
            [req.user.id]
        );

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Error counting notifications:", error);

        res.status(500).json({
            message: "Failed to count notifications"
        });
    }
});


/* =========================================
   MARK ONE NOTIFICATION AS READ
========================================= */

router.patch("/:id/read", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE id = $1
             AND user_id = $2
             RETURNING id, title, message, type, is_read, created_at`,
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Notification not found"
            });
        }

        res.json({
            message: "Notification marked as read",
            notification: result.rows[0]
        });

    } catch (error) {
        console.error("Error updating notification:", error);

        res.status(500).json({
            message: "Failed to update notification"
        });
    }
});


/* =========================================
   MARK ALL NOTIFICATIONS AS READ
========================================= */

router.patch("/read-all", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE user_id = $1
             AND is_read = FALSE`,
            [req.user.id]
        );

        res.json({
            message: "All notifications marked as read",
            updated_count: result.rowCount
        });

    } catch (error) {
        console.error("Error marking notifications as read:", error);

        res.status(500).json({
            message: "Failed to update notifications"
        });
    }
});


/* =========================================
   DELETE ONE NOTIFICATION
========================================= */

router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM notifications
             WHERE id = $1
             AND user_id = $2
             RETURNING id`,
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Notification not found"
            });
        }

        res.json({
            message: "Notification deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting notification:", error);

        res.status(500).json({
            message: "Failed to delete notification"
        });
    }
});


module.exports = router;