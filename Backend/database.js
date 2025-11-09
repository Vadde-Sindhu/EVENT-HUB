const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'eventhub.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('✅ Connected to SQLite database');
    }
});

// Initialize database
function initDatabase() {
    return new Promise((resolve, reject) => {
        // Create events table
        db.run(`CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            location TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            attendees INTEGER DEFAULT 0,
            category TEXT NOT NULL,
            image TEXT,
            price REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                reject(err);
                return;
            }

            // Create registrations table
            db.run(`CREATE TABLE IF NOT EXISTS registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT NOT NULL,
                tickets INTEGER NOT NULL,
                comments TEXT,
                registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events (id)
            )`, async (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Check if we need to insert sample data
                const eventCount = await getEventCount();
                if (eventCount === 0) {
                    await insertSampleData();
                    console.log('✅ Sample data inserted successfully');
                }
                
                resolve();
            });
        });
    });
}

function getEventCount() {
    return new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) as count FROM events", (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
        });
    });
}

function insertSampleData() {
    const sampleEvents = [
        {
            title: "Digital Marketing Conference",
            description: "Learn the latest trends in digital marketing from industry experts. Network with professionals and grow your skills.",
            date: "2025-11-15",
            time: "09:00",
            location: "Mumbai, Maharashtra",
            capacity: 250,
            attendees: 180,
            category: "business",
            image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
            price: 2999
        },
        {
            title: "Startup Innovation Summit",
            description: "Connect with investors, mentors, and fellow entrepreneurs. Pitch your ideas and find potential collaborators.",
            date: "2025-12-05",
            time: "10:00",
            location: "Bengaluru, Karnataka",
            capacity: 180,
            attendees: 120,
            category: "business",
            image: "https://images.unsplash.com/photo-1511578314322-379afb476865?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
            price: 4499
        },
        {
            title: "Web Development Workshop",
            description: "Hands-on workshop covering modern web development techniques. Perfect for beginners and intermediate developers.",
            date: "2025-11-28",
            time: "13:00",
            location: "Hyderabad, Telangana",
            capacity: 50,
            attendees: 35,
            category: "tech",
            image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
            price: 1999
        }
    ];

    const insertPromises = sampleEvents.map(event => {
        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO events (title, description, date, time, location, capacity, attendees, category, image, price) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [event.title, event.description, event.date, event.time, event.location, event.capacity, event.attendees, event.category, event.image, event.price],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                });
        });
    });

    return Promise.all(insertPromises);
}

// Event methods
function getAllEvents(category = null) {
    return new Promise((resolve, reject) => {
        let query = "SELECT * FROM events";
        let params = [];

        if (category && category !== 'all') {
            query += " WHERE category = ?";
            params.push(category);
        }

        query += " ORDER BY date, time";

        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getEventById(id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM events WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function createEvent(eventData) {
    return new Promise((resolve, reject) => {
        const { title, description, date, time, location, capacity, category, image, price } = eventData;
        
        db.run(`INSERT INTO events (title, description, date, time, location, capacity, category, image, price) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, date, time, location, capacity, category, image || 'https://images.unsplash.com/photo-1542736667-069246bdbc6d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80', price || 0],
            function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, ...eventData, attendees: 0 });
            });
    });
}

function updateEventAttendees(eventId, newAttendeeCount) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE events SET attendees = ? WHERE id = ?", [newAttendeeCount, eventId], function(err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

function deleteEvent(eventId) {
    return new Promise((resolve, reject) => {
        // First delete all registrations for this event
        db.run("DELETE FROM registrations WHERE event_id = ?", [eventId], (err) => {
            if (err) {
                reject(err);
                return;
            }
            
            // Then delete the event
            db.run("DELETE FROM events WHERE id = ?", [eventId], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    });
}

// Registration methods
function createRegistration(registrationData) {
    return new Promise((resolve, reject) => {
        const { eventId, firstName, lastName, email, phone, tickets, comments } = registrationData;
        
        db.run(`INSERT INTO registrations (event_id, first_name, last_name, email, phone, tickets, comments) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [eventId, firstName, lastName, email, phone, tickets, comments || ''],
            function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, ...registrationData });
            });
    });
}

function getEventRegistrations(eventId) {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM registrations WHERE event_id = ?", [eventId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getEventAttendeeCount(eventId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT SUM(tickets) as total FROM registrations WHERE event_id = ?", [eventId], (err, row) => {
            if (err) reject(err);
            else resolve(row.total || 0);
        });
    });
}

function close() {
    if (db) {
        db.close();
    }
}

// Export all functions
module.exports = {
    initDatabase,
    getAllEvents,
    getEventById,
    createEvent,
    updateEventAttendees,
    deleteEvent,
    createRegistration,
    getEventRegistrations,
    getEventAttendeeCount,
    close
};
