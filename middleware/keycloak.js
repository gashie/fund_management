const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Load the public key from the file
const publicKey = fs.readFileSync(path.resolve(__dirname, 'keycloak_public.pem'), 'utf8');

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1]; // Assumes 'Bearer <token>'

    if (!token) {
        return res.status(401).json({ message: 'Token missing' });
    }

    try {
        // Verify token with public key
        const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

        // Add user information to the request object
        req.client = decoded;

        next(); // Token is valid, proceed to next middleware or route handler
    } catch (error) {
        console.log(error);
        
        return res.status(401).json({ message: 'Token verification failed', error: error.message });
    }
};

module.exports = verifyToken;
