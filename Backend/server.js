const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Import database functions
const {
    initDatabase,
    getAllEvents,
    getEventById,
    createEvent,
    updateEventAttendees,
    createRegistration,
    getEventRegistrations,
    getEventAttendeeCount,
    deleteEvent
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.get('/api/events', async (req, res) => {
    try {
        const { category } = req.query;
        const events = await getAllEvents(category);
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

app.get('/api/events/:id', async (req, res) => {
    try {
        const event = await getEventById(parseInt(req.params.id));
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

app.post('/api/events', async (req, res) => {
    try {
        const {
            title,
            description,
            date,
            time,
            location,
            capacity,
            category,
            image,
            price
        } = req.body;

        // Validation
        if (!title || !description || !date || !time || !location || !capacity || !category) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const newEvent = await createEvent({
            title,
            description,
            date,
            time,
            location,
            capacity: parseInt(capacity),
            category,
            image,
            price: price ? parseFloat(price) : 0
        });

        res.status(201).json(newEvent);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

app.delete('/api/events/:id', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id);
        
        const deletedCount = await deleteEvent(eventId);
        
        if (deletedCount === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

app.post('/api/registrations', async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            eventId,
            tickets,
            comments
        } = req.body;

        // Validation
        if (!firstName || !lastName || !email || !phone || !eventId || !tickets) {
            return res.status(400).json({ error: 'All required fields must be filled' });
        }

        const event = await getEventById(parseInt(eventId));
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Get current attendee count
        const currentAttendees = await getEventAttendeeCount(parseInt(eventId));
        
        // Check capacity
        if (currentAttendees + parseInt(tickets) > event.capacity) {
            return res.status(400).json({ 
                error: `Only ${event.capacity - currentAttendees} tickets available for this event` 
            });
        }

        // Create registration
        const registration = await createRegistration({
            eventId: parseInt(eventId),
            firstName,
            lastName,
            email,
            phone,
            tickets: parseInt(tickets),
            comments: comments || ''
        });

        // Update event attendees count
        const newAttendeeCount = currentAttendees + parseInt(tickets);
        await updateEventAttendees(parseInt(eventId), newAttendeeCount);

        res.status(201).json({
            message: 'Registration successful',
            registration,
            event: { ...event, attendees: newAttendeeCount }
        });
    } catch (error) {
        console.error('Error creating registration:', error);
        res.status(500).json({ error: 'Failed to create registration' });
    }
});

app.get('/api/events/:id/registrations', async (req, res) => {
    try {
        const registrations = await getEventRegistrations(parseInt(req.params.id));
        res.json(registrations);
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ error: 'Failed to fetch registrations' });
    }
});

app.get('/api/events/:id/export', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id);
        
        // Get event details
        const event = await getEventById(eventId);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        // Get registrations for this event
        const registrations = await getEventRegistrations(eventId);
        
        // Create CSV content
        let csvContent = `Event: ${event.title}\n`;
        csvContent += `Date: ${event.date} ${event.time}\n`;
        csvContent += `Location: ${event.location}\n`;
        csvContent += `Total Registrations: ${registrations.length}\n\n`;
        
        // CSV headers
        csvContent += 'First Name,Last Name,Email,Phone,Tickets,Registration Date,Comments\n';
        
        // Add registration data
        registrations.forEach(reg => {
            const row = [
                `"${reg.first_name}"`,
                `"${reg.last_name}"`,
                `"${reg.email}"`,
                `"${reg.phone}"`,
                reg.tickets,
                reg.registration_date,
                `"${reg.comments || ''}"`
            ].join(',');
            csvContent += row + '\n';
        });
        
        // Set response headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="event-${eventId}-registrations.csv"`);
        res.send(csvContent);
        
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ error: 'Failed to export event data' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'EventHub API is running' });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Initialize database and start server
async function startServer() {
    try {
        console.log('🔄 Initializing database...');
        await initDatabase();
        console.log('✅ Database initialized successfully');
        
        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🚀 EventHub Server Started Successfully!');
            console.log('='.repeat(50));
            console.log(`📍 Local: http://localhost:${PORT}`);
            console.log(`🔧 API Health: http://localhost:${PORT}/api/health`);
            console.log(`📊 API Events: http://localhost:${PORT}/api/events`);
            console.log('='.repeat(50));
            console.log('Press Ctrl+C to stop the server');
            console.log('='.repeat(50));
        });
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    process.exit(0);
});

// Start the server
startServer();
